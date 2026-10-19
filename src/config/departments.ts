export interface DesignationConfig {
  id: string;
  name: string;
  systemRole: "admin" | "sales" | "accountant" | "engineer" | "field" | "hr";
}

export interface DepartmentConfig {
  id: string;
  name: string;
  designations: DesignationConfig[];
}

export const DEPARTMENTS: DepartmentConfig[] = [
  {
    id: "operations",
    name: "Operations Department",
    designations: [
      { id: "accountant", name: "Accountant", systemRole: "accountant" },
      { id: "hr", name: "HR", systemRole: "hr" },
      { id: "sales", name: "Sales", systemRole: "sales" },
    ]
  },
  {
    id: "Engineer",
    name: "Engineer Department",
    designations: [
      { id: "engineer", name: "engineer", systemRole: "engineer" },

    ]
  },
  {
    id: "survey",
    name: "Survey Department",
    designations: [
      { id: "recon_eng", name: "Reconciliation Engineer", systemRole: "engineer" },
      { id: "field_surveyor", name: "Field Surveyor", systemRole: "field" },
    ]
  },
  {
    id: "design",
    name: "Design Department",
    designations: [
      { id: "design_eng", name: "Design Engineer", systemRole: "engineer" },
      { id: "lidar_specialist", name: "Lidar Specialist", systemRole: "engineer" },
    ]
  }
];

export function getDesignationsForDepartment(deptId: string): DesignationConfig[] {
  return DEPARTMENTS.find((d: any) => d.id === deptId)?.designations || [];
}

export function getSystemRoleForDesignation(deptId: string, designationId: string): "admin" | "sales" | "accountant" | "engineer" | "field" | "hr" {
  const dept = DEPARTMENTS.find((d: any) => d.id === deptId);
  const desig = dept?.designations.find((r: any) => r.id === designationId);
  return (desig?.systemRole as "admin" | "sales" | "accountant" | "engineer" | "field" | "hr") || "engineer";
}
