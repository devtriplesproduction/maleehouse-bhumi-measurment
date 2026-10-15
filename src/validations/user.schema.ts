import * as z from "zod";

export const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export type LoginInput = z.infer<typeof loginSchema>;

export const profileSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  role: z.enum(["admin", "sales", "accountant", "engineer", "field", "hr", "employee"]),
  is_active: z.boolean().default(true),
});

export type Profile = z.infer<typeof profileSchema>;
