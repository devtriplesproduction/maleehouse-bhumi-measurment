'use server'

import { revalidatePath } from 'next/cache'
import { logWorkflowAudit } from "@/lib/workflow/logWorkflowAudit"
import { createClient } from '@/lib/supabase/server'

import { getUserProfileAction } from '@/actions/auth.actions'
import { notifyAssignmentAction } from '@/actions/notification.actions'

function generateId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
}

export async function assignUserToProjectAction(projectId: string, userId: string, role: string) {
  try {
    const profile: any = await getUserProfileAction()
    const supabase: any = await createClient()

    let { data: existing } = await supabase
      .from('project_assignments')
      .select('id')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .maybeSingle()

    if (!existing) {
      const { data: newAssignment, error } = await supabase
        .from('project_assignments')
        .insert({
          id: generateId("asg"),
          project_id: projectId,
          user_id: userId,
          role,
          assigned_by: profile?.id ?? null,
          assigned_at: new Date().toISOString()
        })
        .select('*, profiles:user_id(id, first_name, last_name, email, role)')
        .single()
      if (error) return { success: false, error: error.message || 'Insert error' }
      
      existing = newAssignment
    } else {
      const { data: updatedAssignment, error } = await supabase
        .from('project_assignments')
        .update({ role, assigned_by: profile?.id ?? null, assigned_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select('*, profiles:user_id(id, first_name, last_name, email, role)')
        .single()
      if (error) return { success: false, error: error.message || 'Update error' }
      
      existing = updatedAssignment
    }

    if (profile) {
      await logWorkflowAudit(supabase, projectId, profile.id, `Assigned ${role} (user: ${userId}) to project`)

      await supabase.from('activity_logs').insert({
        project_id: projectId,
        user_id: profile.id,
        action: 'USER_ASSIGNED',
        details: { assigned_user: userId, role },
        created_at: new Date().toISOString()
      })
    }

    try {
      await notifyAssignmentAction(userId, projectId, role)
    } catch (e) {
      console.error('Failed to notify assigned user', e)
    }

    // Auto-advance workflow if assigning field team during field_assigned stage
    if (role === 'field') {
      const { data: projectData } = await supabase
        .from('projects')
        .select('status')
        .eq('id', projectId)
        .single();
        
      if (projectData?.status === 'field_assigned') {
        const { updateProjectStageAction } = await import('@/actions/workflow.actions');
        await updateProjectStageAction(
          projectId, 
          'field_work', 
          'Field Engineer assigned. Survey Collection started.'
        );
      }
    }

    revalidatePath(`/projects/${projectId}`)
    revalidatePath('/engineer')
    revalidatePath('/field')
    return { success: true, data: existing, error: null }
  } catch (err) {
    console.error('assignUserToProjectAction error:', err)
    return { success: false, error: 'Failed to assign user to project' }
  }
}

export async function removeUserFromProjectAction(assignmentId: string, projectId: string) {
  try {
    const supabase: any = await createClient()

    const { error } = await supabase
      .from('project_assignments')
      .delete()
      .eq('project_id', projectId)
      .or(`id.eq.${assignmentId},user_id.eq.${assignmentId}`)

    if (error) return { success: false, error: error.message }

    revalidatePath(`/projects/${projectId}`)
    revalidatePath('/engineer')
    revalidatePath('/field')
    return { success: true, error: null }
  } catch (err) {
    console.error('removeUserFromProjectAction error:', err)
    return { success: false, error: 'Failed to remove user from project' }
  }
}
