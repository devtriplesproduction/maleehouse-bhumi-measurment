/**
 * Self-check script for Material Assignment and Return workflow.
 * Run with: node -r dotenv/config scripts/test-material-assignment.mjs dotenv_config_path=.env.local
 */
import assert from 'assert';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Missing SUPABASE env vars");
  process.exit(1);
}

const supabase = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function runCheck() {
  console.log("=== Checking Material Assignment & Return Workflow ===");

  // 1. Get an existing project and engineer profile
  const { data: project } = await supabase.from('projects').select('id, name').limit(1).single();
  const { data: engineer } = await supabase.from('profiles').select('id, role').eq('role', 'engineer').limit(1).single();
  const { data: admin } = await supabase.from('profiles').select('id, role').eq('role', 'admin').limit(1).single();

  const user = engineer || admin;
  assert(project, "Project must exist");
  assert(user, "User must exist");

  const testMatId = `test_mat_${Date.now()}`;
  console.log(`Using Project: ${project.name} (${project.id})`);

  // 2. Test inserting material with status 'assigned'
  const { data: mat, error: insertErr } = await supabase.from('material_requests').insert({
    id: testMatId,
    project_id: project.id,
    requested_by: user.id,
    assigned_by: user.id,
    item_name: 'Total Station Leica TS07',
    quantity: 1,
    notes: 'Unit #4 with 2 batteries and tripod',
    status: 'assigned',
    created_at: new Date().toISOString()
  }).select().single();

  assert(!insertErr, `Insert failed: ${insertErr?.message}`);
  assert.strictEqual(mat.status, 'assigned', "Status should be assigned");
  console.log("✓ Material assigned successfully with status 'assigned'");

  // 3. Query unsubmitted materials for this project
  const { data: pending } = await supabase
    .from('material_requests')
    .select('id, item_name, quantity, status')
    .eq('project_id', project.id)
    .in('status', ['assigned', 'requested']);

  const found = (pending || []).find(m => m.id === testMatId);
  assert(found, "Newly assigned material should be found in pending materials query");
  console.log(`✓ Material correctly flagged as pending return before final deliverable (pending count: ${pending.length})`);

  // 4. Test submitting material back to company
  const { error: updateErr } = await supabase
    .from('material_requests')
    .update({
      status: 'submitted',
      submitted_at: new Date().toISOString(),
      submitted_by: user.id
    })
    .eq('id', testMatId);

  assert(!updateErr, `Update failed: ${updateErr?.message}`);

  const { data: updatedMat } = await supabase
    .from('material_requests')
    .select('status, submitted_at, submitted_by')
    .eq('id', testMatId)
    .single();

  assert.strictEqual(updatedMat.status, 'submitted', "Status should be submitted");
  assert(updatedMat.submitted_at, "submitted_at timestamp must be populated");
  console.log("✓ Material successfully marked as submitted to company");

  // 5. Clean up
  await supabase.from('material_requests').delete().eq('id', testMatId);
  console.log("✓ Cleaned up test record");

  console.log("\n=== ALL ASSERTIONS PASSED ===");
}

runCheck().catch((err) => {
  console.error("Self-check failed:", err);
  process.exit(1);
});
