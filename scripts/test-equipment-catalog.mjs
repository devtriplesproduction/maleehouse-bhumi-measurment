/**
 * Self-check script for Equipment Catalog & Subparts feature.
 * Run with: node -r dotenv/config scripts/test-equipment-catalog.mjs dotenv_config_path=.env.local
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

function parseMaterialNotes(notes) {
  if (!notes) return { remarks: "", subparts: [] };
  const subpartsIndex = notes.indexOf("Subparts:");
  if (subpartsIndex === -1) {
    return { remarks: notes, subparts: [] };
  }
  const before = notes.substring(0, subpartsIndex).replace(/\|\s*$/, "").trim();
  const subpartsStr = notes.substring(subpartsIndex + "Subparts:".length).trim();
  const subparts = subpartsStr
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return { remarks: before, subparts };
}

async function runCheck() {
  console.log("=== Testing Equipment & Subparts Catalog Workflow ===");

  // 1. Check system_settings table exists and is readable
  const { data: initial, error: fetchErr } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'equipment_catalog')
    .maybeSingle();

  assert(!fetchErr, `Fetch failed: ${fetchErr?.message}`);
  console.log("✓ system_settings table is accessible");

  // 2. Test saving an equipment item with subparts
  const testEquipId = `test_eq_${Date.now()}`;
  const testItem = {
    id: testEquipId,
    name: "Survey Drone RTK (Test)",
    category: "Aerial Survey",
    code: "UAV-TEST",
    description: "High-spec survey drone with dual batteries and charger",
    subparts: [
      { id: "sub-1", name: "Intelligent Flight Battery", defaultQuantity: 2, isRequired: true },
      { id: "sub-2", name: "Fast Battery Charger", defaultQuantity: 1, isRequired: true },
      { id: "sub-3", name: "Remote Controller", defaultQuantity: 1, isRequired: true },
    ]
  };

  const currentItems = (initial?.value?.items) || [];
  const updatedItems = [testItem, ...currentItems];

  const { error: upsertErr } = await supabase.from('system_settings').upsert({
    key: 'equipment_catalog',
    value: { items: updatedItems },
    updated_at: new Date().toISOString()
  }, { onConflict: 'key' });

  assert(!upsertErr, `Upsert failed: ${upsertErr?.message}`);
  console.log("✓ Successfully saved equipment item with subparts to catalog");

  // 3. Verify retrieval
  const { data: retrieved, error: retrieveErr } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', 'equipment_catalog')
    .single();

  assert(!retrieveErr, `Retrieval error: ${retrieveErr?.message}`);
  const items = retrieved?.value?.items || [];
  const found = items.find(x => x.id === testEquipId);
  assert(found, "Saved equipment item must be present in retrieved catalog");
  assert.strictEqual(found.name, testItem.name, "Name must match");
  assert.strictEqual(found.subparts.length, 3, "Must have 3 subparts");
  assert.strictEqual(found.subparts[0].name, "Intelligent Flight Battery");
  assert.strictEqual(found.subparts[0].defaultQuantity, 2);
  console.log(`✓ Verified equipment "${found.name}" with subparts: ${found.subparts.map(s => `${s.defaultQuantity}x ${s.name}`).join(", ")}`);

  // 4. Test note parsing logic for project material assignments
  const sampleNoteWithSubparts = "S/N: 99482 | Subparts: 2x Intelligent Flight Battery, 1x Fast Battery Charger, 1x Remote Controller";
  const parsed = parseMaterialNotes(sampleNoteWithSubparts);
  assert.strictEqual(parsed.remarks, "S/N: 99482", "Remarks should parse correctly");
  assert.strictEqual(parsed.subparts.length, 3, "Subparts count should be 3");
  assert.strictEqual(parsed.subparts[0], "2x Intelligent Flight Battery");
  assert.strictEqual(parsed.subparts[1], "1x Fast Battery Charger");
  console.log("✓ parseMaterialNotes correctly extracted remarks and subpart badges");

  // 5. Clean up test record
  const cleanedItems = items.filter(x => x.id !== testEquipId);
  await supabase.from('system_settings').upsert({
    key: 'equipment_catalog',
    value: { items: cleanedItems },
    updated_at: new Date().toISOString()
  }, { onConflict: 'key' });
  console.log("✓ Cleaned up test record from catalog");

  console.log("\n=== ALL EQUIPMENT CATALOG TESTS PASSED SUCCESSFULLY ===");
}

runCheck().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
