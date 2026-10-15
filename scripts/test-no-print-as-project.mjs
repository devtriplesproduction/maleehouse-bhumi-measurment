import assert from 'assert';
import { Client } from 'pg';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function runCheck() {
  console.log('--- Checking Print Project Isolation ---');
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

  // 1. Verify PRJ-PRINT-DESK status is 'archived' in DB
  const projRes = await client.query("SELECT id, name, status FROM public.projects WHERE id = 'PRJ-PRINT-DESK'");
  assert.strictEqual(projRes.rows.length, 1, 'PRJ-PRINT-DESK must exist');
  assert.strictEqual(projRes.rows[0].status, 'archived', 'PRJ-PRINT-DESK status must be archived');
  console.log('✓ PRJ-PRINT-DESK is archived in DB.');

  // 2. Verify active project query does NOT return PRJ-PRINT-DESK
  const activeRes = await client.query(`
    SELECT id FROM public.projects 
    WHERE status IN ('project_created', 'data_collection', 'prototype', 'field_assigned', 'field_work', 'data_sync', 'review', 'final_review')
      AND deleted_at IS NULL
      AND id = 'PRJ-PRINT-DESK'
  `);
  assert.strictEqual(activeRes.rows.length, 0, 'PRJ-PRINT-DESK must not appear in active ops query');
  console.log('✓ PRJ-PRINT-DESK excluded from active operational query.');

  // 3. Verify new assignments query (status = project_created) does NOT return PRJ-PRINT-DESK
  const newAssignmentsRes = await client.query(`
    SELECT id FROM public.projects 
    WHERE status = 'project_created'
      AND deleted_at IS NULL
      AND id = 'PRJ-PRINT-DESK'
  `);
  assert.strictEqual(newAssignmentsRes.rows.length, 0, 'PRJ-PRINT-DESK must not appear in new assignments');
  console.log('✓ PRJ-PRINT-DESK excluded from new assignments.');

  await client.end();
  console.log('All checks passed successfully!');
}

runCheck().catch(err => {
  console.error('Check failed:', err);
  process.exit(1);
});
