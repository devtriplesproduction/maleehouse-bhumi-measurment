'use client';

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { IndianRupee, FileText, Calendar, Loader2, X, Tag } from 'lucide-react';
import { createExpenseAction, updateExpenseAction } from '@/actions/expense.actions';
import { toast } from 'sonner';

interface AddExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  onSuccess: () => void;
  initialCategory?: string;
  expenseToEdit?: any;
}

export function AddExpenseModal({
  isOpen,
  onClose,
  projectId,
  onSuccess,
  initialCategory = '',
  expenseToEdit
}: AddExpenseModalProps) {
  const [category, setCategory] = useState<string>(initialCategory);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState<string>('');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  React.useEffect(() => {
    if (expenseToEdit && isOpen) {
      setCategory(expenseToEdit.category || 'other');
      setDescription(expenseToEdit.description || '');
      setAmount(expenseToEdit.amount?.toString() || '');
      setExpenseDate(expenseToEdit.expense_date ? new Date(expenseToEdit.expense_date).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]);
    } else if (!expenseToEdit && isOpen) {
      setCategory(initialCategory);
      setDescription('');
      setAmount('');
      setExpenseDate(new Date().toISOString().split('T')[0]);
    }
  }, [expenseToEdit, isOpen, initialCategory]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      toast.error('Please enter a valid amount.');
      return;
    }

    setIsSubmitting(true);
    try {
      let res;
      if (expenseToEdit) {
        res = await updateExpenseAction({
          id: expenseToEdit.id,
          project_id: projectId,
          category: category as any,
          description,
          amount: Number(amount),
          expense_date: expenseDate,
        });
      } else {
        res = await createExpenseAction({
          project_id: projectId,
          category: category as any,
          description,
          amount: Number(amount),
          expense_date: expenseDate,
        });
      }

      if (res?.success) {
        toast.success(expenseToEdit ? 'Expense updated successfully.' : 'Expense logged successfully.');
        onSuccess();
        onClose();
        // Reset state
        setDescription('');
        setAmount('');
        setCategory('');
      } else {
        toast.error(res?.error || (expenseToEdit ? 'Failed to update expense.' : 'Failed to log expense.'));
      }
    } catch(error) {
      toast.error('Unexpected error saving expense.');
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
                <h3 className="text-xl font-bold text-slate-900 dark:text-white">Add Project Expense</h3>
                <p className="text-sm text-slate-500 mt-1">Allocate costs directly to this project.</p>
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
                  Category
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Tag className="w-4 h-4 text-slate-400" />
                  </div>
                  <select
                    value={category}
                    onChange={(e: any) => setCategory(e.target.value)}
                    required
                    className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  >
                    <option value="" disabled>Select category...</option>
                    <option value="Travelling (Petrol)(Per 50Km)">Travelling (Petrol)(Per 50Km)</option>
                    <option value="Accomodation">Accomodation</option>
                    <option value="Food & Breakfast">Food & Breakfast</option>
                    <option value="Vehicle Maintance">Vehicle Maintance</option>
                    <option value="Paint">Paint</option>
                    <option value="Fakki">Fakki</option>
                    <option value="Other Field Expences">Other Field Expences</option>
                    <option value="Other Designing Expences">Other Designing Expences</option>
                    <option value="Other Submission Exp">Other Submission Exp</option>
                    <option value="Submission Travel">Submission Travel</option>
                    <option value="Equipment Rent (DGPS)">Equipment Rent (DGPS)</option>
                    <option value="Equipment Rent (Drone)">Equipment Rent (Drone)</option>
                    <option value="Equipment Rent (Lidar)">Equipment Rent (Lidar)</option>
                    <option value="Data Processing Cost (DGPS)">Data Processing Cost (DGPS)</option>
                    <option value="Data Processing Cost(Drone)">Data Processing Cost(Drone)</option>
                    <option value="Data Processing Cost (Lidar)">Data Processing Cost (Lidar)</option>
                    <option value="Computer Cost">Computer Cost</option>
                    <option value="Printing/Xerox">Printing/Xerox</option>
                    <option value="Stationary">Stationary</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Description
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 pt-2.5 pointer-events-none">
                    <FileText className="w-4 h-4 text-slate-400" />
                  </div>
                  <textarea
                    value={description}
                    onChange={e => setDescription(e.target.value)}
                    required
                    placeholder="E.g. Masonry team wages, Cement bags..."
                    rows={2}
                    className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all resize-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Amount
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <IndianRupee className="w-4 h-4 text-slate-400" />
                  </div>
                  <input
                    type="number"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    required
                    min="1"
                    placeholder="0.00"
                    className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Date
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Calendar className="w-4 h-4 text-slate-400" />
                  </div>
                  <input
                    type="date"
                    value={expenseDate}
                    onChange={e => setExpenseDate(e.target.value)}
                    required
                    className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                  />
                </div>
              </div>

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
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Log Expense'}
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
