'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { CreditCard, FileText, Loader2, X } from 'lucide-react';
import { logPaymentAction } from '@/actions/finance.actions';
import { BankAccountSelector } from '@/components/ui/BankAccountSelector';
import { Select, SelectItem } from '@/components/ui/select';
import { toast } from 'sonner';

interface LogPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  milestoneId?: string;
  projectId: string;
  milestoneTitle: string;
  amount: number;
  invoiceId?: string;
  initialBankId?: string;
  onSuccess: () => void;
}

export function LogPaymentModal({
  isOpen,
  onClose,
  milestoneId,
  projectId,
  milestoneTitle,
  amount,
  invoiceId,
  initialBankId,
  onSuccess
}: LogPaymentModalProps) {
  const [method, setMethod] = useState('Bank Transfer');
  const [txnId, setTxnId] = useState('');
  const [bankId, setBankId] = useState(initialBankId || '');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setBankId(initialBankId || '');
      setTxnId('');
      setMethod('Bank Transfer');
    }
  }, [isOpen, initialBankId]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (method !== 'Cash' && !bankId) {
        toast.error('Please select a bank account for non-cash payments.');
        setIsSubmitting(false);
        return;
      }
      const payload: any = {
        project_id: projectId,
        amount: amount,
        payment_method: method,
      };
      
      if (invoiceId) payload.invoice_id = invoiceId;
      if (milestoneId) payload.milestone_id = milestoneId;
      if (txnId) payload.transaction_id = txnId;
      if (bankId && method !== 'Cash') payload.bank_id = bankId;

      const res = await logPaymentAction(payload);

      if (res?.success) {
        toast.success(`Payment logged for ${milestoneTitle}. It is now pending verification.`);
        onSuccess();
        onClose();
      } else {
        toast.error(res?.error || 'Failed to log payment.');
      }
    } catch(error) {
      toast.error('Unexpected error logging payment.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return createPortal(
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          onClick={onClose}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-white/10 overflow-hidden"
        >
          <div className="p-6">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Log Payment</h3>
                <p className="text-sm text-slate-500 mt-1">Record incoming payment for milestone.</p>
              </div>
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Amount
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-slate-500 font-medium">₹</span>
                  </div>
                  <input
                    type="number"
                    disabled
                    value={amount}
                    className="w-full pl-8 pr-4 py-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white font-semibold opacity-75 cursor-not-allowed"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Payment Method
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none z-10">
                    <CreditCard className="w-4 h-4 text-slate-400" />
                  </div>
                  <Select
                    value={method}
                    onValueChange={setMethod}
                    buttonClassName="pl-10"
                  >
                    <SelectItem value="Bank Transfer">Bank Transfer (NEFT/RTGS)</SelectItem>
                    <SelectItem value="UPI">UPI</SelectItem>
                    <SelectItem value="Cheque">Cheque</SelectItem>
                    <SelectItem value="Cash">Cash</SelectItem>
                  </Select>
                </div>
              </div>

              {method !== 'Cash' && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <BankAccountSelector
                    value={bankId}
                    onChange={setBankId}
                    required
                    label="Receiving Bank Account"
                  />
                </motion.div>
              )}

              {['UPI', 'Cheque'].includes(method) && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    {method === 'Cheque' ? 'Cheque Number (Optional)' : 'Transaction ID (Optional)'}
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <FileText className="w-4 h-4 text-slate-400" />
                    </div>
                    <input
                      type="text"
                      value={txnId}
                      onChange={e => setTxnId(e.target.value)}
                      placeholder={method === 'Cheque' ? 'e.g. 123456' : 'e.g. UTR Number or Txn ID'}
                      className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                    />
                  </div>
                </motion.div>
              )}

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 py-2 px-4 border border-slate-200 dark:border-white/10 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold shadow-md shadow-indigo-500/20 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>,
    document.body
  );
}
