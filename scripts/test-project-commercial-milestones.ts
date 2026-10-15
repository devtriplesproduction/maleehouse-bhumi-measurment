/**
 * Runnable self-check for Direct Project Commercial Amount & Milestones Breakdown
 * Checks Zod schema validation, balance reconciliation rules, and partial update support.
 */

import { createProjectSchema, baseProjectSchema, updateProjectSchema } from '../src/validations/project.schema';

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  [PASS] ${message}`);
    passed++;
  } else {
    console.error(`  [FAIL] ${message}`);
    failed++;
  }
}

console.log('\n=== Testing Direct Project Amount & Milestone Invariants ===\n');

// 1. Valid project creation with matching milestones
const validPayload = {
  name: 'Highway Survey Test',
  client_name: 'NHAI Client',
  phone: '+919876543210',
  client_address: 'Survey Road 1, Pune',
  state_code: 'MH',
  site_type: 'infrastructure' as const,
  survey_requirements: 'Standard topographical survey requirements',
  services: ['Topographical Survey'],
  amount: 100000,
  milestones: [
    {
      title: 'Mobilization Advance',
      amount: 40000,
      due_date: '2026-11-01',
      linked_stage: 'ready_for_dispatch',
      is_activation_gate: true,
    },
    {
      title: 'Field Survey Ongoing',
      amount: 40000,
      due_date: '2026-11-15',
      linked_stage: 'field_work',
      is_activation_gate: false,
    },
    {
      title: 'Final Handover',
      amount: 20000,
      due_date: '2026-12-01',
      linked_stage: 'completed',
      is_activation_gate: false,
    },
  ],
};

const validRes = createProjectSchema.safeParse(validPayload);
assert(validRes.success, 'Valid project with 100k amount and matching 40k+40k+20k milestones succeeds');

// 2. Invalid project creation where milestones do not equal amount
const invalidPayload = {
  ...validPayload,
  amount: 100000,
  milestones: [
    {
      title: 'Advance Only',
      amount: 50000,
      due_date: '2026-11-01',
      linked_stage: 'ready_for_dispatch',
    },
  ],
};

const invalidRes = createProjectSchema.safeParse(invalidPayload);
assert(!invalidRes.success, 'Rejects project when milestone sum (50k) does not equal project amount (100k)');

// 3. Project with 0 amount and empty milestones
const zeroPayload = {
  ...validPayload,
  amount: 0,
  milestones: [],
};
const zeroRes = createProjectSchema.safeParse(zeroPayload);
assert(zeroRes.success, 'Allows initial project with 0 amount and empty milestones');

// 4. Base schema allows .partial() without ZodEffects runtime error
assert(typeof updateProjectSchema.parse === 'function', 'updateProjectSchema is valid and runnable');
const partialRes = updateProjectSchema.safeParse({ name: 'Updated Name Only' });
assert(partialRes.success, 'updateProjectSchema successfully validates partial updates');

// 5. Valid project creation with bank_account_id without requiring payment_method
const bankPayload = {
  ...validPayload,
  bank_account_id: 'ba-12345-test-bank-id',
};
const bankRes = createProjectSchema.safeParse(bankPayload);
assert(bankRes.success, 'Valid project with bank_account_id and no payment_method succeeds');
if (bankRes.success) {
  assert(bankRes.data.bank_account_id === 'ba-12345-test-bank-id', 'Preserves selected bank_account_id');
  assert(!bankRes.data.payment_method, 'payment_method is omitted/null by default');
}

// 7. GST Type Selection Validation: no_gst, cgst_sgst_2_5, cgst_sgst_5
for (const gstOption of ['no_gst', 'cgst_sgst_2_5', 'cgst_sgst_5'] as const) {
  const gstRes = createProjectSchema.safeParse({
    ...validPayload,
    gst_type: gstOption,
  });
  assert(gstRes.success, `Allows GST type '${gstOption}'`);
  if (gstRes.success) {
    assert(gstRes.data.gst_type === gstOption, `Correctly parsed gst_type '${gstOption}'`);
  }
}

// Rejects invalid GST type
const invalidGstRes = createProjectSchema.safeParse({
  ...validPayload,
  gst_type: 'invalid_gst_rate',
});
assert(!invalidGstRes.success, 'Rejects invalid GST type option');


console.log(`\nResults: ${passed} passed, ${failed} failed.\n`);
if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
