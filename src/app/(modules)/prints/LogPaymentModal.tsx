"use client";

import { useState } from "react";
import { logPrintPaymentAction } from "@/actions/print.actions";

export default function LogPaymentModal({ isOpen, onClose, job, onSuccess }: { isOpen: boolean, onClose: () => void, job: any, onSuccess: (job: any) => void }) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    amount: job.amount,
    payment_method: "cash",
    transaction_id: "",
    bank_id: ""
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const res = await logPrintPaymentAction(job.id, formData);
    setLoading(false);
    
    if (res.success) {
      onSuccess(res.data);
    } else {
      alert(res.error || "Failed to log payment");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
      <div className="bg-slate-800 border border-slate-700 rounded-xl shadow-xl w-full max-w-md overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-700 bg-slate-800/50">
          <h2 className="text-xl font-semibold text-white">Log Payment</h2>
          <p className="text-sm text-slate-400">Job: {job.id}</p>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-300">Amount (₹) *</label>
            <input required type="number" step="0.01" value={formData.amount} onChange={e => setFormData({...formData, amount: parseFloat(e.target.value) || 0})} className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500" />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-slate-300">Payment Method *</label>
            <select value={formData.payment_method} onChange={e => setFormData({...formData, payment_method: e.target.value})} className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500">
              <option value="cash">Cash</option>
              <option value="bank_transfer">Bank Transfer / UPI</option>
              <option value="card">Card</option>
            </select>
          </div>

          {formData.payment_method !== 'cash' && (
            <div className="space-y-1">
              <label className="text-sm font-medium text-slate-300">Transaction ID</label>
              <input type="text" value={formData.transaction_id} onChange={e => setFormData({...formData, transaction_id: e.target.value})} className="w-full bg-slate-900/50 border border-slate-700 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-indigo-500" placeholder="e.g. UTR number" />
            </div>
          )}

          <div className="flex justify-end space-x-3 pt-4 border-t border-slate-700">
            <button type="button" onClick={onClose} className="px-4 py-2 text-slate-300 hover:text-white transition-colors" disabled={loading}>Cancel</button>
            <button type="submit" className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors font-medium" disabled={loading}>
              {loading ? "Saving..." : "Record Payment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
