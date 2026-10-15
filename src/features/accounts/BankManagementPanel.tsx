"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { Plus, Trash2, Edit, CheckCircle2, Save, X, Loader2, Landmark, CreditCard, Building2, Hash, Tag } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { 
  getBankAccountsAction, 
  saveBankAccountAction, 
  deleteBankAccountAction, 
  setDefaultBankAccountAction 
} from "@/actions/bank.actions";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/modules/PageHeader";

export function BankManagementPanel() {
  const router = useRouter();
  const [banks, setBanks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingBank, setEditingBank] = useState<any>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const loadBanks = async () => {
    setLoading(true);
    const res = await getBankAccountsAction();
    if (res.success) {
      setBanks(res.data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadBanks();
  }, []);

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this bank account?")) return;
    const res = await deleteBankAccountAction(id);
    if (res.success) {
      toast.success("Bank account deleted");
      loadBanks();
    } else {
      toast.error(res.error || "Failed to delete bank account");
    }
  };

  const handleSetDefault = async (id: string) => {
    const res = await setDefaultBankAccountAction(id);
    if (res.success) {
      toast.success("Default bank account updated");
      loadBanks();
    } else {
      toast.error(res.error || "Failed to update default bank account");
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBank) return;

    if (!editingBank.bank_name || !editingBank.account_name || !editingBank.account_number || !editingBank.ifsc_code || !editingBank.branch_name) {
      toast.error("Please fill in all required fields");
      return;
    }

    const res = await saveBankAccountAction(editingBank);
    if (res.success) {
      toast.success("Bank account saved successfully");
      setEditingBank(null);
      loadBanks();
    } else {
      toast.error(res.error || "Failed to save bank account");
    }
  };

  return (
    <div className="space-y-8 font-sans">
      <PageHeader
        title="Bank Accounts"
        subtitle="Configure default and secondary bank accounts for invoice and client payment processing."
        icon={Landmark}
        actions={
          !loading && (
            <button
              onClick={() => setEditingBank({ 
                bank_name: "", account_name: "", account_number: "", ifsc_code: "", branch_name: "", is_default: false, account_usage: "Operations", opening_balance: 0 
              })}
              className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-md shadow-indigo-600/10 active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              <span>Add Bank Account</span>
            </button>
          )
        }
      />

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        </div>
      ) : (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-3"
        >
          {banks.map((bank, index) => {
            const cardThemes = [
              {
                light: "bg-gradient-to-tr from-[#f5f7ff] via-white to-[#eef2ff] border-slate-200 text-slate-800 shadow-indigo-100/20",
                dark: "dark:from-[#0c0f24] dark:via-[#13183a] dark:to-[#0c0f24] dark:border-indigo-900/50 dark:text-white"
              },
              {
                light: "bg-gradient-to-tr from-[#f3faf7] via-white to-[#ebf7f2] border-slate-200 text-slate-850 shadow-emerald-100/20",
                dark: "dark:from-[#081515] dark:via-[#0c2020] dark:to-[#081515] dark:border-emerald-950/50 dark:text-emerald-100"
              },
              {
                light: "bg-gradient-to-tr from-[#fffbeb] via-white to-[#fef3c7]/30 border-slate-200 text-slate-850 shadow-amber-100/10",
                dark: "dark:from-[#1c120c] dark:via-[#261b13] dark:to-[#1c120c] dark:border-amber-950/50 dark:text-amber-100"
              },
              {
                light: "bg-gradient-to-tr from-[#faf5ff] via-white to-[#f3e8ff]/40 border-slate-200 text-slate-850 shadow-purple-100/25",
                dark: "dark:from-[#120a21] dark:via-[#1c0f32] dark:to-[#120a21] dark:border-purple-950/50 dark:text-purple-100"
              }
            ];
            const theme = cardThemes[index % cardThemes.length];
            
            return (
              <div
                key={bank.id}
                onClick={() => router.push(`/accounts/banking/accounts/${bank.id}`)}
                className={cn(
                  "relative group overflow-hidden rounded-2xl border transition-all duration-500 ease-out p-6 shadow-md w-full min-h-[255px] flex flex-col justify-between hover:-translate-y-2 hover:scale-[1.015] hover:shadow-xl hover:shadow-indigo-500/5 dark:hover:shadow-indigo-500/10 cursor-pointer",
                  theme.light,
                  theme.dark,
                  bank.is_default && "border-indigo-500 shadow-indigo-100/50 dark:border-indigo-500/50 dark:shadow-indigo-500/10"
                )}
              >
                <div className="absolute -top-16 -right-16 w-36 h-36 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 rounded-full blur-2xl pointer-events-none opacity-80" />
                <div className="absolute -bottom-16 -left-16 w-36 h-36 bg-gradient-to-br from-purple-500/5 to-indigo-500/10 rounded-full blur-2xl pointer-events-none opacity-80" />

                <div className="relative z-10 flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "flex h-10 w-10 items-center justify-center rounded-lg shadow-sm border",
                      bank.is_default
                        ? "bg-indigo-50/60 border-indigo-100/80 text-indigo-600 dark:bg-white/10 dark:border-white/20 dark:text-white"
                        : "bg-slate-50 border-slate-200/60 text-slate-600 dark:bg-white/5 dark:border-white/10 dark:text-slate-300"
                    )}>
                      <Landmark className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold tracking-tight leading-none text-slate-950 dark:text-white">{bank.bank_name}</h3>
                        {bank.is_default && (
                          <span className="bg-emerald-500/10 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-500/20 text-[9px] font-bold uppercase tracking-widest py-0.5 px-2 rounded-full">
                            Default
                          </span>
                        )}
                        {(bank as any).reconciliation_review_status === 'needs_review' && (
                          <span title="Backdated transactions have affected previous reconciliations." className="bg-amber-500/10 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400 border border-amber-500/20 text-[9px] font-bold uppercase tracking-widest py-0.5 px-2 rounded-full cursor-help whitespace-nowrap">
                            Needs Review
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] font-semibold mt-1.5 uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        {bank.branch_name}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!bank.is_default && (
                      <button onClick={(e) => { e.stopPropagation(); handleSetDefault(bank.id); }} className="p-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-md transition-colors" title="Set as Default">
                        <CheckCircle2 className="w-4 h-4 text-slate-400 hover:text-emerald-500" />
                      </button>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); setEditingBank(bank); }} className="p-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-md transition-colors" title="Edit">
                      <Edit className="w-4 h-4 text-slate-400 hover:text-blue-500" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(bank.id); }} className="p-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-md transition-colors" title="Delete">
                      <Trash2 className="w-4 h-4 text-slate-400 hover:text-rose-500" />
                    </button>
                  </div>
                </div>

                <div className="relative z-10 flex flex-col justify-end flex-1 mt-6">
                  <div className="flex items-center justify-between gap-3 mb-3">
                    <div className="w-10 h-7 rounded bg-gradient-to-br from-yellow-200 to-yellow-500 border border-yellow-600/30 overflow-hidden relative opacity-90">
                       <div className="absolute inset-0 bg-yellow-900/10 border-x border-yellow-900/10 mx-2" />
                       <div className="absolute inset-0 bg-yellow-900/10 border-y border-yellow-900/10 my-1.5" />
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-semibold uppercase tracking-wider block text-slate-400 dark:text-slate-500">Current Balance</span>
                      <span className="text-base font-black text-slate-900 dark:text-white">
                        ₹{(bank.current_balance ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <span className="text-[10px] font-semibold uppercase tracking-wider block mb-1 text-slate-400 dark:text-slate-500">Account Number</span>
                      <p className="text-lg tracking-[0.15em] font-semibold text-slate-900 dark:text-white drop-shadow-sm">
                        {bank.account_number.replace(/(\d{4})/g, '$1 ').trim()}
                      </p>
                    </div>
                    
                    <div className="flex justify-between items-end">
                      <div>
                        <span className="text-[10px] font-semibold uppercase tracking-wider block mb-0.5 text-slate-400 dark:text-slate-500">Purpose</span>
                        <p className="text-xs font-bold tracking-wide uppercase text-slate-800 dark:text-slate-200">{bank.account_usage || "Operations"}</p>
                      </div>
                      <div className="text-center">
                        <span className="text-[10px] font-semibold uppercase tracking-wider block mb-0.5 text-slate-400 dark:text-slate-500">Opening Balance</span>
                        <p className="text-xs font-bold tracking-wide text-slate-800 dark:text-slate-200">₹{(bank.opening_balance ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] font-semibold uppercase tracking-wider block mb-0.5 text-slate-400 dark:text-slate-500">IFSC</span>
                        <p className="text-xs font-bold tracking-wide uppercase text-slate-800 dark:text-slate-200">{bank.ifsc_code}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {banks.length === 0 && (
            <div className="col-span-full flex flex-col items-center justify-center py-20 text-center rounded-3xl border border-dashed border-slate-300 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20">
              <div className="w-20 h-20 bg-white dark:bg-slate-800 rounded-2xl shadow-sm flex items-center justify-center mb-6 transform -rotate-6">
                <Landmark className="w-10 h-10 text-indigo-500" />
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2 tracking-tight">
                No Bank Accounts Found
              </h3>
              <p className="text-sm font-medium text-slate-500 max-w-sm mb-8">
                Add your first bank account to display payment details clearly on your invoices.
              </p>
              <button
                onClick={() => setEditingBank({ 
                  bank_name: "", account_name: "", account_number: "", ifsc_code: "", branch_name: "", is_default: true, account_usage: "Operations", opening_balance: 0 
                })}
                className="flex items-center gap-2 px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-indigo-600/20 active:scale-[0.98]"
              >
                <Plus className="w-4 h-4" />
                <span>Add First Bank Account</span>
              </button>
            </div>
          )}
        </motion.div>
      )}

      {editingBank && mounted && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 overflow-y-auto font-sans">
          <div className="absolute inset-0 bg-slate-900/40 dark:bg-[#020408]/80 backdrop-blur-2xl animate-in fade-in duration-300" onClick={() => setEditingBank(null)} />
          
          <div className="relative w-full max-w-xl bg-white dark:bg-[#080b14] rounded-2xl border border-slate-200 dark:border-white/10 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300 my-8">
            <div className="relative z-10 flex items-center justify-between p-6 border-b border-slate-200/50 dark:border-white/10">
              <h3 className="text-xl font-bold text-slate-800 dark:text-white tracking-tight flex items-center gap-2.5">
                <Landmark className="w-5 h-5 text-indigo-500" />
                {editingBank.id ? "Edit Bank Account" : "New Bank Account"}
              </h3>
              <button
                onClick={() => setEditingBank(null)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl transition-colors text-slate-500 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="relative z-10 p-6 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-2">
                    <Landmark className="h-3.5 w-3.5 text-indigo-500/70" /> Bank name *
                  </label>
                  <input
                    type="text"
                    value={editingBank.bank_name || ""}
                    onChange={(e) => setEditingBank({ ...editingBank, bank_name: e.target.value })}
                    className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-white/10 bg-white/50 dark:bg-black/20 text-sm font-semibold text-slate-900 dark:text-white focus:bg-white dark:focus:bg-[#0f1526] focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all shadow-sm"
                    placeholder="e.g. HDFC Bank"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-2">
                    <CreditCard className="h-3.5 w-3.5 text-indigo-500/70" /> Account name *
                  </label>
                  <input
                    type="text"
                    value={editingBank.account_name || ""}
                    onChange={(e) => setEditingBank({ ...editingBank, account_name: e.target.value })}
                    className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-white/10 bg-white/50 dark:bg-black/20 text-sm font-semibold text-slate-900 dark:text-white focus:bg-white dark:focus:bg-[#0f1526] focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all shadow-sm"
                    placeholder="e.g. Malee House"
                  />
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-2">
                    <CreditCard className="h-3.5 w-3.5 text-indigo-500/70" /> Opening Balance *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingBank.opening_balance ?? 0}
                    onChange={(e) => setEditingBank({ ...editingBank, opening_balance: e.target.value === "" ? 0 : Number(e.target.value) })}
                    className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-white/10 bg-white/50 dark:bg-black/20 text-sm font-semibold text-slate-900 dark:text-white focus:bg-white dark:focus:bg-[#0f1526] focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all shadow-sm"
                    placeholder="e.g. 0.00"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-2">
                    <Hash className="h-3.5 w-3.5 text-indigo-500/70" /> Account number *
                  </label>
                  <input
                    type="text"
                    value={editingBank.account_number || ""}
                    onChange={(e) => setEditingBank({ ...editingBank, account_number: e.target.value })}
                    className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-white/10 bg-white/50 dark:bg-black/20 text-sm font-semibold text-slate-900 dark:text-white focus:bg-white dark:focus:bg-[#0f1526] focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all shadow-sm"
                    placeholder="e.g. 50200000000000"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-2">
                    <Hash className="h-3.5 w-3.5 text-indigo-500/70" /> Ifsc code *
                  </label>
                  <input
                    type="text"
                    value={editingBank.ifsc_code || ""}
                    onChange={(e) => setEditingBank({ ...editingBank, ifsc_code: e.target.value })}
                    className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-white/10 bg-white/50 dark:bg-black/20 text-sm font-semibold text-slate-900 dark:text-white focus:bg-white dark:focus:bg-[#0f1526] focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all shadow-sm uppercase placeholder:normal-case"
                    placeholder="e.g. HDFC0001234"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-2">
                    <Tag className="h-3.5 w-3.5 text-indigo-500/70" /> Purpose *
                  </label>
                  <input
                    type="text"
                    value={editingBank.account_usage || ""}
                    onChange={(e) => setEditingBank({ ...editingBank, account_usage: e.target.value })}
                    className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-white/10 bg-white/50 dark:bg-black/20 text-sm font-semibold text-slate-900 dark:text-white focus:bg-white dark:focus:bg-[#0f1526] focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all shadow-sm"
                    placeholder="e.g. Operations, Payroll, Billing"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 flex items-center gap-2">
                    <Building2 className="h-3.5 w-3.5 text-indigo-500/70" /> Branch name *
                  </label>
                  <input
                    type="text"
                    value={editingBank.branch_name || ""}
                    onChange={(e) => setEditingBank({ ...editingBank, branch_name: e.target.value })}
                    className="w-full h-11 px-4 rounded-xl border border-slate-200 dark:border-white/10 bg-white/50 dark:bg-black/20 text-sm font-semibold text-slate-900 dark:text-white focus:bg-white dark:focus:bg-[#0f1526] focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 outline-none transition-all shadow-sm"
                    placeholder="e.g. MG Road Branch"
                  />
                </div>

                <div className="space-y-2 flex items-center md:col-span-2 pt-1">
                  <label className="flex items-center gap-3 cursor-pointer group">
                    <div className="relative flex items-center justify-center w-5 h-5">
                      <input
                        type="checkbox"
                        checked={editingBank.is_default || false}
                        onChange={(e) => setEditingBank({ ...editingBank, is_default: e.target.checked })}
                        className="peer appearance-none w-5 h-5 rounded border-2 border-slate-300 dark:border-slate-600 checked:border-indigo-600 checked:bg-indigo-600 transition-all cursor-pointer"
                      />
                      <CheckCircle2 className="absolute w-3.5 h-3.5 text-white opacity-0 peer-checked:opacity-100 pointer-events-none transition-opacity" />
                    </div>
                    <span className="text-sm font-semibold text-slate-600 dark:text-slate-300 group-hover:text-slate-800 dark:group-hover:text-white transition-colors">
                      Set as Default Bank Account
                    </span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-6 border-t border-slate-200/50 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setEditingBank(null)}
                  className="px-6 py-2.5 rounded-xl text-sm font-semibold text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex items-center gap-2 px-8 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold transition-all shadow-lg shadow-indigo-600/20 active:scale-[0.98]"
                >
                  <Save className="w-4 h-4" />
                  <span>Save Bank Account</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
