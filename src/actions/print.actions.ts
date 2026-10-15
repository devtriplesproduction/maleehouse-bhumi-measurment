"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type ActionResponse<T = null> = {
  success: boolean;
  error: string | null;
  data?: T;
};

export type CreatePrintJobPayload = {
  client_name: string;
  client_phone?: string;
  project_id?: string;
  doc_type?: string;
  file_id?: string;
  file_name?: string;
  file_url?: string;
  copies: number;
  paper_size: string;
  print_type: string;
  amount: number;
  notes?: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function requireOpsAuth() {
  const supabase: any = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { authorized: false, error: "Unauthorized", profile: null };
  const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
  if (!profile) return { authorized: false, error: "Unauthorized", profile: null };

  const allowed = ["admin", "accountant", "engineer", "developer"];
  if (!allowed.includes(profile.role)) {
    return { authorized: false, error: "Unauthorized role for print operations", profile };
  }
  return { authorized: true, error: null, profile };
}

async function logActivity(
  projectId: string | null,
  userId: string,
  action: string,
  details: Record<string, any>
) {
  try {
    const supabase: any = await createClient();
    await supabase.from('activity_logs').insert({
      id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      project_id: projectId,
      user_id: userId,
      action,
      details,
      created_at: new Date().toISOString(),
    });
  } catch (_) {}
}

function generatePrintJobId(existingIds: string[]) {
  const date = new Date();
  const yyyymmdd = [
    date.getFullYear(),
    (date.getMonth() + 1).toString().padStart(2, '0'),
    date.getDate().toString().padStart(2, '0')
  ].join('');
  
  const prefix = `PRT-${yyyymmdd}-`;
  
  const matching = existingIds
    .filter((id) => id.startsWith(prefix))
    .map((id) => {
      const parts = id.split('-');
      return parseInt(parts[parts.length - 1] || '0', 10);
    })
    .filter((num) => !isNaN(num));

  const maxSeq = matching.length > 0 ? Math.max(...matching) : 0;
  const nextSeq = (maxSeq + 1).toString().padStart(3, '0');

  return `${prefix}${nextSeq}`;
}

async function processPrintPaymentInternal(
  job: any, 
  paymentInfo: { amount: number; payment_method: string; bank_id?: string; transaction_id?: string }, 
  profile: any
) {
  const supabase: any = await createClient();
  const targetProjectId = 'PRJ-PRINT-DESK';
  
  const { data: existingDesk } = await supabase.from('projects').select('id').eq('id', targetProjectId).single();
  if (!existingDesk) {
    const { error: projectErr } = await supabase.from('projects').insert({
      id: targetProjectId,
      name: 'Walk-in Print Jobs (Generic)',
      client_name: 'Walk-in',
      status: 'project_created',
      created_by: profile.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    if (projectErr) return { ok: false, error: "Project creation error: " + projectErr.message };
  }

  const paymentId = `pay-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
  
  const isVerified = ['admin', 'accountant', 'developer'].includes(profile.role);
  const status = isVerified ? 'verified' : 'pending';
  
  const { error: payError } = await supabase.from('payments').insert({
    id: paymentId,
    project_id: targetProjectId,
    amount: paymentInfo.amount,
    payment_method: paymentInfo.payment_method,
    transaction_id: paymentInfo.transaction_id || null,
    bank_id: paymentInfo.bank_id || null,
    payment_date: new Date().toISOString(),
    status: status,
    verified_by: isVerified ? profile.id : null,
    verified_at: isVerified ? new Date().toISOString() : null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });
  
  if (payError) return { ok: false, error: "Payment insertion error: " + payError.message };
  
  if (isVerified) {
    await supabase.from('activity_logs').insert({
      id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      project_id: targetProjectId,
      action: 'RECEIPT_GENERATED',
      details: { amount: paymentInfo.amount, comment: "Payment verified. Receipt generated." },
      user_id: profile.id,
      created_at: new Date().toISOString()
    });
  }

  const receiptNumber = isVerified ? `REC-${paymentId.split('-').pop()}` : null;
  const jobStatus = isVerified ? 'paid' : job.status;

  const { data: updatedJob, error: updateError } = await supabase
    .from('print_jobs')
    .update({
      payment_id: paymentId,
      status: jobStatus,
      receipt_number: receiptNumber,
      updated_at: new Date().toISOString()
    })
    .eq('id', job.id)
    .select()
    .single();
    
  if (updateError) return { ok: false, error: updateError.message };

  return {
    ok: true,
    data: {
      id: updatedJob.id,
      client_name: updatedJob.client_name,
      amount: updatedJob.amount,
      status: updatedJob.status,
      payment_id: updatedJob.payment_id,
      receipt_number: updatedJob.receipt_number
    }
  };
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function createPrintJobAction(payload: CreatePrintJobPayload): Promise<ActionResponse<any>> {
  try {
    const auth = await requireOpsAuth();
    if (!auth.authorized || !auth.profile) return { success: false, error: auth.error, data: null };

    const supabase: any = await createClient();

    const { data: existingJobs } = await supabase.from('print_jobs').select('id');
    const existingIds = (existingJobs || []).map((j: any) => j.id);
    const jobId = generatePrintJobId(existingIds);

    const newJob = {
      id: jobId,
      client_name: payload.client_name,
      client_phone: payload.client_phone || null,
      project_id: payload.project_id || null,
      doc_type: payload.doc_type || null,
      file_id: payload.file_id || null,
      file_name: payload.file_name || null,
      file_url: payload.file_url || null,
      copies: payload.copies,
      paper_size: payload.paper_size,
      print_type: payload.print_type,
      amount: payload.amount,
      notes: payload.notes || null,
      status: 'draft',
      created_by: auth.profile.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const { error: insertError } = await supabase.from('print_jobs').insert(newJob);
    if (insertError) {
      return { success: false, error: insertError.message, data: null };
    }

    let returnData: any = {
      id: jobId,
      client_name: newJob.client_name,
      amount: newJob.amount,
      status: newJob.status,
      payment_id: null,
      receipt_number: null
    };

    if (payload.amount > 0) {
      const payRes = await processPrintPaymentInternal(newJob, { amount: payload.amount, payment_method: 'cash' }, auth.profile);
      if (!payRes.ok) {
        await supabase.from('print_jobs').delete().eq('id', jobId);
        return { success: false, error: payRes.error, data: null };
      }
      returnData = payRes.data;
    }

    await logActivity(payload.project_id || null, auth.profile.id, "PRINT_JOB_CREATED", {
      job_id: jobId,
      client: payload.client_name,
      amount: payload.amount
    });

    const { data: fullJob } = await supabase
      .from('print_jobs')
      .select('*')
      .eq('id', jobId)
      .single();

    revalidatePath("/prints");
    revalidatePath("/accounts/prints");
    
    return { success: true, error: null, data: fullJob || { ...newJob, ...returnData } };
  } catch (err: any) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: msg || "Failed to create print job", data: null };
  }
}

export async function markPrintJobPrintedAction(jobId: string): Promise<ActionResponse<any>> {
  try {
    const auth = await requireOpsAuth();
    if (!auth.authorized || !auth.profile) return { success: false, error: auth.error };

    const supabase: any = await createClient();
    
    const { data: job } = await supabase.from('print_jobs').select('id, project_id, status').eq('id', jobId).single();
    if (!job) return { success: false, error: "Print job not found" };

    if (job.status === 'cancelled') return { success: false, error: "Cannot print cancelled job" };

    const { data: updated, error } = await supabase
      .from('print_jobs')
      .update({
        status: job.status === 'paid' ? 'paid' : 'printed',
        printed_by: auth.profile.id,
        printed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId)
      .select()
      .single();

    if (error) throw new Error(error.message);

    await logActivity(job.project_id, auth.profile.id, "PRINT_JOB_PRINTED", { job_id: jobId });

    revalidatePath("/prints");
    revalidatePath("/accounts/prints");
    return { success: true, error: null, data: updated };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function logPrintPaymentAction(
  jobId: string, 
  paymentInfo: { amount: number; payment_method: string; bank_id?: string; transaction_id?: string }
): Promise<ActionResponse<any>> {
  try {
    const auth = await requireOpsAuth();
    if (!auth.authorized || !auth.profile) return { success: false, error: auth.error };

    const supabase: any = await createClient();
    
    const { data: job } = await supabase.from('print_jobs').select('*').eq('id', jobId).single();
    if (!job) return { success: false, error: "Print job not found" };

    const returnData = await processPrintPaymentInternal(job, paymentInfo, auth.profile);
    
    if (!returnData.ok || !returnData.data) {
      return { success: false, error: returnData.error || "Payment failed" };
    }

    await logActivity(job.project_id, auth.profile.id, "PRINT_JOB_PAYMENT_LOGGED", { job_id: jobId, payment_id: returnData.data.payment_id });

    revalidatePath("/prints");
    revalidatePath("/accounts/prints");
    return { success: true, error: null, data: returnData };
  } catch (err: any) {
    return { success: false, error: err?.message || "Payment logging failed" };
  }
}

export async function listPrintJobsAction(filters?: { from?: string; to?: string; status?: string; search?: string }): Promise<ActionResponse<any[]>> {
  try {
    const auth = await requireOpsAuth();
    if (!auth.authorized) return { success: false, error: auth.error, data: [] };

    const supabase: any = await createClient();
    let query = supabase.from('print_jobs').select('*, created_by_profile:profiles!print_jobs_created_by_fkey(first_name, last_name)').order('created_at', { ascending: false });

    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.from) {
      query = query.gte('created_at', filters.from);
    }
    if (filters?.to) {
      query = query.lte('created_at', filters.to);
    }
    if (filters?.search) {
      query = query.or(`client_name.ilike.%${filters.search}%,client_phone.ilike.%${filters.search}%,id.ilike.%${filters.search}%`);
    }

    const { data, error } = await query;
    if (error) throw new Error(error.message);

    return { success: true, error: null, data: data || [] };
  } catch (err: any) {
    return { success: false, error: err.message, data: [] };
  }
}

export async function getPrintJobAction(jobId: string): Promise<ActionResponse<any>> {
  try {
    const auth = await requireOpsAuth();
    if (!auth.authorized) return { success: false, error: auth.error };

    const supabase: any = await createClient();
    const { data, error } = await supabase
      .from('print_jobs')
      .select(`
        *,
        payment:payments(*),
        created_by_profile:profiles!print_jobs_created_by_fkey(first_name, last_name),
        printed_by_profile:profiles!print_jobs_printed_by_fkey(first_name, last_name)
      `)
      .eq('id', jobId)
      .single();

    if (error) throw new Error(error.message);

    return { success: true, error: null, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function cancelPrintJobAction(jobId: string): Promise<ActionResponse<any>> {
  try {
    const auth = await requireOpsAuth();
    if (!auth.authorized || !auth.profile) return { success: false, error: auth.error };

    const supabase: any = await createClient();
    
    const { data: job } = await supabase.from('print_jobs').select('id, project_id, status').eq('id', jobId).single();
    if (!job) return { success: false, error: "Print job not found" };

    if (job.status === 'paid') {
      return { success: false, error: "Cannot cancel a paid job. Please process a refund first." };
    }

    const { data: updated, error } = await supabase
      .from('print_jobs')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId)
      .select()
      .single();

    if (error) throw new Error(error.message);

    await logActivity(job.project_id, auth.profile.id, "PRINT_JOB_CANCELLED", { job_id: jobId });

    revalidatePath("/prints");
    revalidatePath("/accounts/prints");
    return { success: true, error: null, data: updated };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

// ─── Document Types & Base Pricing ──────────────────────────────────────────

export type PrintDocumentType = {
  id: string;
  name: string;
  description?: string | null;
  base_price: number;
  suggested_paper?: string;
  suggested_print_type?: string;
  created_at?: string;
  updated_at?: string;
};

export async function listPrintDocumentTypesAction(): Promise<ActionResponse<PrintDocumentType[]>> {
  try {
    const supabase: any = await createClient();
    const { data, error } = await supabase
      .from('print_document_types')
      .select('*')
      .order('base_price', { ascending: true });

    if (error) throw new Error(error.message);
    return { success: true, error: null, data: data || [] };
  } catch (err: any) {
    return { success: false, error: err.message, data: [] };
  }
}

export async function createPrintDocumentTypeAction(payload: {
  name: string;
  description?: string;
  base_price: number;
  suggested_paper?: string;
  suggested_print_type?: string;
}): Promise<ActionResponse<PrintDocumentType>> {
  try {
    const auth = await requireOpsAuth();
    if (!auth.authorized || !auth.profile) return { success: false, error: auth.error };

    const supabase: any = await createClient();
    const id = `DOC-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const { data, error } = await supabase
      .from('print_document_types')
      .insert({
        id,
        name: payload.name.trim(),
        description: payload.description?.trim() || null,
        base_price: Number(payload.base_price) || 0,
        suggested_paper: payload.suggested_paper || 'A4',
        suggested_print_type: payload.suggested_print_type || 'bw',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw new Error(error.message);

    revalidatePath("/prints");
    return { success: true, error: null, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function updatePrintDocumentTypeAction(
  id: string,
  payload: {
    name?: string;
    description?: string;
    base_price?: number;
    suggested_paper?: string;
    suggested_print_type?: string;
  }
): Promise<ActionResponse<PrintDocumentType>> {
  try {
    const auth = await requireOpsAuth();
    if (!auth.authorized || !auth.profile) return { success: false, error: auth.error };

    const supabase: any = await createClient();
    const updates: any = { updated_at: new Date().toISOString() };
    if (payload.name !== undefined) updates.name = payload.name.trim();
    if (payload.description !== undefined) updates.description = payload.description?.trim() || null;
    if (payload.base_price !== undefined) updates.base_price = Number(payload.base_price);
    if (payload.suggested_paper !== undefined) updates.suggested_paper = payload.suggested_paper;
    if (payload.suggested_print_type !== undefined) updates.suggested_print_type = payload.suggested_print_type;

    const { data, error } = await supabase
      .from('print_document_types')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw new Error(error.message);

    revalidatePath("/prints");
    return { success: true, error: null, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function deletePrintDocumentTypeAction(id: string): Promise<ActionResponse<null>> {
  try {
    const auth = await requireOpsAuth();
    if (!auth.authorized || !auth.profile) return { success: false, error: auth.error };

    const supabase: any = await createClient();
    const { error } = await supabase
      .from('print_document_types')
      .delete()
      .eq('id', id);

    if (error) throw new Error(error.message);

    revalidatePath("/prints");
    return { success: true, error: null };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

