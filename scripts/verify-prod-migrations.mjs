/**
 * Lists critical production migrations and optionally probes Supabase RPCs.
 *
 * Usage:
 *   node scripts/verify-prod-migrations.mjs
 *   node -r dotenv/config scripts/verify-prod-migrations.mjs
 */
import { readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, '..', 'supabase', 'migrations');

const CRITICAL = [
  '20260731140000_production_hot_indexes.sql',
  '20260731150000_admin_kpis_and_finance_summary.sql',
  '20260731160000_sync_auth_claims_role_active.sql',
  '20260731170000_transition_project_stage_rpc.sql',
  '20260731180000_public_invoice_receipt_rpcs.sql',
  '20260731190000_fix_public_and_finance_rpc_enums.sql',
  '20260731191000_public_share_tokens.sql',
  '20260724000003_distributed_rate_limiting.sql',
];

console.log('\n=== Production speed migrations (must apply on Supabase) ===\n');
const files = readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
for (const name of CRITICAL) {
  const ok = files.includes(name);
  console.log(ok ? `  [OK]   ${name}` : `  [MISS] ${name}`);
}

console.log(`\nTotal migration files on disk: ${files.length}`);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.log('\n(No env URL/key — skip live RPC probe. Set NEXT_PUBLIC_SUPABASE_URL + key to probe.)\n');
  process.exit(0);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const probes = [
  { name: 'get_admin_dashboard_kpis', args: {} },
  { name: 'get_financial_overview_summary', args: {} },
  { name: 'check_rate_limit', args: { p_key: 'probe', p_limit: 999, p_window_seconds: 60 } },
  { name: 'get_public_invoice', args: { p_id: '__probe_missing__' } },
  { name: 'get_public_receipt', args: { p_id: '__probe_missing__', p_type: 'invoice' } },
];

console.log('\n=== Live RPC probe ===\n');
for (const p of probes) {
  try {
    const { error } = await supabase.rpc(p.name, p.args);
    if (error) {
      console.log(`  [FAIL] ${p.name}: ${error.message}`);
    } else {
      console.log(`  [OK]   ${p.name}`);
    }
  } catch (e) {
    console.log(`  [FAIL] ${p.name}: ${e.message}`);
  }
}

console.log(`
Next steps if any FAIL:
  1. supabase db push   OR run the SQL files in Supabase SQL editor
  2. Redeploy the app
  3. Have users re-login once (JWT claims)
`);
