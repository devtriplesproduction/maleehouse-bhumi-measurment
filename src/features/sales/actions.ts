'use server';

import { revalidatePath } from 'next/cache';
import { ActionResponse } from '@/actions/project.actions';
import { getUserProfileAction } from '@/actions/auth.actions';
import { createClient } from '@/lib/supabase/server';
import { revalidateAccountsPaths } from '@/actions/revalidate-utils';
import { notifyFollowUpScheduledAction } from '@/actions/notification.actions';

export async function getLeadsAction(): Promise<ActionResponse> {
  try {
    const profile = await getUserProfileAction();
    if (!profile) return { success: false, error: 'Unauthorized' };

    const supabase: any = await createClient();
    const { data: leads, error } = await supabase
      .from('projects')
      .select('id, name, client_name, client_contact, client_address, status, priority, created_at, updated_at, created_by')
      .eq('status', 'lead_created')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(200);

    if (error) return { success: false, error: error.message };

    return { success: true, data: leads };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateLeadStatusAction(projectId: string, status: string): Promise<ActionResponse> {
  try {
    const profile = await getUserProfileAction();
    if (!profile) return { success: false, error: 'Unauthorized' };

    const supabase: any = await createClient();
    const { data: updated, error } = await supabase
      .from('projects')
      .update({
        status: status,
        updated_at: new Date().toISOString()
      })
      .eq('id', projectId)
      .select()
      .single();

    if (error) return { success: false, error: 'Project not found or update failed.' };

    await revalidateAccountsPaths(projectId);
    return { success: true, data: updated };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getClientsAction(): Promise<ActionResponse> {
  try {
    const profile = await getUserProfileAction();
    if (!profile) return { success: false, error: 'Unauthorized' };

    const supabase: any = await createClient();
    const { data: activeProjects, error } = await supabase
      .from('projects')
      .select('id, client_name, client_contact, client_address, name, status, created_at')
      .is('deleted_at', null)
      .neq('id', 'PRJ-PRINT-DESK')
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) return { success: false, error: error.message };
    
    const clientsMap = new Map();
    for (const item of activeProjects || []) {
      if (!clientsMap.has(item.client_name)) {
        clientsMap.set(item.client_name, {
          client_name: item.client_name,
          client_contact: item.client_contact || "No contact info",
          client_address: item.client_address || "No address provided",
          created_at: item.created_at || new Date().toISOString(),
          projects: []
        });
      }
      const clientObj = clientsMap.get(item.client_name);
      
      // Update created_at to earliest if needed
      if (item.created_at && new Date(item.created_at).getTime() < new Date(clientObj.created_at).getTime()) {
        clientObj.created_at = item.created_at;
      }
      
      clientObj.projects.push({
        id: item.id,
        name: item.name,
        status: item.status,
        created_at: item.created_at
      });
    }

    return { success: true, data: Array.from(clientsMap.values()) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function recordFollowUpAction(
  projectId: string, 
  nextDate: string, 
  status: string, 
  outcome: string,
  userTimezone?: string
): Promise<ActionResponse> {
  try {
    const profile = await getUserProfileAction();
    if (!profile) return { success: false, error: 'Unauthorized' };

    const supabase: any = await createClient();

    const taskId = `tsk-${crypto.randomUUID()}`;
    const commentId = `cmt-${crypto.randomUUID()}`;

    // 1. Handle the task for the next follow-up
    const { data: existingTasks } = await supabase
      .from('tasks')
      .select('id')
      .eq('project_id', projectId)
      .eq('status', 'pending')
      .like('title', 'Follow-up:%')
      .limit(1);

    if (existingTasks && existingTasks.length > 0) {
      const { error: taskError } = await supabase.from('tasks').update({
        assigned_to: profile.id,
        title: `Follow-up: ${status}`,
        due_date: nextDate
      }).eq('id', existingTasks[0].id);
      if (taskError) console.error("Task Update Error:", taskError);
    } else {
      const { error: taskError } = await supabase.from('tasks').insert({
        id: taskId,
        project_id: projectId,
        assigned_to: profile.id,
        title: `Follow-up: ${status}`,
        due_date: nextDate,
        status: 'pending'
      });
      if (taskError) console.error("Task Insert Error:", taskError);
    }

    // 2. Record the outcome as a comment
    const { error: commentError } = await supabase.from('comments').insert({
      id: commentId,
      project_id: projectId,
      user_id: profile.id,
      content: `Follow-up Outcome: ${outcome}\nStatus: ${status}\nNext Date: ${nextDate}`,
      comment_type: 'follow_up',
      created_at: new Date().toISOString(),
      parent_comment_id: null
    });
    if (commentError) console.error("Comment Insert Error:", commentError);

    // 3. Update project last updated & status
    await supabase.from('projects').update({
      status: 'requirement_gathering',
      follow_up_date: nextDate,
      updated_at: new Date().toISOString()
    }).eq('id', projectId);

    // 4. Send notification for the scheduled follow-up
    await notifyFollowUpScheduledAction(projectId, nextDate, status, profile.id, userTimezone);

    await revalidateAccountsPaths(projectId);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function finalizeRequirementsAction(projectId: string): Promise<ActionResponse> {
  try {
    const profile = await getUserProfileAction();
    if (!profile) return { success: false, error: 'Unauthorized' };

    const supabase: any = await createClient();

    // 1. Update project status to payment_pending
    const { error: updateError } = await supabase.from('projects').update({
      status: 'payment_pending',
      updated_at: new Date().toISOString()
    }).eq('id', projectId);

    if (updateError) return { success: false, error: 'Project not found or update failed.' };

    // 2. Log activity
    await supabase.from('activity_logs').insert({
      project_id: projectId,
      user_id: profile.id,
      action: 'REQUIREMENTS_FINALIZED',
      details: { message: 'Sales finalized requirements. Transitioned to payment pending.' },
      created_at: new Date().toISOString()
    });

    await revalidateAccountsPaths(projectId);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateClientDetailsAction(
  oldClientName: string,
  newDetails: { client_name: string; client_contact: string; client_address: string }
): Promise<ActionResponse> {
  try {
    const profile = await getUserProfileAction();
    if (!profile) return { success: false, error: 'Unauthorized' };

    const supabase: any = await createClient();

    const { data: updatedProjects, error } = await supabase
      .from('projects')
      .update({
        client_name: newDetails.client_name,
        client_contact: newDetails.client_contact,
        client_address: newDetails.client_address,
        updated_at: new Date().toISOString()
      })
      .eq('client_name', oldClientName)
      .select('id');

    if (error) return { success: false, error: error.message };

    if (updatedProjects && updatedProjects.length > 0) {
      revalidatePath('/clients');
    }

    return { success: true, data: { updatedCount: updatedProjects?.length || 0 } };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
