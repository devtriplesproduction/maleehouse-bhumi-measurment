import { z } from 'zod';

export const leadStatusSchema = z.enum([
  'New Lead',
  'Contacted',
  'Requirement Gathering',
  'Follow-up Pending',
  'Commercial Finalized',
  'Negotiation',
  'Won',
  'Lost',
  'On Hold'
]);

export const followUpStatusSchema = z.enum([
  'Call Back',
  'Interested',
  'Not Reachable',
  'Waiting for Documents',
  'Commercial Pending',
  'Negotiation',
  'Closed'
]);

export const createLeadSchema = z.object({
  client_name: z.string().min(2, 'Client name is required'),
  company_name: z.string().optional(),
  phone: z.string().min(10, 'Valid phone number is required'),
  whatsapp: z.string().optional(),
  email: z.string().email('Invalid email address').optional().or(z.literal('')),
  address: z.string().min(5, 'Address is required'),
  city: z.string().min(2, 'City is required'),
  state: z.string().min(2, 'State is required'),
  lead_source: z.string().optional(),
  priority: z.enum(['Low', 'Medium', 'High', 'Urgent']).default('Medium'),
  assigned_sales_person: z.string().uuid('Invalid user ID'),
  
  // Requirement Collection
  project_type: z.string().min(2, 'Project type is required'),
  site_address: z.string().min(5, 'Site address is required'),
  survey_type: z.string().min(2, 'Survey type is required'),
  plot_area: z.string().optional(),
  deadline: z.string().optional(),
  project_notes: z.string().optional(),
  special_instructions: z.string().optional(),
});

export const followUpSchema = z.object({
  project_id: z.string().uuid(),
  next_follow_up_date: z.string().min(1, 'Follow-up date is required'),
  status: followUpStatusSchema,
  outcome: z.string().optional(),
  notes: z.string().optional(),
});

export type CreateLeadInput = z.infer<typeof createLeadSchema>;
export type FollowUpInput = z.infer<typeof followUpSchema>;
export type LeadStatus = z.infer<typeof leadStatusSchema>;
export type FollowUpStatus = z.infer<typeof followUpStatusSchema>;
