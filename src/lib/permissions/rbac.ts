import { Role } from "./roles";

export type Capability = 
  | "project:create" 
  | "project:delete" 
  | "project:archive"
  | "finance:invoice" 
  | "finance:verify_payment" 
  | "finance:unfreeze"
  | "ops:schedule_visit" 
  | "ops:escalate_revisions"
  | "field:report" 
  | "vault:overwrite";

const ROLE_CAPABILITIES: Record<Role, Capability[]> = {
  admin: [
    "project:create", "project:delete", "project:archive",
    "finance:invoice", "finance:verify_payment", "finance:unfreeze",
    "ops:schedule_visit", "ops:escalate_revisions",
    "field:report", "vault:overwrite"
  ],
  sales: ["project:create"],
  accountant: ["project:create", "finance:invoice", "finance:verify_payment", "finance:unfreeze"],
  engineer: ["ops:schedule_visit", "ops:escalate_revisions", "field:report"],
  field: ["field:report"],
  hr: [],
  developer: [],
};

/**
 * Checks if the user's role permits executing a specific operation capability.
 */
export function hasCapability(role: Role, action: Capability): boolean {
  if (role === "admin") return true;
  const capabilities = ROLE_CAPABILITIES[role] || [];
  return capabilities.includes(action);
}
