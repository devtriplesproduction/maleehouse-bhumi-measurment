"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X, CreditCard, Banknote, IndianRupee, CheckCircle2, ShieldCheck } from "lucide-react";
import { logPrintPaymentAction } from "@/actions/print.actions";
import { cn } from "@/lib/utils";

export default function LogPaymentModal({ 
  isOpen, 
  onClose, 
  job, 
  onSuccess 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  job: any; 
  onSuccess: (job: any) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    amount: job?.amount || 0,
    payment_method: "cash",
    transaction_id: "",
    bank_id: ""
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen || !job || !mounted) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const res = await logPrintPaymentAction(job.id, formData);
    setLoading(false);
    
    if (res.success) {
      onSuccess(res.data);
      onClose();
    } else {
      alert(res.error || "Failed to log payment");
    }
  };

  return createPortal(
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-md transition-all duration-300"
      onClick={onClose}
    >
      <div 
        className="relative bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-white/10 rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Top Accent Gradient */}
        <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-500" />

        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-white/10 flex justify-between items-center bg-slate-50/70 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/20 ring-4 ring-emerald-50 dark:ring-emerald-950/40">
              <Banknote className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">Record Payment</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Job #{job.receipt_number || job.id?.slice(0, 8)} • {job.client_name}
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Amount Box */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Amount Received *
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-emerald-600 dark:text-emerald-400">
                ₹
              </span>
              <input 
                required 
                type="number" 
                step="0.01" 
                value={formData.amount} 
                onChange={e => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })} 
                className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-white/10 rounded-xl pl-8 pr-4 py-2.5 text-base font-bold text-slate-900 dark:text-white focus:bg-white focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all" 
              />
            </div>
          </div>

          {/* Payment Method Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Payment Method *
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "cash", label: "Cash" },
                { id: "bank_transfer", label: "UPI / Bank" },
                { id: "card", label: "Card" },
              ].map(m => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setFormData({ ...formData, payment_method: m.id })}
                  className={cn(
                    "py-2 px-2 rounded-xl text-xs font-bold border transition-all text-center",
                    formData.payment_method === m.id
                      ? "bg-emerald-600 text-white border-emerald-600 shadow-sm shadow-emerald-600/20"
                      : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:border-slate-300"
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {formData.payment_method !== 'cash' && (
            <div className="space-y-1.5 animate-in fade-in duration-150">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                Transaction ID / UTR Reference
              </label>
              <input 
                type="text" 
                value={formData.transaction_id} 
                onChange={e => setFormData({ ...formData, transaction_id: e.target.value })} 
                className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-900 dark:text-white focus:bg-white focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all placeholder:text-slate-400" 
                placeholder="e.g. UPI-1234567890" 
              />
            </div>
          )}

          <div className="flex justify-end items-center gap-2.5 pt-4 border-t border-slate-100 dark:border-white/10">
            <button 
              type="button" 
              onClick={onClose} 
              className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-all" 
              disabled={loading}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 active:scale-[0.98] text-white rounded-xl transition-all font-bold text-xs uppercase tracking-wider shadow-md shadow-emerald-600/20" 
              disabled={loading}
            >
              {loading ? "Recording..." : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  Confirm Receipt
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
