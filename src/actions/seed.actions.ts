"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * seedTestingAccountsAction
 * Provisions local JSON files with initial mock data for seamless development and testing.
 * Rewritten to use Supabase instead.
 */
export async function seedTestingAccountsAction() {
  try {
    if (process.env.NODE_ENV === 'production') {
      return { success: false, error: 'Seed actions are disabled in production.' };
    }
    const supabase: any = await createClient();

    // 2. Seed Projects if none exist
    const { data: currentProjects, error: countError } = await supabase
      .from('projects')
      .select('id')
      .limit(1);

    if (!countError && (!currentProjects || currentProjects.length === 0)) {
      const mockProjects = [
        {
          id: "PRJ-9821-4321",
          name: "Orchard Heights Boundary Survey",
          client_name: "Orchard Properties Ltd",
          client_contact: "Phone: +65 9123 4567, Email: orchard@properties.sg",
          client_address: "12 Orchard Road, Singapore 238841",
          site_type: "commercial",
          site_coordinates: "1.3026° N, 103.8352° E",
          survey_requirements: "Full boundary demarcation, topographic mapping, and utility corridor identification.",
          services: ["topographical", "boundary"],
          target_completion_date: "2026-06-30",
          status: "lead_created",
          created_by: "usr-sales-01",
          created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
          deleted_at: null,
          requirement_checklist: {}
        },
        {
          id: "PRJ-5412-8765",
          name: "Marina South QC Verification",
          client_name: "Apex Infrastructure",
          client_contact: "Phone: +65 6789 0123, Email: info@apexinfra.com",
          client_address: "5 Marina Gardens Drive, Singapore 018953",
          site_type: "industrial",
          site_coordinates: "1.2815° N, 103.8636° E",
          survey_requirements: "High-precision structural monitoring and alignment validation.",
          services: ["engineering", "monitoring"],
          target_completion_date: "2026-07-15",
          status: "project_created",
          created_by: "usr-sales-01",
          created_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
          updated_at: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
          deleted_at: null,
          requirement_checklist: {}
        }
      ];
      
      await supabase.from('projects').insert(mockProjects);

      // Seed Assignments
      const mockAssignments = [
        {
          id: "asg-01",
          project_id: "PRJ-5412-8765",
          user_id: "usr-engineer-01",
          role: "engineer",
          assigned_at: new Date().toISOString()
        },
        {
          id: "asg-02",
          project_id: "PRJ-5412-8765",
          user_id: "usr-field-01",
          role: "field",
          assigned_at: new Date().toISOString()
        }
      ];
      await supabase.from('project_assignments').insert(mockAssignments);
    }

    revalidatePath("/admin");
    return { success: true, results: [{ email: "all-accounts", status: "Seeded Successfully" }] };
  } catch (err: any) {
    console.error("Failed to seed databases:", err);
    return { success: false, error: err.message };
  }
}
