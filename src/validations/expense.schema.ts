import { z } from 'zod';

export const EXPENSE_CATEGORIES = [
  'Travelling (Petrol)(Per 50Km)',
  'Accomodation',
  'Food & Breakfast',
  'Vehicle Maintance',
  'Paint',
  'Fakki',
  'Other Field Expences',
  'Other Designing Expences',
  'Other Submission Exp',
  'Submission Travel',
  'Equipment Rent (DGPS)',
  'Equipment Rent (Drone)',
  'Equipment Rent (Lidar)',
  'Data Processing Cost (DGPS)',
  'Data Processing Cost(Drone)',
  'Data Processing Cost (Lidar)',
  'Computer Cost',
  'Printing/Xerox',
  'Stationary'
] as const;

export const createExpenseSchema = z.object({
  project_id: z.string().nullable().optional(),
  category: z.enum(EXPENSE_CATEGORIES, {
    errorMap: () => ({ message: "Invalid category selected" })
  }),
  description: z.string().min(1, 'Description is required'),
  amount: z.number().positive('Amount must be positive'),
  expense_date: z.string().min(1, 'Expense date is required'),
  receipt_url: z.string().url('Invalid receipt URL').or(z.literal('')).nullable().optional(),
  bank_id: z.string().uuid('Invalid bank account').optional(),
});

export const updateExpenseSchema = z.object({
  id: z.string().uuid('Invalid Expense ID'),
  project_id: z.string().nullable().optional(),
  category: z.enum(EXPENSE_CATEGORIES, {
    errorMap: () => ({ message: "Invalid category selected" })
  }).optional(),
  description: z.string().min(1, 'Description is required').optional(),
  amount: z.number().positive('Amount must be positive').optional(),
  expense_date: z.string().optional(),
  receipt_url: z.string().url('Invalid receipt URL').or(z.literal('')).nullable().optional(),
  bank_id: z.string().uuid('Invalid bank account').optional(),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;
export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;

export const createProjectBudgetItemSchema = z.object({
  project_id: z.string().min(1, 'Project ID is required'),
  section: z.string().min(1, 'Section is required'),
  particulars: z.string().min(1, 'Particulars are required'),
  qty: z.number().positive().optional().nullable(),
  rate: z.number().nonnegative().optional().nullable(),
  days: z.number().positive().optional().nullable(),
  amount: z.number().nonnegative()
});

export type CreateProjectBudgetItemInput = z.infer<typeof createProjectBudgetItemSchema>;
