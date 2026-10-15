"use server";

import { normalizeData } from '@/lib/normalize';
 
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

import { getUserProfileAction } from "@/actions/auth.actions";

export async function getBankAccountsAction() {
  try {
    const profile: any = await getUserProfileAction();
    if (!profile) return { success: false, error: "Unauthorized" };

    // User-scoped client — bank_accounts RLS gates rows; no service-role bypass
    const supabase: any = await createClient();
    const { data, error } = await supabase
      .from("bank_accounts")
      .select(
        "id, bank_name, account_name, account_number, ifsc_code, branch_name, is_default, account_usage, opening_balance, current_balance, created_at, updated_at"
      )
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) throw error;
    return { success: true, data: normalizeData(data) };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function saveBankAccountAction(payload: any) {
  try {
    const supabase = await createClient();
    
    // If setting this one as default, unset others first
    if (payload.is_default) {
      const { error: unsetError } = await (supabase as any)
        .from("bank_accounts")
        .update({ is_default: false })
        .eq("is_default", true)
        .neq("id", payload.id || "00000000-0000-0000-0000-000000000000");
      if (unsetError) throw unsetError;
    }

    let bankId = payload.id;
    
    // Explicitly define allowed fields to prevent overriding system columns like reconciliation_review_status
    const allowedFields = {
      bank_name: payload.bank_name,
      account_name: payload.account_name,
      account_number: payload.account_number,
      ifsc_code: payload.ifsc_code,
      branch_name: payload.branch_name,
      is_default: payload.is_default,
      account_usage: payload.account_usage,
      opening_balance: payload.opening_balance
    };

    if (payload.id) {
      const { error } = await (supabase as any)
        .from("bank_accounts")
        .update(allowedFields)
        .eq("id", payload.id);
      if (error) throw error;
    } else {
      const { data, error } = await (supabase as any)
        .from("bank_accounts")
        .insert([allowedFields])
        .select("id")
        .single();
      if (error) throw error;
      if (data) {
        bankId = data.id;
      }
    }

    if (bankId) {
      await syncBankBalance(bankId);
    }

    revalidatePath("/accounts/banks");
    revalidatePath("/(modules)/(shared)/settings/account");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function syncBankBalance(bankId: string) {
  try {
    const supabase = await createClient();
    
    // Calculate and update the balance via RPC
    const { error: rpcError } = await (supabase as any).rpc('sync_bank_balances_rpc', { p_bank_id: bankId });
    if (rpcError) throw rpcError;

    // Fetch the newly updated balance to return it
    const { data: bank, error: bankError } = await (supabase as any)
      .from("bank_accounts")
      .select("current_balance")
      .eq("id", bankId)
      .single();
      
    if (bankError) throw bankError;
    if (!bank) throw new Error("Bank account not found");

    revalidatePath("/accounts/banks");
    revalidatePath("/accounts/reconciliation");
    return { success: true, currentBalance: bank.current_balance };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function recalculateAllBankBalancesAction() {
  try {
    const supabase = await createClient();
    
    // Calculates and updates balances for all banks transactionally
    const { error: rpcError } = await (supabase as any).rpc('sync_bank_balances_rpc');
    if (rpcError) throw rpcError;

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}


export async function deleteBankAccountAction(id: string) {
  try {
    const supabase = await createClient();

    // 1. Check for payments
    const { count: paymentCount, error: payError } = await (supabase as any)
      .from("payments")
      .select("id", { count: "exact", head: true })
      .eq("bank_id", id);
    if (payError) throw payError;

    // 2. Check for expenses
    const { count: expenseCount, error: expError } = await (supabase as any)
      .from("expenses")
      .select("id", { count: "exact", head: true })
      .eq("bank_id", id);
    if (expError) throw expError;

    // 3. Check for payroll_payments
    const { count: payrollCount, error: payrollError } = await (supabase as any)
      .from("payroll_payments")
      .select("id", { count: "exact", head: true })
      .eq("bank_id", id);
    if (payrollError) throw payrollError;

    // 4. Check for reconciliations
    const { count: reconCount, error: reconError } = await (supabase as any)
      .from("bank_reconciliations")
      .select("id", { count: "exact", head: true })
      .eq("bank_id", id);
    if (reconError) throw reconError;

    // 5. Check for invoices
    const { count: invoiceCount, error: invoiceError } = await (supabase as any)
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .eq("bank_id", id);
    if (invoiceError) throw invoiceError;

    if (
      (paymentCount || 0) > 0 ||
      (expenseCount || 0) > 0 ||
      (payrollCount || 0) > 0 ||
      (reconCount || 0) > 0 ||
      (invoiceCount || 0) > 0
    ) {
      return {
        success: false,
        error: "This bank account contains historical transactions or is linked to existing documents and cannot be deleted. Please archive or deactivate it instead.",
      };
    }

    const { error } = await (supabase as any)
      .from("bank_accounts")
      .delete()
      .eq("id", id);

    if (error) throw error;
    revalidatePath("/accounts/banks");
    revalidatePath("/(modules)/(shared)/settings/account");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function setDefaultBankAccountAction(id: string) {
  try {
    const supabase = await createClient();
    
    // Unset all first
    const { error: err1 } = await (supabase as any)
      .from("bank_accounts")
      .update({ is_default: false })
      .eq("is_default", true)
      .neq("id", id);
      
    if (err1) throw err1;

    // Set the selected one
    const { error: err2 } = await (supabase as any)
      .from("bank_accounts")
      .update({ is_default: true })
      .eq("id", id);

    if (err2) throw err2;

    revalidatePath("/accounts/banks");
    revalidatePath("/(modules)/(shared)/settings/account");
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getBankAccountDetailsAction(bankId: string) {
  try {
    const profile: any = await getUserProfileAction();
    if (!profile) return { success: false, error: "Unauthorized" };

    const supabase = await createClient();
    const { data, error } = await (supabase as any)
      .from("bank_accounts")
      .select(
        "id, bank_name, account_name, account_number, ifsc_code, branch_name, is_default, account_usage, opening_balance, current_balance, created_at, updated_at"
      )
      .eq("id", bankId)
      .single();

    if (error) throw error;
    return { success: true, data: normalizeData(data) };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getBankAccountLedgerAction(bankId: string, limit: number = 100) {
  try {
    const profile: any = await getUserProfileAction();
    if (!profile) return { success: false, error: "Unauthorized. Please log in." };

    if (profile.role !== "admin" && profile.role !== "accountant") {
      return { success: false, error: "Access denied. Accountant or Admin only." };
    }

    const supabase = await createClient();

    // 1. Fetch Bank Account metadata
    const { data: bank, error: bankError } = await (supabase as any)
      .from("bank_accounts")
      .select("*")
      .eq("id", bankId)
      .single();
    if (bankError) throw bankError;

    // 2. Fetch Payments (Inflow/Credit) - limit records, but sum all for correct header
    const { data: paymentsSum, error: paymentsSumError } = await (supabase as any)
      .from("payments")
      .select("amount")
      .eq("bank_id", bankId)
      .eq("status", "verified");
    if (paymentsSumError) throw paymentsSumError;
    const totalCredits = (paymentsSum || []).reduce((sum: number, p: any) => sum + Number(p.amount || 0), 0);

    const { data: payments, error: paymentsError } = await (supabase as any)
      .from("payments")
      .select("id, amount, payment_method, transaction_id, payment_date, created_at, verified_by, profiles!verified_by(first_name, last_name)")
      .eq("bank_id", bankId)
      .eq("status", "verified")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (paymentsError) throw paymentsError;

    // 3. Fetch Expenses (Outflow/Debit) - limit records, but sum all
    const { data: expensesSum, error: expensesSumError } = await (supabase as any)
      .from("expenses")
      .select("amount")
      .eq("bank_id", bankId);
    if (expensesSumError) throw expensesSumError;
    const totalExpenses = (expensesSum || []).reduce((sum: number, e: any) => sum + Number(e.amount || 0), 0);

    const { data: expenses, error: expensesError } = await (supabase as any)
      .from("expenses")
      .select("id, amount, description, category, expense_date, created_at, created_by, profiles!created_by(first_name, last_name)")
      .eq("bank_id", bankId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (expensesError) throw expensesError;

    // 4. Fetch Payroll Payments (Outflow/Debit) - limit records, but sum all
    const { data: payrollsSum, error: payrollsSumError } = await (supabase as any)
      .from("payroll_payments")
      .select("payment_total_amount")
      .eq("bank_id", bankId);
    if (payrollsSumError) throw payrollsSumError;
    const totalPayrollPaid = (payrollsSum || []).reduce((sum: number, pr: any) => sum + Number(pr.payment_total_amount || 0), 0);
    
    const totalDebits = totalExpenses + totalPayrollPaid;

    const { data: payrolls, error: payrollsError } = await (supabase as any)
      .from("payroll_payments")
      .select("id, payment_total_amount, payment_date, payment_reference, payment_method, created_at, paid_by, profiles!paid_by(first_name, last_name), payroll_cycles(month, year)")
      .eq("bank_id", bankId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (payrollsError) throw payrollsError;

    // 5. Normalize and merge in TypeScript
    const transactions: any[] = [];

    // Normalize Payments
    (payments || []).forEach((p: any) => {
      const amt = Number(p.amount || 0);
      const creator = p.profiles;
      const creatorName = creator ? `${creator.first_name} ${creator.last_name}`.trim() : "System";
      transactions.push({
        id: p.id,
        date: p.payment_date || p.created_at,
        module: "Payment",
        reference: p.transaction_id || p.payment_method || "Payment",
        description: `Client payment received via ${p.payment_method}`,
        category: "Income",
        credit: amt,
        debit: 0,
        createdBy: creatorName,
        status: "verified",
        recordId: p.id,
      });
    });

    // Normalize Expenses
    (expenses || []).forEach((e: any) => {
      const amt = Number(e.amount || 0);
      const creator = e.profiles;
      const creatorName = creator ? `${creator.first_name} ${creator.last_name}`.trim() : "System";
      transactions.push({
        id: e.id,
        date: e.expense_date || e.created_at,
        module: "Expense",
        reference: `EXP-${e.id.slice(0, 8)}`,
        description: e.description || "Business Expense",
        category: e.category || "Uncategorized",
        credit: 0,
        debit: amt,
        createdBy: creatorName,
        status: "paid",
        recordId: e.id,
      });
    });

    // Normalize Payroll
    (payrolls || []).forEach((pr: any) => {
      const amt = Number(pr.payment_total_amount || 0);
      const creator = pr.profiles;
      const creatorName = creator ? `${creator.first_name} ${creator.last_name}`.trim() : "System";
      const cycle = pr.payroll_cycles;
      const cyclePeriod = cycle ? `${cycle.month}/${cycle.year}` : "—";
      transactions.push({
        id: pr.id,
        date: pr.payment_date || pr.created_at,
        module: "Payroll",
        reference: pr.payment_reference || pr.payment_method || "Payroll",
        description: `Salary payouts for cycle ${cyclePeriod}`,
        category: "Payroll",
        credit: 0,
        debit: amt,
        createdBy: creatorName,
        status: "paid",
        recordId: pr.id,
      });
    });

    // Sort chronologically ascending (oldest first)
    transactions.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Slice to the latest limit transactions
    const finalTransactions = transactions.slice(-limit);

    return {
      success: true,
      data: {
        bank: normalizeData(bank),
        openingBalance: Number(bank.opening_balance || 0),
        currentBalance: Number(bank.current_balance || 0),
        totalCredits,
        totalDebits,
        transactions: finalTransactions,
      },
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getTotalBankBalanceAction() {
  try {
    const profile: any = await getUserProfileAction();
    if (!profile) return { success: false, error: 'Unauthorized' };
    if (!['admin', 'accountant'].includes(profile.role)) {
      return { success: false, error: 'Access denied' };
    }

    const supabase: any = await createClient();
    const { data, error } = await supabase
      .from('bank_accounts')
      .select('current_balance');
    if (error) throw error;
    
    const total = (data || []).reduce((sum: number, b: any) => sum + Number(b.current_balance || 0), 0);
    return { success: true, data: total };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
