import * as z from "zod";

export const onboardSchema = z.object({
  // Personal Info (Step 1)
  first_name: z.string().min(2, "First name is too short"),
  last_name: z.string().min(1, "Last name is required"),
  dob: z.string().optional(),
  gender: z.enum(["male", "female", "other"]).default("male"),
  phone_number: z.string().regex(/^\d{10}$/, "Phone number must be exactly 10 digits").or(z.literal("")),
  personal_email: z.string().email("Invalid personal email").min(1, "Personal email is required"),
  address: z.string().optional(),
  emergency_contact: z.string().optional(),
  emergency_name: z.string().optional(),
  emergency_relationship: z.string().optional(),
  emergency_phone: z.string().optional(),
  profile_photo: z.string().optional(),

  // Professional Info (Step 2)
  department: z.string().min(1, "Department is required"),
  designation: z.string().min(1, "Role/Designation is required"),
  employment_type: z.enum(["full-time", "part-time", "contract", "intern"]).default("full-time"),
  salary: z.coerce.number().min(0, "Salary must be non-negative").default(0),
  experience: z.coerce.number().min(0, "Experience must be non-negative").default(0),
  joining_date: z.string(),
  location: z.enum(["office", "remote", "hybrid"]).default("office"),

  // Login & Access (Step 4)
  email: z.string().email("Invalid work email"),
  role: z.enum(["admin", "sales", "accountant", "engineer", "field", "hr", "employee"]).default("employee"),
  employee_id: z.string().min(4, "Employee ID is required"),
  status: z.enum(["active", "suspended", "onboarding_pending", "resigned", "archived"]).default("onboarding_pending"),
  reporting_manager: z.string().optional(),
  department_head: z.boolean().default(false),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[0-9]/, "Password must contain at least one number")
    .regex(/[^a-zA-Z0-9]/, "Password must contain at least one special character"),
  confirm_password: z.string().min(8, "Password must be at least 8 characters"),
}).refine((data) => data.password === data.confirm_password, {
  message: "Passwords do not match",
  path: ["confirm_password"],
});

export type OnboardFormData = z.infer<typeof onboardSchema>;
