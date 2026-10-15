'use server';

import { normalizeData } from '@/lib/normalize';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { revalidatePath } from 'next/cache';

import { logWorkflowAudit } from "@/lib/workflow/logWorkflowAudit";
import { notifyPaymentAction } from '@/actions/notification.actions';
import { updateProjectStageAction } from '@/actions/workflow.actions';
import { revalidateAccountsPaths } from '@/actions/revalidate-utils';
import { getUserProfileAction } from '@/actions/auth.actions';
import { logAdminAuditAction } from '@/actions/admin.actions';
import { requireAuthContext } from '@/lib/permissions/permissions';
import { getAssignedProjectIds, requireProjectAccess } from '@/lib/permissions/project-access';
import {
  createInvoiceSchema,
  createPaymentSchema,
  type CreateInvoiceInput,
  type CreatePaymentInput
} from '@/validations/finance.schema';
import { generateSequentialCode } from '@/lib/id-generator';
import { isProjectDispatchedToOps } from '@/lib/project-commercial';
import { createAuditLog } from '@/lib/audit/createAuditLog';

export type ActionResponse<T = any> = {
  success: boolean;
  data?: T;
  error?: string;
};

async function verifyProjectNotLocked(projectId: string): Promise<{ success: boolean; error: string | null }> {
  try {
    const supabase: any = await createClient();
    const { data: project, error } = await supabase.from('projects').select('status').eq('id', projectId).single();
    if (error) return { success: false, error: error.message };

    if (project?.status === "completed" || project?.status === "archived") {
      return { success: false, error: "Project is locked (completed/archived) and cannot be modified." };
    }
  } catch (err) {
    console.error("verifyProjectNotLocked error:", err);
  }
  return { success: true, error: null };
}

