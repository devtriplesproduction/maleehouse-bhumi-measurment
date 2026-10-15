/**
 * Offline critical-path assertions (no network).
 * Fails CI if production safety invariants regress.
 */
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

const root = process.cwd()
let failed = 0

function assert(cond, msg) {
  if (!cond) {
    console.log('  [FAIL]', msg)
    failed++
  } else {
    console.log('  [PASS]', msg)
  }
}

function read(p) {
  return readFileSync(join(root, p), 'utf8')
}

console.log('\n=== Critical path invariants ===\n')

// Public pages must not use admin client
assert(
  !read('src/app/invoices/[id]/page.tsx').includes('createAdminClient'),
  'Invoice public page does not use admin client'
)
assert(
  !read('src/app/receipts/[id]/page.tsx').includes('createAdminClient'),
  'Receipt public page does not use admin client'
)

// Wipe / seed guards
assert(
  read('src/actions/admin.actions.ts').includes('ALLOW_SYSTEM_WIPE'),
  'System wipe gated by ALLOW_SYSTEM_WIPE'
)
assert(
  read('src/actions/seed.actions.ts').includes("NODE_ENV === 'production'"),
  'Seed disabled in production'
)

// Middleware exists
assert(existsSync('src/middleware.ts'), 'middleware.ts present')

// Health endpoint
assert(existsSync('src/app/api/health/route.ts'), 'health route present')

// Cron requires secret
assert(
  read('src/actions/finance.actions.ts').includes('CRON_SECRET'),
  'Invoice cron checks CRON_SECRET'
)

// Auth claims sync on login
assert(
  read('src/actions/auth.actions.ts').includes('app_metadata'),
  'Login syncs app_metadata claims'
)

// Rate limit
assert(existsSync('src/lib/rate-limit.ts'), 'rate-limit module present')

// Secrets hygiene — dumps / third-party keys must not reappear
for (const p of [
  'production-data.sql',
  'production.sql',
  'production-full.sql',
  'testsprite_tests/tmp/config.json',
]) {
  assert(!existsSync(join(root, p)), `forbidden path absent: ${p}`)
}

// Next.js past CVE-2025-29927 floor
const pkg = JSON.parse(read('package.json'))
const nextVer = String(pkg.dependencies?.next || '')
const nm = nextVer.match(/(\d+)\.(\d+)\.(\d+)/)
if (nm) {
  const [maj, min, pat] = nm.slice(1).map(Number)
  const ok =
    maj > 14 ||
    (maj === 14 && min > 2) ||
    (maj === 14 && min === 2 && pat >= 25) ||
    (maj === 15 && (min > 2 || (min === 2 && pat >= 3)))
  assert(ok, `next ${nextVer} patches CVE-2025-29927`)
} else {
  assert(false, 'next version parseable')
}

// Local seed scripts must require ALLOW_SEED
assert(
  existsSync('scripts/local/seed_db.mjs') &&
    read('scripts/local/seed_db.mjs').includes('ALLOW_SEED'),
  'local seed gated by ALLOW_SEED'
)
assert(
  read('src/app/api/health/route.ts').includes('HEALTH_CHECK_SECRET') ||
    read('src/app/api/health/route.ts').includes('x-health-secret'),
  'health detail gated'
)
assert(
  read('next.config.mjs').includes('Content-Security-Policy') &&
    read('next.config.mjs').includes('Strict-Transport-Security'),
  'CSP and HSTS headers configured'
)
assert(
  read('src/actions/project.actions.ts').includes(".neq('id', 'PRJ-PRINT-DESK')"),
  'Project directory excludes PRJ-PRINT-DESK generic print jobs placeholder'
)

console.log(failed ? `\n${failed} invariant(s) failed\n` : '\nAll critical invariants OK\n')
process.exit(failed ? 1 : 0)
