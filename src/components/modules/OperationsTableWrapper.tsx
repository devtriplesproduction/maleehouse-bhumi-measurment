import { createClient } from '@/lib/supabase/server';
import { OperationsTable } from './OperationsTable';
import { SyncErrorState } from './SyncErrorState';

export async function OperationsTableWrapper() {
  const supabase: any = await createClient();
  
  // Fetch projects in operational stages with their assignments and latest files
  const { data: projects, error } = await supabase
    .from('projects')
    .select(`
      id,
      name,
      client_name,
      status,
      target_completion_date,
      created_at,
      updated_at,
      is_frozen,
      project_assignments (
        id,
        user_id,
        role,
        profiles:user_id (
          first_name,
          last_name,
          role
        )
      ),
      files (
        id,
        category,
        file_name,
        uploaded_at
      )
    `)
    .neq('status', 'archived')
    .neq('id', 'PRJ-PRINT-DESK')
    .is('deleted_at', null)
    .order('updated_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('Error fetching operations data:', error);
    return <SyncErrorState />;
  }

  return <OperationsTable initialProjects={projects || []} />;
}
