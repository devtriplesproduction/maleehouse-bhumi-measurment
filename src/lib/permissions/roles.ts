export type Role = "admin" | "sales" | "accountant" | "engineer" | "field" | "hr" | "developer";

export const ROLES = {
  ADMIN: "admin" as Role,
  SALES: "sales" as Role,
  ACCOUNTANT: "accountant" as Role,
  ENGINEER: "engineer" as Role,
  FIELD: "field" as Role,
  HR: "hr" as Role,
  DEVELOPER: "developer" as Role,
};

// Determines base redirection rules (legacy and new module-based)
export const ROLE_REDIRECTS: Record<Role, string> = {
  admin: "/admin",
  sales: "/sales",
  accountant: "/accounts",
  engineer: "/engineer",
  field: "/field",
  hr: "/hr",
  developer: "/developer/dashboard",
};

// Strict route protection map (Prefix -> Allowed Roles)
export const PATH_PERMISSIONS: Record<string, Role[]> = {
  "/admin": ["admin"],
  "/sales": ["admin", "sales"],
  "/clients": ["admin", "sales"],
  "/accounts/audit": ["admin"],
  "/accounts/payroll": ["admin", "accountant"],
  "/accounts": ["admin", "accountant", "sales"], // Sales can view accounts pipeline
  "/operations": ["admin", "engineer", "field"],
  "/review": ["admin", "engineer"],
  "/engineer": ["admin", "engineer"],
  "/field": ["admin", "field"],
  "/eod": ["admin", "sales", "accountant", "engineer", "field", "hr"],
  "/sop": ["admin", "sales", "accountant", "engineer", "field", "hr"],
  "/leaves": ["admin", "sales", "accountant", "engineer", "field", "hr"],
  "/projects": ["admin", "sales", "accountant", "engineer", "field", "hr"],
  "/equipments": ["admin", "engineer"],
  "/hr": ["admin", "hr"],
  "/developer": ["developer"],
};
