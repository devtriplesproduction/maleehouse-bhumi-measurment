'use server';

import { normalizeData } from '@/lib/normalize';

import { checkActionRateLimit } from '@/lib/rate-limit';

import { revalidatePath } from 'next/cache';
import { createProjectSchema, type CreateProjectInput } from '@/validations/project.schema';
import { getUserProfileAction } from './auth.actions';
import { verifyProjectAccess, requireAuthContext, getAssignedProjectIds, type Role } from '@/lib/permissions/permissions';
import { revalidateAccountsPaths } from '@/actions/revalidate-utils';
import { generateSequentialCode } from '@/lib/id-generator';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { randomUUID } from 'crypto';
import { createAuditLog } from '@/lib/audit/createAuditLog';

export type ActionResponse<T = any> = {
  success: boolean;
  data?: T;
  error?: string;
};

export async function createProjectAction(payload: CreateProjectInput): Promise<ActionResponse> {
  try {
    const validatedFields = createProjectSchema.safeParse(payload);

    if (!validatedFields.success) {
      return {
        success: false,
        error: validatedFields.error.errors[0]?.message || 'Validation failed.'
      };
    }

    const { name, client_name, target_completion_date, phone, email, state_code, gst_number } = validatedFields.data;

    const contactInfo = validatedFields.data.client_contact ||
      `Phone: ${phone}${email ? `, Email: ${email}` : ''}`;

    const profile: any = await getUserProfileAction();
    if (!profile) {
      return { success: false, error: 'Unauthorized. Please log in.' };
    }

    if (!(await checkActionRateLimit(profile.id, 'createProjectAction', 15, 60 * 1000))) {
      return { success: false, error: 'Rate limit exceeded for this action. Please try again later.' };
    }

    if (profile.role !== 'admin' && profile.role !== 'sales' && profile.role !== 'accountant') {
      return { success: false, error: 'Only Sales, Admin, or Accountant can create projects.' };
    }

    const supabase: any = await createClient();

    // Use PRJ-(State Code)-XXX format
    const explicitPrefix = `PRJ-${state_code}-`;

    const { data: existingProjects, error: fetchError } = await supabase
      .from('projects')
      .select('id')
      .ilike('id', `${explicitPrefix}%`);

    if (fetchError) throw fetchError;

    const existingIds = (existingProjects || []).map((p: any) => p.id);
    const projectId = generateSequentialCode('PRJ', existingIds, undefined, explicitPrefix);

    const baseCommercialAmount = Number(validatedFields.data.amount || 0);
    const gstType = validatedFields.data.gst_type || 'no_gst';
    let gstRate = 0;
    if (gstType === 'cgst_sgst_2_5') {
      gstRate = 5; // 2.5% CGST + 2.5% SGST
    } else if (gstType === 'cgst_sgst_5') {
      gstRate = 10; // 5% CGST + 5% SGST
    }
    const calculatedGstAmount = Math.round((baseCommercialAmount * gstRate) / 100);
    const totalContractAmount = baseCommercialAmount + calculatedGstAmount;

    const initialStatus = totalContractAmount > 0 ? 'payment_pending' : 'lead_created';
    const bankAccountId = validatedFields.data.bank_account_id || null;
    const paymentMethod = validatedFields.data.payment_method || 'bank_transfer';

    const newProject = {
      id: projectId,
      name: validatedFields.data.name,
      client_name: validatedFields.data.client_name,
      gst_number: validatedFields.data.gst_number || null,
      client_contact: contactInfo,
      client_address: validatedFields.data.client_address || '',
      site_type: validatedFields.data.site_type || 'residential',
      site_coordinates: validatedFields.data.site_coordinates || '',
      survey_requirements: validatedFields.data.survey_requirements || '',
      services: validatedFields.data.services || [],
      budget: totalContractAmount,
      target_completion_date: validatedFields.data.target_completion_date || null,
      status: initialStatus,
      created_by: profile.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
      requirement_checklist: {
        bank_account_id: bankAccountId,
        payment_method: paymentMethod,
        gst_type: gstType,
        gst_rate: gstRate,
        base_amount: baseCommercialAmount,
        gst_amount: calculatedGstAmount,
        total_amount: totalContractAmount,
      }
    };

    const { error: insertError } = await supabase.from('projects').insert([newProject]);
    if (insertError) throw insertError;

    // Direct Commercial Setup: initialize project_finances
    if (totalContractAmount > 0) {
      await supabase.from('project_finances').upsert({
        project_id: projectId,
        total_quoted_amount: totalContractAmount,
        total_invoiced_amount: 0,
        total_paid_amount: 0,
        currency: 'INR',
        updated_at: new Date().toISOString()
      }, { onConflict: 'project_id' });
    }

    // Direct Milestones Setup: create project_milestones
    const milestones = validatedFields.data.milestones || [];
    if (milestones.length > 0) {
      const milestoneRows = milestones.map((m: any, idx: number) => ({
        id: m.id && !m.id.startsWith('temp-') ? m.id : `mil-${Date.now()}-${Math.random().toString(36).substring(2, 6)}-${idx}`,
        project_id: projectId,
        title: m.title,
        description: m.description || null,
        amount: Number(m.amount) || 0,
        due_date: m.due_date || null,
        linked_stage: m.linked_stage || null,
        is_activation_gate: Boolean(m.is_activation_gate),
        status: 'pending',
        is_compulsory: false,
        sort_order: idx + 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      const { error: milError } = await supabase.from('project_milestones').insert(milestoneRows);
      if (milError) {
        console.error('Failed to create project milestones at creation:', milError);
      }
    } else if (totalContractAmount > 0) {
      const methodLabel = paymentMethod.replace('_', ' ').toUpperCase();
      const gstLabel = gstType === 'no_gst' ? 'No GST' : gstType === 'cgst_sgst_2_5' ? '2.5% CGST + 2.5% SGST' : '5% CGST + 5% SGST';
      await supabase.from('project_milestones').insert([{
        id: `mil-${Date.now()}-${Math.random().toString(36).substring(2, 6)}-0`,
        project_id: projectId,
        title: 'Mobilization / Advance Payment',
        description: `Initial project milestone (${methodLabel} - ${gstLabel})`,
        amount: totalContractAmount,
        due_date: validatedFields.data.target_completion_date || null,
        linked_stage: null,
        is_activation_gate: true,
        status: 'pending',
        is_compulsory: false,
        sort_order: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }]);
    }

    const methodDisplay = paymentMethod.replace('_', ' ');
    const gstDisplay = gstType === 'no_gst' ? 'No GST' : gstType === 'cgst_sgst_2_5' ? '2.5% CGST + 2.5% SGST' : '5% CGST + 5% SGST';
    await supabase.from("workflow_history").insert({
      project_id: projectId,
      from_stage: null,
      to_stage: initialStatus,
      changed_by: profile.id,
      comment: `Project created with commercial total ₹${totalContractAmount.toLocaleString('en-IN')} (Base: ₹${baseCommercialAmount.toLocaleString('en-IN')}, GST: ${gstDisplay}, Mode: ${methodDisplay}).`,
      created_at: new Date().toISOString()
    });

    await supabase.from("activity_logs").insert({
      project_id: projectId,
      user_id: profile.id,
      action: "PROJECT_CREATED",
      details: { 
        name: validatedFields.data.name, 
        client_name: validatedFields.data.client_name,
        amount: totalContractAmount,
        base_amount: baseCommercialAmount,
        gst_type: gstType,
        gst_rate: gstRate,
        gst_amount: calculatedGstAmount,
        bank_account_id: bankAccountId,
        payment_method: paymentMethod,
        milestones_count: milestones.length || (totalContractAmount > 0 ? 1 : 0)
      },
      created_at: new Date().toISOString()
    });

    await createAuditLog({
      action: 'PROJECT_CREATED',
      module: 'Projects',
      entityType: 'Project',
      entityId: projectId,
      description: `Created project: ${validatedFields.data.name} (Amount: INR ${totalContractAmount})`,
      newValue: newProject,
    });

    await revalidateAccountsPaths(projectId);
    revalidatePath('/projects');
    revalidatePath('/operations');
    revalidatePath('/accounts/milestones');
    revalidatePath('/admin/milestones');

    return { success: true, data: normalizeData(newProject) };
  } catch (error: any) {
    console.error('Unexpected error creating project:', error);
    return { success: false, error: error?.message || 'An unexpected error occurred.' };
  }
}

export async function updateProjectAction(
  projectId: string,
  payload: any
): Promise<ActionResponse> {
  try {
    const profile: any = await getUserProfileAction();
    if (!profile) return { success: false, error: 'Unauthorized' };
    
    if (!(await checkActionRateLimit(profile.id, 'updateProjectAction', 30, 60 * 1000))) {
      return { success: false, error: 'Rate limit exceeded for this action. Please try again later.' };
    }


    const role = profile.role as Role;

    if (role !== 'admin' && role !== 'sales' && role !== 'engineer' && role !== 'accountant') {
      return { success: false, error: 'Access denied.' };
    }

    const requireAssignment = role === 'engineer';
    const accessCheck = await verifyProjectAccess(projectId, profile.id, role, requireAssignment);
    if (!accessCheck.isAllowed) {
      return { success: false, error: accessCheck.error || "Access denied." };
    }

    const supabase: any = await createClient();
    
    // Get old value for audit log
    const { data: oldProject } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();

    const { data: updated, error } = await supabase
      .from('projects')
      .update({
        ...payload,
        updated_at: new Date().toISOString()
      })
      .eq('id', projectId)
      .select()
      .single();

    if (error || !updated) return { success: false, error: error?.message || 'Project not found' };

    await createAuditLog({
      action: 'PROJECT_UPDATED',
      module: 'Projects',
      entityType: 'Project',
      entityId: projectId,
      description: `Updated project: ${updated.name}`,
      oldValue: oldProject,
      newValue: updated,
    });

    await revalidateAccountsPaths(projectId);

    return { success: true, data: normalizeData(updated) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteProjectAction(projectId: string): Promise<ActionResponse> {
  try {
    const profile: any = await getUserProfileAction();
    if (!profile) return { success: false, error: 'Unauthorized' };

    if (profile.role !== 'admin' && profile.role !== 'accountant') {
      return { success: false, error: 'Only administrators or accountants can delete projects.' };
    }

    const supabase: any = await createClient();
    
    // Get old value for audit log
    const { data: oldProject } = await supabase
      .from('projects')
      .select('*')
      .eq('id', projectId)
      .single();
      
    const { data: updated, error } = await supabase
      .from('projects')
      .delete()
      .eq('id', projectId)
      .select();

    if (error) return { success: false, error: error.message };
    if (!updated || updated.length === 0) return { success: false, error: 'Project not found' };

    await createAuditLog({
      action: 'PROJECT_DELETED',
      module: 'Projects',
      entityType: 'Project',
      entityId: projectId,
      description: `Deleted project: ${oldProject?.name || projectId}`,
      oldValue: oldProject,
    });

    await revalidateAccountsPaths(projectId);

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getSalesPipelineAction(): Promise<ActionResponse> {
  try {
    const profile: any = await getUserProfileAction();
    if (!profile || (profile.role !== 'admin' && profile.role !== 'sales')) {
      return { success: false, error: 'Unauthorized access to Sales Pipeline.' };
    }

    const supabase: any = await createClient();

    const PIPELINE_STATUSES = [
      'lead_created',
      'requirement_gathering',
      'payment_pending',
    ];

    const { data: projects, error: pError } = await supabase
      .from('projects')
      .select(
        'id, name, client_name, client_contact, client_address, status, priority, created_at, updated_at, created_by, target_completion_date'
      )
      .in('status', PIPELINE_STATUSES)
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(200);

    if (pError) throw pError;

    const projectIds = (projects || []).map((p: any) => p.id);
    if (projectIds.length === 0) return { success: true, data: [] };

    const [{ data: tasks }, { data: comments }] = await Promise.all([
      supabase
        .from('tasks')
        .select('id, project_id, title, due_date, status')
        .eq('status', 'pending')
        .in('project_id', projectIds)
        .ilike('title', 'Follow-up%')
        .order('due_date', { ascending: true }),
      supabase
        .from('comments')
        .select('project_id, content, created_at')
        .eq('comment_type', 'follow_up')
        .in('project_id', projectIds)
        .order('created_at', { ascending: false })
        .limit(400),
    ]);

    const tasksByProject = new Map<string, any[]>();
    (tasks || []).forEach((t: any) => {
      const list = tasksByProject.get(t.project_id) || [];
      list.push(t);
      tasksByProject.set(t.project_id, list);
    });

    const commentsByProject = new Map<string, any[]>();
    (comments || []).forEach((c: any) => {
      const list = commentsByProject.get(c.project_id) || [];
      list.push(c);
      commentsByProject.set(c.project_id, list);
    });

    const pipeline = (projects || []).map((p: any) => {
      const pTasks = tasksByProject.get(p.id) || [];
      const pComments = commentsByProject.get(p.id) || [];
      let latestFollowUpStatus = '';
      let latestOutcome = '';

      if (pComments.length > 0) {
        const latestContent = pComments[0].content || '';
        const contentLines = latestContent.split('\n');
        const outcomeLine = contentLines.find((l: string) => l.trim().startsWith('Follow-up Outcome:'));
        const statusLine = contentLines.find((l: string) => l.trim().startsWith('Status:'));

        latestOutcome = outcomeLine ? outcomeLine.replace(/Follow-up Outcome:\s*/, '').trim() : '';
        latestFollowUpStatus = statusLine ? statusLine.replace(/Status:\s*/, '').trim() : '';

        if (!latestOutcome && !latestFollowUpStatus) {
          if (latestContent.includes('Follow-up Outcome: ')) {
            latestOutcome = latestContent.replace('Follow-up Outcome: ', '').split('\n')[0] || '';
            latestFollowUpStatus = latestContent.split('\n')[1]?.replace('Status: ', '') || 'Follow Up';
          } else {
            latestOutcome = latestContent;
            latestFollowUpStatus = 'Follow Up';
          }
        }
      }

      return {
        ...p,
        follow_up_date: pTasks[0]?.due_date || null,
        latest_follow_up_status: latestFollowUpStatus,
        latest_outcome: latestOutcome,
      };
    });

    return { success: true, data: normalizeData(pipeline) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getPaymentProjectsAction(): Promise<ActionResponse> {
  try {
    const profile: any = await getUserProfileAction();
    if (!profile || (profile.role !== 'admin' && profile.role !== 'accountant' && profile.role !== 'sales')) {
      return { success: false, error: 'Unauthorized access to Payment center.' };
    }

    const supabase: any = await createClient();
    const { data: paymentProjects, error } = await supabase
      .from('projects')
      .select('*')
      .in('status', ['payment_pending', 'payment_done'])
      .is('deleted_at', null)
      .order('updated_at', { ascending: false });

    if (error) throw error;

    return { success: true, data: normalizeData(paymentProjects) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getReviewProjectsAction(): Promise<ActionResponse> {
  try {
    const auth = await requireAuthContext();
    if (auth.error) return { success: false, error: auth.error };

    const { userId, role } = auth;
    if (role !== 'admin' && role !== 'engineer') {
      return { success: false, error: 'Unauthorized access to Review center.' };
    }

    const assignedIds = await getAssignedProjectIds(userId, role);
    if (assignedIds !== null && assignedIds.length === 0) {
      return { success: true, data: [] };
    }

    const supabase: any = await createClient();
    let query = supabase
      .from('projects')
      .select('*')
      .in('status', ['review', 'final_review'])
      .is('deleted_at', null)
      .order('updated_at', { ascending: false });

    if (assignedIds !== null) {
      query = query.in('id', assignedIds);
    }

    const { data: reviewProjects, error } = await query;
    if (error) throw error;

    return { success: true, data: normalizeData(reviewProjects) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function assignUserAction(
  projectId: string,
  userId: string,
  role: string
): Promise<ActionResponse> {
  try {
    const profile: any = await getUserProfileAction();
    if (!profile) return { success: false, error: "Unauthorized" };

    if (profile.role !== 'admin') {
      return { success: false, error: "Access denied. Admins only can assign team members." };
    }

    const supabase: any = await createClient();
    const { data: existing, error: existError } = await supabase
      .from('project_assignments')
      .select('*')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .eq('role', role);

    const existingAssignment = existing && existing.length > 0 ? existing[0] : null;

    const newAssignment = {
      id: existingAssignment?.id || randomUUID(),
      project_id: projectId,
      user_id: userId,
      role: role,
      assigned_by: profile.id,
      assigned_at: new Date().toISOString()
    };

    const { error: upsertError } = await supabase
      .from('project_assignments')
      .upsert(newAssignment, { onConflict: 'id' });

    if (upsertError) throw upsertError;

    await revalidateAccountsPaths(projectId);
    return { success: true, data: normalizeData(newAssignment) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

/** Columns needed by directory table + dropdowns — avoid select('*') */
const PROJECT_LIST_SELECT =
  'id, name, client_name, client_contact, client_address, status, site_type, services, is_frozen, target_completion_date, created_at, created_by, creator:profiles!projects_created_by_fkey(first_name, last_name)';

export type ProjectsListQuery = {
  /** 1-based page. When set, response is paginated: { items, total, page, pageSize, clients } */
  page?: number;
  pageSize?: number;
  search?: string;
  status?: string;
  client?: string;
};

export type ProjectsListPage = {
  items: any[];
  total: number;
  page: number;
  pageSize: number;
  clients: string[];
};

function sanitizeSearch(raw: string): string {
  // PostgREST or() is sensitive to , ( ) — strip control chars
  return raw.replace(/[%_,.()]/g, ' ').trim().slice(0, 80);
}

/**
 * Project directory list.
 * - Without `page`: flat array capped at 500 (dropdowns / reports / milestones) for backward compat.
 */
import { trackPerformance } from '@/lib/diagnostics/performanceTracker';

/**
 * Enhanced single project list query.
 * - With `page`: returns { items, count, totalPages, page, pageSize }
 * - Without `page`: flat array capped at 500 (dropdowns / reports / milestones) for backward compat.
 */
export async function getProjectsListAction(params?: ProjectsListQuery): Promise<ActionResponse> {
  return trackPerformance('getProjectsListAction', async () => {
  try {
    const { unstable_noStore: noStore } = await import('next/cache');
    noStore();
    const profile: any = await getUserProfileAction();
    if (!profile) return { success: false, error: 'Unauthorized' };

    const role = profile.role as Role;
    const isGlobalRole = ['admin', 'sales', 'accountant', 'hr'].includes(role);
    const paginated = params?.page != null && params.page >= 1;
    const page = paginated ? Math.max(1, Math.floor(params!.page!)) : 1;
    const pageSize = Math.min(100, Math.max(1, Math.floor(params?.pageSize || (paginated ? 10 : 500))));
    const search = params?.search ? sanitizeSearch(params.search) : '';
    const status = params?.status && params.status !== 'all' ? params.status : '';
    const client = params?.client && params.client !== 'all' ? params.client : '';

    const supabase: any = await createClient();

    let assignedIds: string[] | null = null;
    if (!isGlobalRole) {
      const { data: assignments, error: aError } = await supabase
        .from('project_assignments')
        .select('project_id')
        .eq('user_id', profile.id);
      if (aError) throw aError;
      assignedIds = (assignments || []).map((a: any) => a.project_id);
      if (assignedIds!.length === 0) {
        if (paginated) {
          return {
            success: true,
            data: { items: [], total: 0, page, pageSize, clients: [] } satisfies ProjectsListPage,
          };
        }
        return { success: true, data: [] };
      }
    }

    const applyFilters = (q: any) => {
      let query = q.neq('status', 'archived').is('deleted_at', null);
      if (assignedIds) query = query.in('id', assignedIds);
      if (client) query = query.eq('client_name', client);
      if (status) {
        if (role === 'sales' && status === 'send_to_accountant') {
          query = query.eq('status', 'payment_pending');
        } else {
          query = query.eq('status', status);
        }
      }
      if (search) {
        query = query.or(
          `name.ilike.%${search}%,id.ilike.%${search}%,client_name.ilike.%${search}%`
        );
      }
      return query;
    };

    // Lightweight client names for filter dropdown (paginated mode only)
    let clients: string[] = [];
    if (paginated) {
      let clientsQuery = supabase
        .from('projects')
        .select('client_name')
        .neq('status', 'archived')
        .is('deleted_at', null)
        .not('client_name', 'is', null)
        .limit(500);
      if (assignedIds) clientsQuery = clientsQuery.in('id', assignedIds);
      const { data: clientRows } = await clientsQuery;
      clients = Array.from(
        new Set((clientRows || []).map((r: any) => r.client_name).filter(Boolean))
      ).sort() as string[];
    }

    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let listQuery = applyFilters(
      supabase.from('projects').select(PROJECT_LIST_SELECT, paginated ? { count: 'exact' } : undefined)
    ).order('created_at', { ascending: false });

    if (paginated) {
      listQuery = listQuery.range(from, to);
    } else {
      listQuery = listQuery.limit(pageSize);
    }

    const { data, error, count } = await listQuery;
    if (error) throw error;

    const items = normalizeData(data || []);

    if (paginated) {
      return {
        success: true,
        data: {
          items,
          total: count ?? items.length,
          page,
          pageSize,
          clients,
        } satisfies ProjectsListPage,
      };
    }

    // Legacy: flat array for reports / milestones dropdowns
    return { success: true, data: items };
  } catch (error: any) {
    if (error?.message?.includes('Dynamic server usage') || error?.digest === 'DYNAMIC_SERVER_USAGE') {
      throw error;
    }
    import('@/lib/diagnostics/errorLogger').then(({ captureError }) => {
      captureError({
        message: error.message || 'Unknown error in getProjectsListAction',
        stackTrace: error.stack,
        module: 'Projects',
        severity: 'HIGH',
        path: 'getProjectsListAction'
      });
    }).catch(console.error);
    return { success: false, error: error.message };
  }
  });
}

export async function getProjectByIdAction(projectId: string): Promise<ActionResponse> {
  try {
    const profile: any = await getUserProfileAction();
    if (!profile) return { success: false, error: 'Unauthorized' };

    const supabase: any = await createClient();
    const { data: project, error } = await supabase
      .from('projects')
      .select(
        'id, name, client_name, client_contact, client_address, status, priority, budget, is_frozen, gst_number, target_completion_date, created_by, created_at, updated_at, deleted_at, site_type, services'
      )
      .eq('id', projectId)
      .is('deleted_at', null)
      .single();

    if (error || !project) return { success: false, error: 'Project not found' };

    return { success: true, data: normalizeData(project) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function adminHardDeleteProjectAction(projectId: string): Promise<ActionResponse> {
  try {
    const profile: any = await getUserProfileAction();
    if (!profile || profile.role !== 'admin') {
      return { success: false, error: 'Unauthorized. Only administrators can delete projects.' };
    }

    const supabaseAdmin: any = await createAdminClient();

    // 1. Delete files from Supabase Storage
    const { data: files } = await supabaseAdmin
      .from('files')
      .select('file_url')
      .eq('project_id', projectId);

    if (files && files.length > 0) {
      const pathsToDelete: string[] = [];
      for (const file of files) {
        if (file.file_url) {
          let cleanUrl = file.file_url.split('?')[0];
          const bucketIdx = cleanUrl.indexOf('/project-assets/');
          if (bucketIdx !== -1) {
            pathsToDelete.push(decodeURIComponent(cleanUrl.substring(bucketIdx + 16)));
          } else if (!cleanUrl.startsWith('http')) {
            pathsToDelete.push(decodeURIComponent(cleanUrl));
          }
        }
      }
      if (pathsToDelete.length > 0) {
        const { error: storageError } = await supabaseAdmin.storage
          .from("project-assets")
          .remove(pathsToDelete);
        if (storageError) {
          console.error("Storage files cleanup failed:", storageError);
        }
      }
    }

    // 2. Delete database records in order
    const tables = [
      'workflow_history',
      'activity_logs',
      'tasks',
      'files',
      'invoices',
      'project_milestones',
      'payments',
      'project_finances',
      'project_assignments',
      'project_accounts_owners',
      'field_reports',
      'project_visits',
      'delivery_checklist',
      'issues',
      'comments',
      'notifications'
    ];

    for (const table of tables) {
      const { error: tblErr } = await supabaseAdmin.from(table).delete().eq('project_id', projectId);
      if (tblErr) {
        console.error(`Failed to delete from ${table}:`, tblErr.message);
      }
    }

    try {
      await supabaseAdmin.from('audit_logs').delete().eq('project_id', projectId);
    } catch(_) {}

    // 3. Finally, delete the project
    const { error: projErr } = await supabaseAdmin
      .from('projects')
      .delete()
      .eq('id', projectId);

    if (projErr) throw projErr;

    await revalidateAccountsPaths(projectId);

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function adminHardDeleteClientAction(clientName: string): Promise<ActionResponse> {
  try {
    const profile: any = await getUserProfileAction();
    if (!profile || profile.role !== 'admin') {
      return { success: false, error: 'Unauthorized. Only administrators can delete clients.' };
    }

    const supabaseAdmin: any = await createAdminClient();
    
    // Find all projects for this client
    const { data: projects, error } = await supabaseAdmin
      .from('projects')
      .select('id')
      .eq('client_name', clientName);
      
    if (error) return { success: false, error: error.message };
    
    if (projects && projects.length > 0) {
      for (const project of projects) {
        await adminHardDeleteProjectAction(project.id);
      }
    }
    
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getActiveProjectsCountAction() {
  try {
    const supabase: any = await createClient();
    const { count, error } = await supabase
      .from('projects')
      .select('*', { count: 'exact', head: true })
      .is('deleted_at', null)
      .not('status', 'in', '("completed","archived")');
    if (error) throw error;
    return { success: true, data: count || 0 };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getProjectStatusCountsAction() {
  try {
    const supabase: any = await createClient();
    const now = new Date().toISOString();
    
    const [delayedRes, onTrackRes] = await Promise.all([
      supabase
        .from('projects')
        .select('*', { count: 'exact', head: true })
        .is('deleted_at', null)
        .not('status', 'in', '("completed","archived")')
        .lt('deadline', now),
      supabase
        .from('projects')
        .select('*', { count: 'exact', head: true })
        .is('deleted_at', null)
        .not('status', 'in', '("completed","archived")')
        .or(`deadline.is.null,deadline.gte.${now}`)
    ]);
    
    return {
      success: true,
      data: {
        delayed: delayedRes.count || 0,
        onTrack: onTrackRes.count || 0
      }
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
