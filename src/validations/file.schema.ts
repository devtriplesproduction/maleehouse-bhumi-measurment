import { z } from 'zod';

export const registerFileSchema = z.object({
  project_id: z.string().min(1), // Supporting both UUID and custom string IDs
  category: z.enum(['receipt', 'requirements', 'survey_data', 'final_file', 'control_point_image', 'control_point_csv']),
  file_name: z.string().min(1),
  file_url: z.string().url(),
  mime_type: z.string(),
  file_size: z.number().max(50 * 1024 * 1024, "File size exceeds 50MB limit"),
  storage_bucket: z.string().optional(),
});

export type RegisterFileInput = z.infer<typeof registerFileSchema>;