export async function createInvoiceAction(payload: CreateInvoiceInput): Promise<ActionResponse> {
  try {
    const validated = createInvoiceSchema.safeParse(payload);
    if (!validated.success) {
      return { success: false, error: validated.error.errors[0]?.message };
    }

    const auth = await requireProjectAccess(payload.project_id, { requireUnlocked: true });
    if (!auth.authorized) return { success: false, error: auth.error || 'Unauthorized. Please log in.' };

    if (auth.role !== 'admin' && auth.role !== 'accountant') {
      return { success: false, error: 'Access denied. Accountant or Admin only.' };
    }

    const { amount, gst_rate } = validated.data;
    const gst_amount = (amount * gst_rate) / 100;
    const total_amount = amount + gst_amount;

    const supabase: any = await createClient();

    if (payload.milestone_id) {
      const { data: milestone } = await supabase
        .from('project_milestones')
        .select('amount, due_date')
        .eq('id', payload.milestone_id)
        .single();
        
      if (milestone) {
        const { data: existingInvoices } = await supabase
          .from('invoices')
          .select('status, amount, due_date')
          .eq('milestone_id', payload.milestone_id)
          .order('created_at', { ascending: false });
          
        const activeProforma = existingInvoices?.find((inv: any) => 
          inv.status !== 'cancelled' && 
          inv.status !== 'rejected'
        );
        
        if (activeProforma) {
          return { success: false, error: 'An active Invoice already exists for the current milestone.' };
        }
      }
    }

    if (payload.visit_id) {
      const { data: existingVisitInvoices } = await supabase
        .from('invoices')
        .select('status')
        .eq('visit_id', payload.visit_id);
        
      const activeVisitInvoice = existingVisitInvoices?.find((inv: any) => 
        inv.status !== 'cancelled' && inv.status !== 'rejected'
      );
      
      if (activeVisitInvoice) {
        return { success: false, error: 'An active invoice already exists for this field visit.' };
      }
    }

    const { data, error } = await supabase
      .from('invoices')
      .insert({
        id: `inv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        ...validated.data,
        gst_amount,
        total_amount,
        created_by: auth.userId,
        status: 'draft'
      })
      .select()
      .single();

    if (error) return { success: false, error: error.message };

    // Update milestone status to invoiced if applicable
    if (validated.data.milestone_id) {
      await supabase
        .from('project_milestones')
        .update({ status: 'invoiced', updated_at: new Date().toISOString() })
        .eq('id', validated.data.milestone_id);
    }

    await logWorkflowAudit(supabase, payload.project_id, auth.userId, `Created invoice for ${total_amount.toFixed(2)}`);

    await supabase.from('activity_logs').insert({
      id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      project_id: payload.project_id,
      user_id: auth.userId,
      action: 'INVOICE_CREATED',
      details: { invoice_id: data.id, amount: total_amount },
      created_at: new Date().toISOString()
    });

    await createAuditLog({
      action: 'INVOICE_CREATED',
      module: 'Invoices',
      entityType: 'Invoice',
      entityId: data.id,
      description: `Created invoice for ${total_amount.toFixed(2)}`,
      newValue: data,
    });

    await revalidateAccountsPaths(payload.project_id);

    return { success: true, data: normalizeData(data) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function deleteInvoiceAction(invoiceId: string): Promise<ActionResponse> {
  try {
    const profile: any = await getUserProfileAction();
    if (!profile) return { success: false, error: 'Unauthorized' };

    if (profile.role !== 'admin' && profile.role !== 'accountant') {
      return { success: false, error: 'Access denied. Accountant or Admin only.' };
    }

    const supabase: any = await createClient();

    // Fetch invoice to check status and project_id for locking check
    const { data: invoice, error: fetchError } = await supabase.from('invoices').select('project_id').eq('id', invoiceId).single();
    if (fetchError || !invoice) return { success: false, error: 'Invoice not found.' };

    const lockCheck = await verifyProjectNotLocked(invoice.project_id);
    if (!lockCheck.success) {
      return { success: false, error: lockCheck.error || "Project is locked." };
    }

    // Call the transactional RPC to delete the invoice
    const { error: rpcError } = await supabase.rpc('delete_invoice_transactionally', {
      p_invoice_id: invoiceId
    });

    if (rpcError) {
      return { success: false, error: rpcError.message };
    }

    await supabase.from('activity_logs').insert({
      id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      project_id: invoice.project_id,
      user_id: profile.id,
      action: 'INVOICE_DELETED',
      details: { invoice_id: invoiceId },
      created_at: new Date().toISOString()
    });

    await createAuditLog({
      action: 'INVOICE_DELETED',
      module: 'Invoices',
      entityType: 'Invoice',
      entityId: invoiceId,
      description: `Deleted invoice: ${invoiceId}`,
      oldValue: invoice,
    });

    await revalidateAccountsPaths(invoice.project_id);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function logPaymentAction(payload: CreatePaymentInput): Promise<ActionResponse> {
  try {
    const validated = createPaymentSchema.safeParse(payload);
    if (!validated.success) {
      return { success: false, error: validated.error.errors[0]?.message };
    }

    const auth = await requireProjectAccess(payload.project_id, { requireUnlocked: true });
    if (!auth.authorized) return { success: false, error: auth.error || 'Unauthorized. Please log in.' };

    const { milestone_id, ...paymentData } = validated.data;
    const supabase: any = await createClient();
    
    let finalInvoiceId = paymentData.invoice_id;
    if (milestone_id && !finalInvoiceId) {
      // Find existing invoice for milestone
      const { data: existing } = await supabase.from('invoices').select('id').eq('milestone_id', milestone_id).maybeSingle();
      if (existing) {
        finalInvoiceId = existing.id;
      } else {
        // Auto-create internal billing ledger record for this milestone payment so DB integrity, RLS, and RPCs work seamlessly
        const { data: milestone } = await supabase.from('project_milestones').select('amount, project_id').eq('id', milestone_id).single();
        if (milestone) {
          const invId = `inv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
          const { data: newInv } = await supabase.from('invoices').insert({
            id: invId,
            project_id: payload.project_id,
            milestone_id: milestone_id,
            invoice_number: `BILL-${Date.now().toString().slice(-6)}`,
            amount: Number(milestone.amount),
            gst_rate: 0,
            gst_amount: 0,
            total_amount: Number(milestone.amount),
            status: 'sent',
            created_by: auth.userId
          }).select('id').single();
          if (newInv) {
            finalInvoiceId = newInv.id;
          }
        }
      }
    }

    // FIX (idempotency): the `payments` table only prevents duplicates via a
    // unique `transaction_id` (see migrations/10_payments.sql), and
    // `transaction_id` is optional — so a double-click, slow network retry,
    // or double form submission with no transaction_id previously had no
    // server-side protection at all and could insert two identical payment
    // rows. Before inserting, check for a non-rejected payment with the same
    // project, invoice, amount, and payment method logged in the last 20
    // seconds; if one exists, treat this call as a duplicate submission and
    // return the existing payment instead of creating a second one.
    const duplicateWindowStart = new Date(Date.now() - 20_000).toISOString();
    let duplicateCheck = supabase
      .from('payments')
      .select('*')
      .eq('project_id', payload.project_id)
      .eq('amount', paymentData.amount)
      .eq('payment_method', paymentData.payment_method)
      .neq('status', 'rejected')
      .gte('created_at', duplicateWindowStart);
    duplicateCheck = finalInvoiceId
      ? duplicateCheck.eq('invoice_id', finalInvoiceId)
      : duplicateCheck.is('invoice_id', null);
    const { data: possibleDuplicate } = await duplicateCheck
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (possibleDuplicate) {
      return { success: true, data: normalizeData(possibleDuplicate) };
    }

    const { data, error } = await supabase
      .from('payments')
      .insert({
        id: `pay-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        ...paymentData,
        invoice_id: finalInvoiceId,
        status: 'pending'
      })
      .select()
      .single();

    if (error) {
      // Postgres unique_violation on the transaction_id constraint — surface
      // a clear duplicate-payment message instead of the raw DB error.
      if (error.code === '23505') {
        return { success: false, error: 'A payment with this transaction ID has already been logged.' };
      }
      return { success: false, error: error.message };
    }

    // Milestone status is implicitly derived from invoices(payments) instead
    
    // Only update to payment_pending if the project is in its early stages
    const { data: currentProject } = await supabase.from('projects').select('status').eq('id', payload.project_id).single();
    if (currentProject && ['lead', 'lead_created', 'requirement_gathering', 'payment_pending'].includes(currentProject.status)) {
      await updateProjectStageAction(payload.project_id, 'payment_pending', 'Payment manually logged.');
    }

    await supabase.from('activity_logs').insert({
      id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      project_id: payload.project_id,
      user_id: auth.userId,
      action: 'PAYMENT_LOGGED',
      details: { payment_id: data.id, amount: paymentData.amount },
      created_at: new Date().toISOString()
    });

    await createAuditLog({
      action: 'PAYMENT_CREATED',
      module: 'Payments',
      entityType: 'Payment',
      entityId: data.id,
      description: `Logged payment of ${paymentData.amount}`,
      newValue: data,
    });

    // Auto-verify if logged by accountant or admin
    if (auth.role === 'admin' || auth.role === 'accountant') {
      const verifyRes = await verifyPaymentAction(data.id, 'verified', 'Auto-verified because payment was logged by accountant or admin.');
      if (!verifyRes.success) {
        return { success: false, error: "Auto-verification failed: " + verifyRes.error };
      }
    }

    await revalidateAccountsPaths(payload.project_id);
    // NOTE: revalidateAccountsPaths() above already calls
    // revalidatePath(`/projects/${payload.project_id}`) internally, so a
    // second identical call here was a literal duplicate cache purge on
    // every payment logged. Removed.

    return { success: true, data: normalizeData(data) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateProjectBudgetAction(projectId: string, budget: number): Promise<ActionResponse> {
  try {
    const profile: any = await getUserProfileAction();
    if (!profile) return { success: false, error: 'Unauthorized. Please log in.' };

    if (profile.role !== 'admin' && profile.role !== 'accountant') {
      return { success: false, error: 'Access denied. Accountant or Admin only.' };
    }

    const supabase: any = await createClient();
    const { error } = await supabase
      .from('projects')
      .update({ budget })
      .eq('id', projectId);

    if (error) return { success: false, error: error.message };

    await supabase.from('activity_logs').insert({
      id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      project_id: projectId,
      action: 'PROJECT_UPDATED',
      details: { comment: `Project budget updated to ${budget}.` },
      user_id: profile.id
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function verifyPaymentAction(paymentId: string, status: 'verified' | 'rejected', reason?: string): Promise<ActionResponse> {
  try {
    const profile: any = await getUserProfileAction();
    if (!profile) return { success: false, error: 'Unauthorized. Please log in.' };

    if (profile.role !== 'admin' && profile.role !== 'accountant') {
      return { success: false, error: 'Access denied. Accountant or Admin only.' };
    }

    const supabase: any = await createClient();
    const { data: payment, error: fetchErr } = await supabase.from('payments').select('project_id, invoice_id, amount, bank_id, payment_date, created_at').eq('id', paymentId).single();
    if (fetchErr || !payment) return { success: false, error: 'Payment not found' };

    const lockCheck = await verifyProjectNotLocked(payment.project_id);
    if (!lockCheck.success) {
      return { success: false, error: lockCheck.error || "Project is locked." };
    }

    const { error: updateError } = await supabase
      .from('payments')
      .update({
        status,
        verified_by: profile.id,
        verified_at: new Date().toISOString(),
        rejection_reason: reason
      })
      .eq('id', paymentId);

    if (updateError) return { success: false, error: updateError.message };

    if (status === 'verified') {
      let isActivationGatePaid = false;
      let milestoneLinkedStage = null;

      if (payment.invoice_id) {
        await supabase.from('invoices').update({ status: 'paid' }).eq('id', payment.invoice_id);

        await supabase.from('activity_logs').insert({
          id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          project_id: payment.project_id,
          action: 'RECEIPT_GENERATED',
          details: { invoice_id: payment.invoice_id, amount: payment.amount, comment: "Payment verified. Receipt generated." },
          user_id: profile.id,
          created_at: new Date().toISOString()
        });

        const { data: invoice } = await supabase.from('invoices').select('milestone_id, visit_id').eq('id', payment.invoice_id).single();
        if (invoice) {
          if (invoice.milestone_id) {
            const { data: milestone } = await supabase
              .from('project_milestones')
              .update({ status: 'paid', updated_at: new Date().toISOString() })
              .eq('id', invoice.milestone_id)
              .select()
              .single();
            if (milestone) {
              isActivationGatePaid = milestone.is_activation_gate;
              milestoneLinkedStage = milestone.linked_stage;
            }
          }
          if (invoice.visit_id) {
            await supabase.from('project_visits').update({ status: 'paid' }).eq('id', invoice.visit_id);
          }
        }
      }

      const { data: project } = await supabase.from('projects').select('status, is_frozen, freeze_reason').eq('id', payment.project_id).single();

      // Early commercial stages → ready_for_dispatch (then auto-dispatch to ops)
      const earlyCommercial = ['lead', 'lead_created', 'requirement_gathering', 'payment_pending', 'payment_done'];
      if (isActivationGatePaid || !project || earlyCommercial.includes(project.status)) {
        const stageRes = await updateProjectStageAction(payment.project_id, 'ready_for_dispatch', 'Payment verified. Project ready for dispatch.');
        if (stageRes?.success) {
          // Auto-forward to engineering queue, skipping the manual dispatch button
          await updateProjectStageAction(payment.project_id, 'project_created', 'Auto-dispatched to Engineering after payment verification.');
        }
      } else if (
        milestoneLinkedStage &&
        isProjectDispatchedToOps(project.status) &&
        project.status !== 'project_created'
      ) {
        await updateProjectStageAction(payment.project_id, milestoneLinkedStage, `Payment verified. Stage unlocked.`);
      }

      notifyPaymentAction(payment.project_id).catch(console.error);

      if (project && project.is_frozen && project.freeze_reason === 'payment_pending') {
        await unfreezeProjectAction(payment.project_id, 'Payment verification complete. Auto-unfreezing project.');
      }

      const { data: currentFinance } = await supabase.from('project_finances').select('total_paid_amount').eq('project_id', payment.project_id).maybeSingle();
      if (currentFinance) {
        await supabase.from('project_finances').update({
          total_paid_amount: Number(currentFinance.total_paid_amount) + Number(payment.amount),
          updated_at: new Date().toISOString()
        }).eq('project_id', payment.project_id);
      } else {
        await supabase.from('project_finances').insert({
          project_id: payment.project_id,
          total_paid_amount: payment.amount
        });
      }
    } else if (status === 'rejected') {
      await updateProjectStageAction(payment.project_id, 'payment_pending', `Payment verification failed. Reason: ${reason}`);
    }

    await supabase.from('activity_logs').insert({
      id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      project_id: payment.project_id,
      user_id: profile.id,
      action: 'PAYMENT_VERIFIED',
      details: { payment_id: paymentId, status, reason },
      created_at: new Date().toISOString()
    });

    await createAuditLog({
      action: 'PAYMENT_UPDATED',
      module: 'Payments',
      entityType: 'Payment',
      entityId: paymentId,
      description: `Payment ${status}: ${reason || ''}`,
      oldValue: { status: 'pending' },
      newValue: { status, reason },
    });

    await revalidateAccountsPaths(payment.project_id);

    if (payment.bank_id) {
      const { syncBankBalance } = await import('@/actions/bank.actions');
      await syncBankBalance(payment.bank_id);
      
      if (status === 'verified') {
        const { flagBackdatedReconciliationsAction } = await import('@/actions/reconciliation.actions');
        await flagBackdatedReconciliationsAction(payment.bank_id, payment.payment_date || payment.created_at, "Payment Verified");
      }
    }

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getInvoiceByIdAction(invoiceId: string): Promise<ActionResponse> {
  try {
    const { unstable_noStore: noStore } = await import('next/cache');
    noStore();
    const auth = await requireAuthContext();
    if (auth.error) return { success: false, error: auth.error };

    const supabase: any = await createClient();
    const { data, error } = await supabase
      .from('invoices')
      .select('*, projects(id, name, client_name, client_contact, client_address, budget, gst_number, payments(amount, status)), payments(amount, status), project_milestones(title, sort_order)')
      .eq('id', invoiceId)
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data: normalizeData(data) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

const INVOICE_LIST_SELECT =
  'id, invoice_number, project_id, milestone_id, visit_id, amount, gst_amount, total_amount, status, due_date, created_at, bank_id, projects!inner(id, name, client_name, client_contact, budget, gst_number, deleted_at, payments(amount, status)), payments(amount, status), project_milestones(title, sort_order)';

const PAYMENT_LIST_SELECT =
  'id, project_id, invoice_id, amount, status, payment_method, transaction_id, payment_date, created_at, bank_id, projects!inner(name, client_name, deleted_at), bank_accounts(bank_name), invoices(invoice_number, project_milestones(title))';

export type InvoiceListQuery = {
  projectId?: string;
  page?: number;
  pageSize?: number;
  search?: string;
};

/**
 * Invoice list. Pass `page` for server pagination; omit for flat array (capped).
 */
export async function getInvoicesAction(
  projectIdOrQuery?: string | InvoiceListQuery
): Promise<ActionResponse> {
  try {
    const { unstable_noStore: noStore } = await import('next/cache');
    noStore();

    const opts: InvoiceListQuery =
      typeof projectIdOrQuery === 'string' || projectIdOrQuery == null
        ? { projectId: projectIdOrQuery }
        : projectIdOrQuery;

    const projectId = opts.projectId;
    const paginated = opts.page != null && opts.page >= 1;
    const page = paginated ? Math.max(1, Math.floor(opts.page!)) : 1;
    const pageSize = Math.min(100, Math.max(1, Math.floor(opts.pageSize || (paginated ? 20 : 100))));
    const search = (opts.search || '').replace(/[%_,.()]/g, ' ').trim().slice(0, 80);

    let authContext;
    if (projectId) {
      const auth = await requireProjectAccess(projectId);
      if (!auth.authorized) return { success: false, error: auth.error };
      authContext = auth;
    } else {
      const auth = await requireAuthContext();
      if (auth.error) return { success: false, error: auth.error };
      authContext = auth;
    }

    const supabase: any = await createClient();
    let query = supabase
      .from('invoices')
      .select(INVOICE_LIST_SELECT, paginated ? { count: 'exact' } : undefined)
      .is('projects.deleted_at', null);

    if (projectId) {
      query = query.eq('project_id', projectId);
    } else {
      const assignedIds = await getAssignedProjectIds(authContext.userId, authContext.role);
      if (assignedIds !== null) {
        if (assignedIds.length === 0) {
          return paginated
            ? { success: true, data: { items: [], total: 0, page, pageSize } }
            : { success: true, data: [] };
        }
        query = query.in('project_id', assignedIds);
      }
    }

    // Server-side search on invoice_number only (FK text filters are unreliable in PostgREST or())
    if (search) {
      query = query.ilike('invoice_number', `%${search}%`);
    }

    query = query.order('created_at', { ascending: false });
    if (paginated) {
      const from = (page - 1) * pageSize;
      query = query.range(from, from + pageSize - 1);
    } else {
      query = query.limit(pageSize);
    }

    const { data, error, count } = await query;
    if (error) return { success: false, error: error.message };

    const items = normalizeData(data || []);
    if (paginated) {
      return { success: true, data: { items, total: count ?? items.length, page, pageSize } };
    }
    return { success: true, data: items };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getPaymentsAction(
  projectId?: string,
  opts?: { page?: number; pageSize?: number }
): Promise<ActionResponse> {
  try {
    const { unstable_noStore: noStore } = await import('next/cache');
    noStore();
    
    let authContext;
    if (projectId) {
      const auth = await requireProjectAccess(projectId);
      if (!auth.authorized) return { success: false, error: auth.error };
      authContext = auth;
    } else {
      const auth = await requireAuthContext();
      if (auth.error) return { success: false, error: auth.error };
      authContext = auth;
    }

    const pageSize = Math.min(100, Math.max(1, opts?.pageSize || 100));
    const page = Math.max(1, opts?.page || 1);

    const supabase: any = await createClient();
    let query = supabase
      .from('payments')
      .select(PAYMENT_LIST_SELECT)
      .is('projects.deleted_at', null);

    if (projectId) {
      query = query.eq('project_id', projectId);
    } else {
      const assignedIds = await getAssignedProjectIds(authContext.userId, authContext.role);
      if (assignedIds !== null) {
        if (assignedIds.length === 0) return { success: true, data: [] };
        query = query.in('project_id', assignedIds);
      }
    }

    const from = (page - 1) * pageSize;
    const { data, error } = await query
      .order('created_at', { ascending: false })
      .range(from, from + pageSize - 1);

    if (error) return { success: false, error: error.message };
    return { success: true, data: normalizeData(data || []) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function assignAccountantAction(projectId: string, accountantId: string): Promise<ActionResponse> {
  try {
    const profile: any = await getUserProfileAction();
    if (!profile) return { success: false, error: 'Unauthorized' };

    if (profile.role !== 'admin') {
      return { success: false, error: 'Access denied. Admin only.' };
    }

    const supabase: any = await createClient();
    const { data, error } = await supabase
      .from('project_accounts_owners')
      .upsert({
        project_id: projectId,
        accountant_id: accountantId,
        assigned_by: profile.id,
        assigned_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) return { success: false, error: error.message };

    await revalidateAccountsPaths(projectId);

    return { success: true, data: normalizeData(data) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getAccountantOwnerAction(projectId: string): Promise<ActionResponse> {
  try {
    const profile: any = await getUserProfileAction();
    if (!profile) return { success: false, error: 'Unauthorized' };

    const supabase: any = await createClient();
    const { data, error } = await supabase
      .from('project_accounts_owners')
      .select('*')
      .eq('project_id', projectId)
      .maybeSingle();

    if (error) return { success: false, error: error.message };
    if (!data) return { success: true, data: normalizeData(null) };

    if (profile.role !== 'admin' && profile.id !== data.accountant_id) {
      return { success: false, error: 'Access denied.' };
    }

    return { success: true, data: normalizeData(data) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function createMilestonesAction(
  projectId: string,
  milestones: Array<{
    id?: string;
    title: string;
    description?: string;
    amount: number;
    due_date?: string;
    linked_stage?: string;
    is_activation_gate: boolean;
  }>
): Promise<ActionResponse> {
  try {
    const auth = await requireProjectAccess(projectId, { requireUnlocked: true });
    if (!auth.authorized) return { success: false, error: auth.error || 'Unauthorized' };

    let isAuthorized = auth.role === 'admin';
    const supabase: any = await createClient();

    if (!isAuthorized && auth.role === 'accountant') {
      const { data: owner } = await supabase
        .from('project_accounts_owners')
        .select('accountant_id')
        .eq('project_id', projectId)
        .maybeSingle();
      if (owner) {
        isAuthorized = owner.accountant_id === auth.userId;
      } else {
        isAuthorized = true;
        await supabase
          .from('project_accounts_owners')
          .insert({
            project_id: projectId,
            accountant_id: auth.userId,
            assigned_by: auth.userId,
            assigned_at: new Date().toISOString()
          });
      }
    }

    if (!isAuthorized) {
      return { success: false, error: 'Access denied. Only the assigned Accountant or Admin can create milestones.' };
    }

    let sum = 0;
    for (const m of milestones) {
      if (m.amount <= 0) {
        return { success: false, error: 'Milestone amounts must be greater than zero.' };
      }
      sum += Number(m.amount);
    }

    let totalQuotedAmount = 0;

    const { data: projectFinance } = await supabase
      .from('project_finances')
      .select('total_quoted_amount, contract_value')
      .eq('project_id', projectId)
      .maybeSingle();

    if (projectFinance && (projectFinance.contract_value || projectFinance.total_quoted_amount)) {
      totalQuotedAmount = Number(projectFinance.contract_value || projectFinance.total_quoted_amount);
    } else {
      const { data: proj } = await supabase
        .from('projects')
        .select('budget')
        .eq('id', projectId)
        .maybeSingle();
      if (proj && proj.budget) {
        totalQuotedAmount = Number(proj.budget);
      }
    }

    if (milestones.length === 0) {
      return { success: false, error: 'At least 1 milestone is required.' };
    }

    if (totalQuotedAmount > 0) {
      const diff = sum - totalQuotedAmount;
      if (diff > 0.02) { // Allow up to 2 cents difference for rounding and floating point errors
        return { success: false, error: `Sum of milestones (${sum.toFixed(2)}) exceeds the total project cost (${totalQuotedAmount.toFixed(2)}).` };
      }
    }

    // Upsert and Soft-Delete Logic
    const { data: existingMilestones } = await supabase
      .from('project_milestones')
      .select('id, status')
      .eq('project_id', projectId);
      
    const existingMilestoneIds = (existingMilestones || []).map((m: any) => m.id);
    const incomingIds = milestones.map((m: any) => m.id).filter((id: string) => id && !id.startsWith('temp-'));

    const missingMilestoneIds = existingMilestoneIds.filter((id: string) => !incomingIds.includes(id));
    
    if (missingMilestoneIds.length > 0) {
      const { data: associatedInvoices } = await supabase
        .from('invoices')
        .select('id, milestone_id')
        .in('milestone_id', missingMilestoneIds);

      const invoiceMilestoneIds = (associatedInvoices || []).map((i: any) => i.milestone_id);
      
      const milestonesToArchive = missingMilestoneIds.filter((id: string) => invoiceMilestoneIds.includes(id));
      if (milestonesToArchive.length > 0) {
        const { data: mDataList } = await supabase
          .from('project_milestones')
          .select('id, title')
          .in('id', milestonesToArchive);

        if (mDataList && mDataList.length > 0) {
          const archivePayloads = mDataList.map((mData: any) => ({
            id: mData.id,
            title: mData.title.includes('[Archived]') ? mData.title : `${mData.title} [Archived]`,
            sort_order: -1
          }));
          await supabase.rpc('bulk_update_project_milestones', { payloads: archivePayloads });
        }
      }
      
      const milestonesToDelete = missingMilestoneIds.filter((id: string) => !invoiceMilestoneIds.includes(id));
      if (milestonesToDelete.length > 0) {
        await supabase
          .from('project_milestones')
          .delete()
          .in('id', milestonesToDelete);
      }
    }

    const updates = [];
    const inserts = [];

    for (const m of milestones) {
      const isExisting = m.id && !m.id.startsWith('temp-') && existingMilestoneIds.includes(m.id);
      const dbItem = {
        project_id: projectId,
        title: m.title,
        description: m.description,
        amount: m.amount,
        due_date: m.due_date,
        linked_stage: m.linked_stage,
        is_activation_gate: m.is_activation_gate,
      };

      if (isExisting) {
        updates.push({ id: m.id, ...dbItem });
      } else {
        inserts.push({
          id: `mil-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          ...dbItem,
          status: 'pending'
        });
      }
    }

    if (inserts.length > 0) {
      const { error: insertError } = await supabase.from('project_milestones').insert(inserts);
      if (insertError) return { success: false, error: insertError.message };
    }
    
    if (updates.length > 0) {
      const { error: updateError } = await supabase.rpc('bulk_update_project_milestones', { payloads: updates });
      if (updateError) return { success: false, error: updateError.message };
      
      const invoiceUpdates = updates.filter(u => u.due_date !== undefined);
      if (invoiceUpdates.length > 0) {
        const milestoneIds = invoiceUpdates.map(u => u.id);
        const dueDates = invoiceUpdates.map(u => u.due_date);
        await supabase.rpc('bulk_update_invoices_due_date', { 
          p_milestone_ids: milestoneIds,
          p_due_dates: dueDates
        });
      }
    }

    await logWorkflowAudit(supabase, projectId, auth.userId, `Updated milestone configuration totaling ${sum.toFixed(2)}`);

    await supabase.from('activity_logs').insert({
      id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      project_id: projectId,
      user_id: auth.userId,
      action: 'MILESTONES_UPDATED',
      details: { count: milestones.length, total: sum },
      created_at: new Date().toISOString()
    });

    await createAuditLog({
      action: 'MILESTONE_UPDATED',
      module: 'Projects',
      entityType: 'Milestone',
      entityId: projectId,
      description: `Updated project milestone configuration totaling ₹${sum.toFixed(2)} for ${milestones.length} milestones.`,
      newValue: { count: milestones.length, total: sum },
    });

    await revalidateAccountsPaths(projectId);

    // Fetch the final dataset to return
    const { data: finalData } = await supabase
      .from('project_milestones')
      .select('*')
      .eq('project_id', projectId)
      .not('title', 'ilike', '%[Archived]%');

    return { success: true, data: normalizeData(finalData) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getMilestonesAction(projectId: string): Promise<ActionResponse> {
  try {
    const { unstable_noStore: noStore } = await import('next/cache');
    noStore();
    
    const auth = await requireProjectAccess(projectId);
    if (!auth.authorized) return { success: false, error: auth.error };

    const supabase: any = await createClient();
    const { data, error } = await supabase
      .from('project_milestones')
      .select('*')
      .eq('project_id', projectId)
      .not('title', 'ilike', '%[Archived]%')
      .order('due_date', { ascending: true, nullsFirst: true });

    if (error) return { success: false, error: error.message };

    // Additionally sort in JS to ensure any null due_dates are at the bottom, just in case
    const sortedData = (data || []).sort((a: any, b: any) => {
      if (!a.due_date && !b.due_date) return 0;
      if (!a.due_date) return 1;
      if (!b.due_date) return -1;
      return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
    });

    return { success: true, data: normalizeData(sortedData) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function freezeProjectAction(
  projectId: string,
  reason: 'payment_pending' | 'financial_hold' | 'client_issue' | 'approval_issue' | 'manual_admin_hold',
  comment?: string
): Promise<ActionResponse> {
  try {
    const auth = await requireProjectAccess(projectId, { requireUnlocked: true });
    if (!auth.authorized) return { success: false, error: auth.error || 'Unauthorized' };

    if (auth.role !== 'admin' && auth.role !== 'accountant') {
      return { success: false, error: 'Access denied. Accountant or Admin only.' };
    }

    const supabase: any = await createClient();
    const adminSupabase: any = await createAdminClient();

    const { data: currentProject } = await supabase.from('projects').select('status').eq('id', projectId).single();

    const { data, error } = await adminSupabase
      .from('projects')
      .update({
        is_frozen: true,
        freeze_reason: reason,
        frozen_at: new Date().toISOString(),
        frozen_by: auth.userId
      })
      .eq('id', projectId)
      .select()
      .single();

    if (error) return { success: false, error: error.message };

    await supabase.from('workflow_history').insert({
      id: `wh-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      project_id: projectId,
      from_stage: currentProject?.status,
      to_stage: 'frozen',
      changed_by: auth.userId,
      comment: comment || `Project frozen due to ${reason}.`
    });

    await supabase.from('activity_logs').insert({
      id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      project_id: projectId,
      user_id: auth.userId,
      action: 'PROJECT_FROZEN',
      details: { reason, comment },
      created_at: new Date().toISOString()
    });

    await revalidateAccountsPaths(projectId);
    revalidatePath('/operations');

    return { success: true, data: normalizeData(data) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function unfreezeProjectAction(projectId: string, comment?: string): Promise<ActionResponse> {
  try {
    const profile: any = await getUserProfileAction();
    if (!profile) return { success: false, error: 'Unauthorized' };

    if (profile.role !== 'admin' && profile.role !== 'accountant') {
      return { success: false, error: 'Access denied. Accountant or Admin only.' };
    }

    const supabase: any = await createClient();
    const adminSupabase = await createAdminClient();

    const { data: currentProject } = await supabase.from('projects').select('status').eq('id', projectId).single();

    const { data, error } = await adminSupabase
      .from('projects')
      .update({
        is_frozen: false,
        freeze_reason: null,
        frozen_at: null,
        frozen_by: null
      } as never)
      .eq('id', projectId)
      .select()
      .single();

    if (error) return { success: false, error: error.message };

    await supabase.from('workflow_history').insert({
      id: `wh-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      project_id: projectId,
      from_stage: 'frozen',
      to_stage: currentProject?.status,
      changed_by: profile.id,
      comment: comment || 'Project unfrozen.'
    });

    await supabase.from('activity_logs').insert({
      id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      project_id: projectId,
      user_id: profile.id,
      action: 'PROJECT_UNFROZEN',
      details: { comment },
      created_at: new Date().toISOString()
    });

    await revalidateAccountsPaths(projectId);
    revalidatePath('/operations');

    return { success: true, data: normalizeData(data) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getAllMilestonesAction(): Promise<ActionResponse> {
  try {
    const { unstable_noStore: noStore } = await import('next/cache');
    noStore();
    const supabase: any = await createClient();
    const { data, error } = await supabase
      .from('project_milestones')
      .select('*, projects!inner(name, client_name, status, is_frozen, dispatch_override_requested, dispatch_override_approved, deleted_at), invoices(id, status, created_at, amount, due_date, payments(status))')
      .is('projects.deleted_at', null)
      .order('due_date', { ascending: true });

    if (error) {
      console.error("Supabase Error in getAllMilestonesAction:", error.message);
      return { success: false, error: error.message };
    }

    // Filter out milestones associated with deleted projects (now handled by DB)
    const activeData = data;

    // Compute UI status based on pending payments linked through invoices
    const processedData = activeData.map((m: any) => {
      let isVerificationPending = false;
      if (m.invoices && Array.isArray(m.invoices)) {
        for (const inv of m.invoices) {
          if (inv.payments && Array.isArray(inv.payments)) {
            if (inv.payments.some((p: any) => p.status === 'pending')) {
              isVerificationPending = true;
              break;
            }
          }
        }
      }
      return {
        ...m,
        status: isVerificationPending ? 'payment_verification_pending' : m.status
      };
    });

    return { success: true, data: normalizeData(processedData) };
  } catch (error: any) {
    console.error("getAllMilestonesAction Error: ", error);
    return { success: false, error: error.message };
  }
}

export async function updateMilestoneStatusAction(
  milestoneId: string,
  status: 'pending' | 'paid' | 'hold',
  comment?: string
): Promise<ActionResponse> {
  try {
    const profile: any = await getUserProfileAction();
    if (!profile) return { success: false, error: 'Unauthorized. Please log in.' };

    if (profile.role !== 'admin' && profile.role !== 'accountant') {
      return { success: false, error: 'Access denied. Accountant or Admin only.' };
    }

    const supabase: any = await createClient();

    const { data: milestone, error: fetchErr } = await supabase
      .from('project_milestones')
      .select('*')
      .eq('id', milestoneId)
      .single();

    if (fetchErr || !milestone) return { success: false, error: 'Milestone not found.' };

    const { error: updateErr } = await supabase
      .from('project_milestones')
      .update({
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', milestoneId);

    if (updateErr) return { success: false, error: updateErr.message };

    await supabase.from('activity_logs').insert({
      id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      project_id: milestone.project_id,
      user_id: profile.id,
      action: 'MILESTONE_STATUS_UPDATE',
      details: { milestone_id: milestoneId, status, comment }
    });

    await createAuditLog({
      action: 'MILESTONE_UPDATED',
      module: 'Projects',
      entityType: 'Milestone',
      entityId: milestoneId,
      description: `Updated milestone status to ${status}`,
      oldValue: { status: milestone.status },
      newValue: { status, comment },
    });

    if (status === 'paid') {
      const { data: project } = await supabase
        .from('projects')
        .select('status')
        .eq('id', milestone.project_id)
        .single();

      const earlyCommercial = ['lead', 'lead_created', 'requirement_gathering', 'payment_pending', 'payment_done'];
      if (milestone.is_activation_gate || !project || earlyCommercial.includes(project.status)) {
        await updateProjectStageAction(milestone.project_id, 'ready_for_dispatch', comment || 'Activation gate milestone marked as paid. Project ready for dispatch.');
      } else if (
        milestone.linked_stage &&
        isProjectDispatchedToOps(project.status) &&
        project.status !== 'project_created'
      ) {
        await updateProjectStageAction(milestone.project_id, milestone.linked_stage, comment || `Linked milestone "${milestone.title}" marked as paid.`);
      }
    }

    await revalidateAccountsPaths(milestone.project_id);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function rescheduleMilestoneAction(
  milestoneId: string,
  newDueDate: string,
  reason: string
): Promise<ActionResponse> {
  try {
    if (!reason.trim()) {
      return { success: false, error: 'A reason for rescheduling is required.' };
    }

    const profile: any = await getUserProfileAction();
    if (!profile) return { success: false, error: 'Unauthorized. Please log in.' };

    if (profile.role !== 'admin' && profile.role !== 'accountant') {
      return { success: false, error: 'Access denied. Accountant or Admin only.' };
    }

    const supabase: any = await createClient();

    const { data: milestone, error: fetchErr } = await supabase
      .from('project_milestones')
      .select('*')
      .eq('id', milestoneId)
      .single();

    if (fetchErr || !milestone) return { success: false, error: 'Milestone not found.' };

    const { error: updateErr } = await supabase
      .from('project_milestones')
      .update({
        due_date: newDueDate,
        updated_at: new Date().toISOString()
      })
      .eq('id', milestoneId);

    if (updateErr) return { success: false, error: updateErr.message };

    await supabase.from('activity_logs').insert({
      id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      project_id: milestone.project_id,
      user_id: profile.id,
      action: 'MILESTONE_RESCHEDULED',
      details: { milestone_id: milestoneId, new_due_date: newDueDate, reason }
    });

    await createAuditLog({
      action: 'MILESTONE_UPDATED',
      module: 'Projects',
      entityType: 'Milestone',
      entityId: milestoneId,
      description: `Rescheduled milestone to ${newDueDate}`,
      oldValue: { due_date: milestone.due_date },
      newValue: { due_date: newDueDate, reason },
    });

    await revalidateAccountsPaths(milestone.project_id);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function autoGenerateMilestoneInvoicesAction(cronSecret?: string): Promise<ActionResponse> {
  try {
    const expectedSecret = process.env.CRON_SECRET;
    if (!expectedSecret || cronSecret !== expectedSecret) {
      return { success: false, error: 'Unauthorized cron request.' };
    }

    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + 5);
    const targetDateStr = targetDate.toISOString().split('T')[0] + 'T23:59:59.999Z';

    const supabase: any = await createClient();

    // 1. Fetch pending milestones
    const { data: milestones, error: mErr } = await supabase
      .from('project_milestones')
      .select('*, projects(status, is_frozen)')
      .eq('status', 'pending')
      .lte('due_date', targetDateStr);

    if (mErr || !milestones || milestones.length === 0) return { success: true, data: { generated: 0, invoices: [] } };

    // Filter out frozen or on-hold projects
    const activeMilestones = milestones.filter((m: any) => {
      if (m.projects?.is_frozen === true) return false;
      if (m.projects?.status === 'on_hold') return false;
      if (m.projects?.status === 'cancelled') return false;
      return true;
    });

    if (activeMilestones.length === 0) return { success: true, data: { generated: 0, invoices: [] } };

    // 2. Fetch existing invoices for these milestones
    const milestoneIds = activeMilestones.map((m: any) => m.id);
    const { data: existingInvoices } = await supabase
      .from('invoices')
      .select('milestone_id')
      .in('milestone_id', milestoneIds);

    const existingMilestoneIds = new Set((existingInvoices || []).map((i: any) => i.milestone_id));
    const milestonesToInvoice = activeMilestones.filter((m: any) => !existingMilestoneIds.has(m.id));

    if (milestonesToInvoice.length === 0) {
      return { success: true, data: { generated: 0, invoices: [] } };
    }

    // 3. Batch fetch existing invoice numbers and GST rates
    const projectIds = Array.from(new Set(milestonesToInvoice.map((m: any) => m.project_id).filter(Boolean))) as string[];
    const date = new Date();
    const yy = date.getFullYear().toString().slice(-2);
    const mm = (date.getMonth() + 1).toString().padStart(2, '0');
    const fallbackPrefix = `INV-${yy}${mm}-`;

    const { data: projectInvoicesData } = await supabase
      .from('invoices')
      .select('invoice_number, project_id')
      .in('project_id', projectIds);

    const invoicesByProject = (projectInvoicesData || []).reduce((acc: any, inv: any) => {
      if (inv.project_id) {
        if (!acc[inv.project_id]) acc[inv.project_id] = [];
        acc[inv.project_id].push(inv.invoice_number);
      }
      return acc;
    }, {});

    const gstRatesByProject: Record<string, number> = {};

    const { data: fallbackInvoicesData } = await supabase
      .from('invoices')
      .select('invoice_number')
      .ilike('invoice_number', `${fallbackPrefix}%`);
    const fallbackInvoiceNumbers = (fallbackInvoicesData || []).map((i: any) => i.invoice_number);

    // 4. Prepare batch insert payloads
    const invoicePayloads = [];
    const newlyGeneratedNumbers: Record<string, string[]> = {};
    const fallbackGenerated: string[] = [];
    const totalAmountsByProject: Record<string, number> = {};

    for (const m of milestonesToInvoice) {
      const existingInvoiceNumbers = m.project_id
        ? [...(invoicesByProject[m.project_id] || []), ...(newlyGeneratedNumbers[m.project_id] || [])]
        : [...fallbackInvoiceNumbers, ...fallbackGenerated];

      const invoiceNumber = generateSequentialCode('INV', existingInvoiceNumbers, m.project_id);

      if (m.project_id) {
        if (!newlyGeneratedNumbers[m.project_id]) newlyGeneratedNumbers[m.project_id] = [];
        newlyGeneratedNumbers[m.project_id].push(invoiceNumber);
      } else {
        fallbackGenerated.push(invoiceNumber);
      }

      const gstRate = m.project_id && gstRatesByProject[m.project_id] !== undefined ? gstRatesByProject[m.project_id] : 18;
      const gstAmount = (m.amount * gstRate) / 100;
      const totalAmount = m.amount + gstAmount;

      if (m.project_id) {
        totalAmountsByProject[m.project_id] = (totalAmountsByProject[m.project_id] || 0) + totalAmount;
      }

      invoicePayloads.push({
        id: `inv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        project_id: m.project_id,
        milestone_id: m.id,
        invoice_number: invoiceNumber,
        amount: m.amount,
        gst_rate: gstRate,
        gst_amount: gstAmount,
        total_amount: totalAmount,
        status: 'sent',
        due_date: m.due_date,
        notes: 'Auto-generated invoice 5 days prior to milestone deadline.',
        created_by: null
      });
    }

    // 5. Batch Insert Invoices
    const { data: generatedInvoices, error: invErr } = await supabase
      .from('invoices')
      .insert(invoicePayloads)
      .select();

    if (invErr) throw invErr;

    // 6. Batch Update project_finances
    const validProjectIds = Object.keys(totalAmountsByProject);
    if (validProjectIds.length > 0) {
      const { data: currentFinances } = await supabase
        .from('project_finances')
        .select('*')
        .in('project_id', validProjectIds);

      const financeMap = new Map((currentFinances || []).map((f: any) => [f.project_id, f]));

      const upsertPayloads = validProjectIds.map(projectId => {
        const addedAmount = totalAmountsByProject[projectId];
        const existing = financeMap.get(projectId);
        if (existing) {
          return {
            ...existing,
            total_invoiced_amount: Number((existing as any).total_invoiced_amount || 0) + addedAmount,
            updated_at: new Date().toISOString()
          };
        } else {
          return {
            project_id: projectId,
            total_quoted_amount: addedAmount,
            total_invoiced_amount: addedAmount,
            total_paid_amount: 0,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          };
        }
      });

      if (upsertPayloads.length > 0) {
        await supabase.from('project_finances').upsert(upsertPayloads, { onConflict: 'project_id' });
      }
    }

    return { success: true, data: { generated: generatedInvoices?.length || 0, invoices: generatedInvoices || [] } };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getProjectsFinancialSummaryAction(projectIds: string[]): Promise<ActionResponse> {
  try {
    if (!projectIds || projectIds.length === 0) return { success: true, data: {} };
    
    const supabase: any = await createClient();
    
    // We fetch all quotations instead of filtering by 'approved' only, because some 
    const [projectsRes, paymentsRes] = await Promise.all([
      supabase.from('projects').select('id, budget').in('id', projectIds),
      supabase.from('payments').select('project_id, amount').in('project_id', projectIds).eq('status', 'verified')
    ]);

    const summary: Record<string, { contract_value: number, received_amount: number }> = {};
    projectIds.forEach(id => {
      summary[id] = { contract_value: 0, received_amount: 0 };
    });

    if (projectsRes.data) {
      projectsRes.data.forEach((p: any) => {
        if (summary[p.id]) {
          summary[p.id].contract_value = Number(p.budget || 0);
        }
      });
    }

    if (paymentsRes.data) {
      paymentsRes.data.forEach((p: any) => {
        summary[p.project_id].received_amount += Number(p.amount || 0);
      });
    }

    return { success: true, data: normalizeData(summary) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getFinancialOverviewAction(): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const { unstable_noStore: noStore } = await import('next/cache');
    noStore();
    const auth = await requireAuthContext();
    if (auth.error) return { success: false, error: auth.error };

    const supabase: any = await createClient();

    // Prefer single SQL aggregate RPC (migration 20260731150000)
    try {
      const { data: summary, error: rpcErr } = await supabase.rpc('get_financial_overview_summary');
      if (!rpcErr && summary) {
        return { success: true, data: summary };
      }
    } catch {
      // fall through to JS aggregation
    }

    // Fallback: lean column selects (no select('*'))
    const [paymentsRes, expensesRes, invoicesRes, visitsRes] = await Promise.all([
      supabase.from('payments').select('status, amount, payment_date, created_at'),
      supabase.from('expenses').select('amount, expense_date, created_at, status, category'),
      supabase.from('invoices').select('status, total_amount'),
      supabase.from('project_visits').select('visit_cost, scheduled_date, created_at')
    ]);

    const payments = paymentsRes.data || [];
    const expenses = expensesRes.data || [];
    const invoices = invoicesRes.data || [];
    const visits = visitsRes.data || [];

    let totalIncome = 0;
    payments.forEach((p: any) => {
      if (p.status === 'verified' || p.status === 'approved' || p.status === 'paid' || p.status === 'pending') {
        // Treating all recorded payments as income (unless specifically rejected)
        if (p.status !== 'rejected') totalIncome += Number(p.amount || 0);
      }
    });

    let totalExpenses = 0;
    expenses.forEach((e: any) => {
      totalExpenses += Number(e.amount || 0);
    });
    visits.forEach((v: any) => {
      const amt = Number(v.visit_cost || 0);
      if (amt > 0) totalExpenses += amt;
    });

    // Monthly profit for current month
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    let currentMonthIncome = 0;
    payments.forEach((p: any) => {
      if (p.status !== 'rejected') {
        const d = new Date(p.payment_date || p.created_at);
        if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
          currentMonthIncome += Number(p.amount || 0);
        }
      }
    });

    let currentMonthExpense = 0;
    expenses.forEach((e: any) => {
      const d = new Date(e.expense_date || e.created_at);
      if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
        currentMonthExpense += Number(e.amount || 0);
      }
    });
    visits.forEach((v: any) => {
      const amt = Number(v.visit_cost || 0);
      if (amt > 0) {
        const d = new Date(v.scheduled_date || v.created_at);
        if (d.getMonth() === currentMonth && d.getFullYear() === currentYear) {
          currentMonthExpense += amt;
        }
      }
    });

    const monthlyProfit = currentMonthIncome - currentMonthExpense;

    // Accounts Receivable (Invoiced minus Paid)
    let totalInvoiced = 0;
    invoices.forEach((i: any) => {
      if (i.status !== 'cancelled') totalInvoiced += Number(i.total_amount || 0);
    });
    const accountsReceivable = Math.max(0, totalInvoiced - totalIncome);
    
    // Outstanding Payments (pending/unpaid invoices)
    let outstandingPayments = 0;
    invoices.forEach((i: any) => {
      if (['pending', 'sent', 'in_review', 'overdue'].includes(i.status)) {
        outstandingPayments += Number(i.total_amount || 0);
      }
    });

    // Accounts Payable (Pending Expenses)
    let accountsPayable = 0;
    expenses.forEach((e: any) => {
      if (e.status === 'pending') {
        accountsPayable += Number(e.amount || 0);
      }
    });

    // Cash flow grouped by month (Jan-Dec for current year)
    const monthlyCashFlowMap: Record<number, { income: number, expense: number }> = {};
    for (let i = 0; i < 12; i++) monthlyCashFlowMap[i] = { income: 0, expense: 0 };

    payments.forEach((p: any) => {
      if (p.status !== 'rejected') {
        const d = new Date(p.payment_date || p.created_at);
        if (d.getFullYear() === currentYear) {
          monthlyCashFlowMap[d.getMonth()].income += Number(p.amount || 0);
        }
      }
    });

    expenses.forEach((e: any) => {
      const d = new Date(e.expense_date || e.created_at);
      if (d.getFullYear() === currentYear) {
        monthlyCashFlowMap[d.getMonth()].expense += Number(e.amount || 0);
      }
    });

    visits.forEach((v: any) => {
      const amt = Number(v.visit_cost || 0);
      if (amt > 0) {
        const d = new Date(v.scheduled_date || v.created_at);
        if (d.getFullYear() === currentYear) {
          monthlyCashFlowMap[d.getMonth()].expense += amt;
        }
      }
    });

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthlyCashFlow = Object.keys(monthlyCashFlowMap).map(m => ({
      month: monthNames[Number(m)],
      income: monthlyCashFlowMap[Number(m)].income,
      expense: monthlyCashFlowMap[Number(m)].expense
    }));

    // Expense by category
    const categoryMap: Record<string, number> = {};
    expenses.forEach((e: any) => {
      const cat = e.category || 'Other';
      categoryMap[cat] = (categoryMap[cat] || 0) + Number(e.amount || 0);
    });
    const expenseByCategory: { category: string, amount: number }[] = [];
    Object.keys(categoryMap).forEach(key => {
      expenseByCategory.push({ category: key, amount: categoryMap[key] });
    });
    
    let fieldVisitSum = 0;
    visits.forEach((v: any) => {
      const amt = Number(v.visit_cost || 0);
      if (amt > 0) fieldVisitSum += amt;
    });
    if (fieldVisitSum > 0) {
      expenseByCategory.push({ category: 'Field Visit', amount: fieldVisitSum });
    }

    return {
      success: true,
      data: {
        totalIncome,
        totalExpenses,
        monthlyProfit,
        accountsReceivable,
        accountsPayable,
        outstandingPayments,
        monthlyCashFlow,
        expenseByCategory
      }
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getProjectProfitabilityAction(): Promise<{ success: boolean; data?: any; error?: string }> {
  try {
    const { unstable_noStore: noStore } = await import('next/cache');
    noStore();
    const auth = await requireAuthContext();
    if (auth.error) return { success: false, error: auth.error };

    const supabase: any = await createClient();

    const { data, error } = await supabase.rpc('get_project_profitability');

    if (error) {
      throw error;
    }

    // Results are already sorted by margin DESC in the RPC
    return { success: true, data: normalizeData(data) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function addProjectIncomeAction(projectId: string, payload: any): Promise<ActionResponse> {
  const { verifyProjectAccess } = await import('@/lib/permissions/permissions');
  const auth: any = await getUserProfileAction();
  if (!auth) return { success: false, error: 'Unauthorized' };

  const access = await verifyProjectAccess(projectId, auth.id, auth.role as any, true);
  if (!access.isAllowed) return { success: false, error: 'Access denied' };

  return logPaymentAction({ ...payload, project_id: projectId });
}

export async function addProjectExpenseAction(projectId: string, payload: any): Promise<ActionResponse> {
  const { verifyProjectAccess } = await import('@/lib/permissions/permissions');
  const { createExpenseAction } = await import('@/actions/expense.actions');
  const auth: any = await getUserProfileAction();
  if (!auth) return { success: false, error: 'Unauthorized' };

  const access = await verifyProjectAccess(projectId, auth.id, auth.role as any, true);
  if (!access.isAllowed) return { success: false, error: 'Access denied' };

  return createExpenseAction({ ...payload, project_id: projectId });
}

export async function getProjectFinancesAction(projectId: string): Promise<ActionResponse> {
  try {
    const auth: any = await getUserProfileAction();
    if (!auth) return { success: false, error: 'Unauthorized' };

    const { verifyProjectAccess } = await import('@/lib/permissions/permissions');
    const access = await verifyProjectAccess(projectId, auth.id, auth.role as any);
    if (!access.isAllowed) return { success: false, error: 'Access denied' };

    const supabase = await createClient();
    const { data, error } = await supabase.from('project_finances').select('*').eq('project_id', projectId).maybeSingle();

    if (error) return { success: false, error: error.message };
    return { success: true, data: normalizeData(data) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function markInvoiceAsSentAction(invoiceId: string) {
  try {
    const auth = await getUserProfileAction();
    if (!auth || !['accountant', 'executive'].includes(auth.role)) {
      return { success: false, error: 'Unauthorized' };
    }

    const supabase = await createClient();
    const { error } = await (supabase.from('invoices') as any)
      .update({ status: 'sent' })
      .eq('id', invoiceId)
      .eq('status', 'draft'); // Only update if it's currently a draft

    if (error) return { success: false, error: error.message };
    
    // Log the action
    await logAdminAuditAction({
      action: 'update_invoice',
      details: { entity: 'invoices', id: invoiceId, status: 'sent' },
      severity: 'info',
    });

    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getProjectBillingSummaryAction(filterProjectIds?: string[]): Promise<ActionResponse> {
  try {
    const { unstable_noStore: noStore } = await import('next/cache');
    noStore();
    const auth = await requireAuthContext();
    if (auth.error) return { success: false, error: auth.error };

    const supabase: any = await createClient();

    let query = supabase.from('projects').select('id, name, client_name, budget, status').is('deleted_at', null).neq('id', 'PRJ-PRINT-DESK');
    
    // Apply role-based filtering if needed (like in getInvoicesAction)
    if (auth.role !== 'admin' && auth.role !== 'accountant') {
      const assignedIds = await getAssignedProjectIds(auth.userId, auth.role);
      if (assignedIds !== null) {
        if (assignedIds.length === 0) return { success: true, data: [] };
        // If we also have a requested filter, intersect them
        if (filterProjectIds && filterProjectIds.length > 0) {
          const intersectedIds = assignedIds.filter(id => filterProjectIds.includes(id));
          if (intersectedIds.length === 0) return { success: true, data: [] };
          query = query.in('id', intersectedIds);
        } else {
          query = query.in('id', assignedIds);
        }
      }
    } else if (filterProjectIds && filterProjectIds.length > 0) {
      query = query.in('id', filterProjectIds);
    }

    const { data: projectsData, error: projError } = await query;
    if (projError) return { success: false, error: projError.message };

    const projectIds = projectsData?.map((p: any) => p.id) || [];
    if (projectIds.length === 0) return { success: true, data: [] };

    // Fetch invoices to know what has been billed
    const { data: invoicesData, error: invError } = await supabase
      .from('invoices')
      .select('project_id, total_amount, status')
      .in('project_id', projectIds)
      .neq('status', 'cancelled');

    if (invError) return { success: false, error: invError.message };

    // Fetch milestones to calculate dynamic budget
    const { data: milestonesData } = await supabase
      .from('project_milestones')
      .select('project_id, amount')
      .in('project_id', projectIds);

    // Fetch payments to know what has been collected
    const { data: paymentsData, error: payError } = await supabase
      .from('payments')
      .select('project_id, amount, status')
      .in('project_id', projectIds)
      .eq('status', 'verified');

    if (payError) return { success: false, error: payError.message };

    const billingMap: Record<string, any> = {};
    projectsData.forEach((p: any) => {
      billingMap[p.id] = {
        id: p.id,
        name: p.name,
        client_name: p.client_name,
        status: p.status,
        base_budget: p.budget || 0,
        budget: p.budget || 0,
        total_invoiced: 0,
        total_paid: 0,
        pending_balance: 0,
        milestone_sum: 0,
      };
    });

    invoicesData?.forEach((i: any) => {
      if (billingMap[i.project_id]) {
        billingMap[i.project_id].total_invoiced += Number(i.total_amount || 0);
      }
    });

    paymentsData?.forEach((p: any) => {
      if (billingMap[p.project_id]) {
        billingMap[p.project_id].total_paid += Number(p.amount || 0);
      }
    });

    milestonesData?.forEach((m: any) => {
      if (billingMap[m.project_id]) {
        billingMap[m.project_id].milestone_sum += Number(m.amount || 0);
      }
    });

    const result = Object.values(billingMap).map((b: any) => {
      let dynamicBudget = b.base_budget;
      if (dynamicBudget === 0) {
        if (b.milestone_sum > 0) dynamicBudget = b.milestone_sum;
        else if (b.total_invoiced > 0) dynamicBudget = b.total_invoiced;
      }
      
      return {
        ...b,
        budget: dynamicBudget,
        pending_balance: b.total_invoiced - b.total_paid
      };
    });

    // Sort by pending balance descending, then by name
    result.sort((a, b) => b.pending_balance - a.pending_balance || a.name.localeCompare(b.name));

    return { success: true, data: normalizeData(result) };

  } catch (error: any) {
    return { success: false, error: error.message };
  }
}


export async function getOutstandingBalancesAction(): Promise<ActionResponse> {
  try {
    const { unstable_noStore: noStore } = await import('next/cache');
    noStore();
    const auth = await requireAuthContext();
    if (auth.error) return { success: false, error: auth.error };

    const supabase: any = await createClient();

    const { data, error } = await supabase.rpc('get_outstanding_balances');

    if (error) {
      throw error;
    }

    return { success: true, data: normalizeData(data || []) };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateInvoiceBankAccountAction(invoiceId: string, bankId: string): Promise<ActionResponse> {
  try {
    const profile: any = await getUserProfileAction();
    if (!profile) return { success: false, error: 'Unauthorized' };

    if (profile.role !== 'admin' && profile.role !== 'accountant') {
      return { success: false, error: 'Access denied' };
    }

    const supabase: any = await createClient();
    const { error } = await supabase
      .from('invoices')
      .update({ bank_id: bankId })
      .eq('id', invoiceId)
      .eq('status', 'draft');

    if (error) return { success: false, error: error.message };
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateInvoiceStatusAction(invoiceId: string, status: string): Promise<ActionResponse> {
  try {
    const profile: any = await getUserProfileAction();
    if (!profile) return { success: false, error: 'Unauthorized' };

    const supabase: any = await createClient();
    
    const { data: invoice, error: fetchError } = await supabase.from('invoices').select('project_id, invoice_number, total_amount, status').eq('id', invoiceId).single();
    if (fetchError || !invoice) return { success: false, error: 'Invoice not found.' };

    const lockCheck = await verifyProjectNotLocked(invoice.project_id);
    if (!lockCheck.success) {
      return { success: false, error: lockCheck.error || "Project is locked." };
    }

    const { error: updateError } = await supabase
      .from('invoices')
      .update({ status })
      .eq('id', invoiceId);
      
    if (updateError) return { success: false, error: updateError.message };

    await supabase.from('activity_logs').insert({
      id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      project_id: invoice.project_id,
      user_id: profile.id,
      action: 'INVOICE_STATUS_UPDATED',
      details: { invoice_id: invoiceId, status },
      created_at: new Date().toISOString()
    });

    let auditAction: any = 'INVOICE_UPDATED';
    let description = `Updated invoice status to ${status}`;
    if (status.toLowerCase() === 'paid') {
      auditAction = 'INVOICE_MARKED_PAID';
      description = `Marked invoice ${invoice.invoice_number} as Paid for ₹${invoice.total_amount}`;
    }

    await createAuditLog({
      action: auditAction,
      module: 'Invoices',
      entityType: 'Invoice',
      entityId: invoiceId,
      description,
      oldValue: { status: invoice.status },
      newValue: { status },
    });

    await revalidateAccountsPaths(invoice.project_id);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}


export async function publicUpdateInvoiceStatusAction(invoiceId: string, status: string): Promise<ActionResponse> {
  try {
    const supabase = await createClient(); // assuming createAdminClient or similar if RLS blocks public update
    
    // Instead of createClient which uses the user auth, we should use createAdminClient
    const { createAdminClient } = await import('@/lib/supabase/admin');
    const adminSupabase: any = createAdminClient();

    const { data: invoice, error: fetchError } = await adminSupabase.from('invoices').select('project_id').eq('id', invoiceId).single();
    if (fetchError || !invoice) return { success: false, error: 'Invoice not found.' };

    const { error: updateError } = await adminSupabase
      .from('invoices')
      .update({ status: status as any })
      .eq('id', invoiceId);
      
    if (updateError) return { success: false, error: updateError.message };

    await adminSupabase.from('activity_logs').insert({
      id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      project_id: invoice.project_id,
      user_id: '00000000-0000-0000-0000-000000000000', // System or public user
      action: 'INVOICE_STATUS_UPDATED_BY_CLIENT',
      details: { invoice_id: invoiceId, status },
      created_at: new Date().toISOString()
    });

    await revalidateAccountsPaths(invoice.project_id);
    return { success: true };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getPendingInvoicesCountAction() {
  try {
    const supabase: any = await createClient();
    const { count, error } = await supabase
      .from('invoices')
      .select('*', { count: 'exact', head: true })
      .in('status', ['pending', 'sent', 'in_review', 'overdue']);
    if (error) throw error;
    return { success: true, data: count || 0 };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getProjectsWithFinancialsAction(filterStatuses?: string[]): Promise<ActionResponse> {
  try {
    const { unstable_noStore: noStore } = await import('next/cache');
    noStore();
    const profile: any = await getUserProfileAction();
    if (!profile) return { success: false, error: 'Unauthorized' };

    const role = profile.role as string;
    const isGlobalRole = ['admin', 'sales', 'accountant', 'hr'].includes(role);

    const supabase: any = await createClient();

    let query = supabase.rpc('get_project_financials_summary', {
      statuses: filterStatuses || null
    });

    const { data: projects, error } = await query;
    if (error) throw error;

    return { success: true, data: projects };
  } catch (error: any) {
    console.error("getProjectsWithFinancialsAction error:", error);
    return { success: false, error: error.message };
  }
}

export async function getProjectFinanceTabDataAction(projectId: string): Promise<ActionResponse> {
  try {
    const { unstable_noStore: noStore } = await import('next/cache');
    noStore();
    
    // Import other actions dynamically to avoid circular dependencies
    const { getFieldVisitsAction } = await import('@/actions/operations.actions');
    const { getExpensesAction } = await import('@/actions/expense.actions');

    const [
      visitsRes,
      accountantRes,
      projectFinancesRes,
      invoicesRes,
      paymentsRes,
      expensesRes
    ] = await Promise.all([
      getFieldVisitsAction(projectId),
      getAccountantOwnerAction(projectId).catch(() => ({ success: true, data: null })),
      getProjectFinancesAction(projectId),
      getInvoicesAction(projectId),
      getPaymentsAction(projectId),
      getExpensesAction({ project_id: projectId })
    ]);

    return {
      success: true,
      data: {
        activeQuotation: null,
        visits: visitsRes?.data || [],
        accountantOwner: accountantRes?.data || null,
        projectFinances: projectFinancesRes?.success ? projectFinancesRes.data : null,
        projectInvoices: invoicesRes?.success ? invoicesRes.data : [],
        projectPayments: paymentsRes?.success ? paymentsRes.data : [],
        projectExpenses: expensesRes?.success ? expensesRes.data : []
      }
    };
  } catch (error: any) {
    console.error("Finance Tab Data Fetch Error:", error);
    return { success: false, error: error.message || 'Failed to load finance tab data' };
  }
}

/**
 * Billing workspace — parallel lean queries instead of one giant nested select('*').
 * Caps list tables at 100 rows; project summary keeps aggregates via nested amount fields only.
 */
export async function getBillingWorkspaceDataAction(): Promise<ActionResponse> {
  try {
    const { unstable_noStore: noStore } = await import('next/cache');
    noStore();
    const auth = await requireAuthContext();
    if (auth.error) return { success: false, error: auth.error };

    const supabase: any = await createClient();

    let assignedIds: string[] | null = null;
    if (auth.role !== 'admin' && auth.role !== 'accountant') {
      assignedIds = await getAssignedProjectIds(auth.userId, auth.role);
      if (assignedIds !== null && assignedIds.length === 0) {
        return { success: true, data: { projects: [], invoices: [], payments: [], milestones: [] } };
      }
    }

    const applyProjectScope = (q: any, col = 'project_id') => {
      if (assignedIds) return q.in(col, assignedIds);
      return q;
    };

    let projectsQuery = supabase
      .rpc('get_billing_workspace_summary', { workspace_id: null })
      .order('updated_at', { ascending: false })
      .limit(200);

    if (assignedIds) projectsQuery = projectsQuery.in('id', assignedIds);

    let invoicesQuery = applyProjectScope(
      supabase
        .from('invoices')
        .select(INVOICE_LIST_SELECT)
        .is('projects.deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(100)
    );

    // Note: payment_date + bank_id exist via migrations (types may lag).
    let paymentsQuery = applyProjectScope(
      supabase
        .from('payments')
        .select(
          'id, project_id, invoice_id, amount, status, payment_method, transaction_id, payment_date, created_at, bank_id, projects!inner(name, client_name, deleted_at), bank_accounts(bank_name), invoices(invoice_number, project_milestones(title))'
        )
        .is('projects.deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(100)
    );

    // block_after_stage does NOT exist on project_milestones — never select it.
    let milestonesQuery = applyProjectScope(
      supabase
        .from('project_milestones')
        .select(
          'id, project_id, title, amount, status, due_date, sort_order, linked_stage, is_activation_gate, created_at, projects!inner(name, client_name, budget, status, deleted_at)'
        )
        .is('projects.deleted_at', null)
        .order('due_date', { ascending: true })
        .limit(100)
    );

    const [projectsRes, invoicesRes, paymentsRes, milestonesRes] = await Promise.all([
      projectsQuery,
      invoicesQuery,
      paymentsQuery,
      milestonesQuery,
    ]);

    // Fail hard only if projects (summary spine) fails; partial lists still usable.
    if (projectsRes.error) return { success: false, error: projectsRes.error.message };
    if (invoicesRes.error) console.error('[billing] invoices:', invoicesRes.error.message);
    if (paymentsRes.error) console.error('[billing] payments:', paymentsRes.error.message);
    if (milestonesRes.error) console.error('[billing] milestones:', milestonesRes.error.message);

    const billingSummary = (projectsRes.data || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      client_name: p.client_name,
      status: p.status,
      base_budget: Number(p.base_budget || 0),
      budget: Number(p.budget || 0),
      total_invoiced: Number(p.total_invoiced || 0),
      total_paid: Number(p.total_paid || 0),
      pending_balance: Number(p.pending_balance || 0),
      milestone_sum: Number(p.milestone_sum || 0),
    }));

    const invoices = (invoicesRes.data || []).map((inv: any) => ({
      ...inv,
      projects: inv.projects,
    }));

    const payments = (paymentsRes.data || []).map((pay: any) => ({
      ...pay,
      projects: pay.projects,
    }));

    const milestones = (milestonesRes.data || []).map((m: any) => ({
      ...m,
      projects: m.projects,
      invoices: invoices.filter((i: any) => i.milestone_id === m.id),
    }));

    return {
      success: true,
      data: normalizeData({
        projects: billingSummary,
        invoices,
        payments,
        milestones,
      }),
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getLedgerWorkspaceDataAction(): Promise<ActionResponse> {
  try {
    const { unstable_noStore: noStore } = await import('next/cache');
    noStore();
    const auth = await requireAuthContext();
    if (auth.error) return { success: false, error: auth.error };

    const supabase: any = await createClient();

    let projectIdsFilter: string[] | null = null;
    if (auth.role !== 'admin' && auth.role !== 'accountant') {
      const assignedIds = await getAssignedProjectIds(auth.userId, auth.role);
      if (assignedIds !== null) {
        if (assignedIds.length === 0) return { success: true, data: { invoices: [], payments: [], expenses: [], projects: [], visits: [], payroll: [] } };
        projectIdsFilter = assignedIds;
      }
    }

    const projectsQuery = supabase.from('projects').select('id, name').neq('id', 'PRJ-PRINT-DESK');
    const invoicesQuery = supabase.from('invoices').select('id, created_at, project_id, invoice_number, total_amount, status');
    const paymentsQuery = supabase.from('payments').select('id, created_at, payment_date, project_id, transaction_id, payment_method, amount, status, receipt_url, bank_accounts(bank_name)');
    const expensesQuery = supabase.from('expenses').select('id, expense_date, project_id, category, description, amount, status, receipt_url, profiles(first_name, last_name), bank_accounts(bank_name)');
    const visitsQuery = supabase.from('project_visits').select('id, created_at, scheduled_date, project_id, purpose, visit_cost, status');
    
    if (projectIdsFilter) {
      projectsQuery.in('id', projectIdsFilter);
      invoicesQuery.in('project_id', projectIdsFilter);
      paymentsQuery.in('project_id', projectIdsFilter);
      // For expenses, we allow company-wide (project_id is null) plus assigned projects
      expensesQuery.or(`project_id.in.(${projectIdsFilter.join(',')}),project_id.is.null`);
      visitsQuery.in('project_id', projectIdsFilter);
    }

    const [projectsRes, invoicesRes, paymentsRes, expensesRes, visitsRes, payrollRes] = await Promise.all([
      projectsQuery,
      invoicesQuery,
      paymentsQuery,
      expensesQuery,
      visitsQuery,
      supabase.from('payroll_cycles').select('id, month, year, status, created_at, bank_accounts(bank_name), payroll_snapshots(net_payable)').eq('status', 'locked')
    ]);

    // Build project map in JS to avoid redundant SQL joins
    const projectsMap = new Map();
    (projectsRes.data || []).forEach((p: any) => projectsMap.set(p.id, p));

    const attachProject = (arr: any[]) => arr.map(item => ({ ...item, projects: item.project_id ? projectsMap.get(item.project_id) : null }));

    return {
      success: true,
      data: normalizeData({
        projects: projectsRes.data || [],
        invoices: attachProject(invoicesRes.data || []),
        payments: attachProject(paymentsRes.data || []),
        expenses: attachProject(expensesRes.data || []),
        visits: attachProject(visitsRes.data || []),
        payroll: payrollRes.data || []
      })
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
