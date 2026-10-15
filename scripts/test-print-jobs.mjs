import assert from 'assert';
import { Client } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function runCheck() {
  console.log('--- Print Desk Self-Check ---');
  const url = new URL(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const ref = url.hostname.split('.')[0];
  const client = new Client({
    host: `db.${ref}.supabase.co`,
    port: 5432,
    user: 'postgres',
    password: process.env.SUPABASE_DB_PASSWORD,
    database: 'postgres',
    ssl: { rejectUnauthorized: false }
  });

  await client.connect();

  // 1. Verify PRJ-PRINT-DESK project exists
  const projRes = await client.query("SELECT id, name FROM public.projects WHERE id = 'PRJ-PRINT-DESK'");
  assert.strictEqual(projRes.rows.length, 1, 'PRJ-PRINT-DESK must exist');
  console.log('✓ Generic Project PRJ-PRINT-DESK verified.');

  // 2. Insert test print job
  const testJobId = `PRT-TEST-${Date.now()}`;
  await client.query(`
    INSERT INTO public.print_jobs (
      id, client_name, client_phone, project_id, file_name, copies, paper_size, print_type, amount, status
    ) VALUES (
      $1, 'Test Client', '9999999999', 'PRJ-PRINT-DESK', 'site_plan_test.pdf', 2, 'A3', 'color', 150.00, 'paid'
    )
  `, [testJobId]);
  console.log(`✓ Inserted test print job ${testJobId}.`);

  // 3. Query back test print job
  const jobRes = await client.query('SELECT * FROM public.print_jobs WHERE id = $1', [testJobId]);
  assert.strictEqual(jobRes.rows.length, 1, 'Job must be retrievable');
  assert.strictEqual(jobRes.rows[0].copies, 2);
  assert.strictEqual(jobRes.rows[0].paper_size, 'A3');
  assert.strictEqual(jobRes.rows[0].print_type, 'color');
  assert.strictEqual(Number(jobRes.rows[0].amount), 150);
  console.log('✓ Query validation passed.');

  // 4. Cleanup
  await client.query('DELETE FROM public.print_jobs WHERE id = $1', [testJobId]);
  console.log('✓ Cleaned up test print job.');

  await client.end();
  console.log('All Print Desk self-checks PASSED!');
}

runCheck().catch(err => {
  console.error('Self-check FAILED:', err);
  process.exit(1);
});
