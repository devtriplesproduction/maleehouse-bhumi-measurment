'use client';

import React, { useState, useEffect } from 'react';
import { 
  X,
  FileText,
  Loader2,
  FilePlus,
  Printer,
  Download,
  Mail,
  Link2,
  CheckCircle2,
  CreditCard
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { createPortal } from 'react-dom';
import { createInvoiceAction, markInvoiceAsSentAction } from '@/actions/finance.actions';
import { createClient } from '@/lib/supabase/client';
import { useCompanySettings } from '@/providers/CompanySettingsProvider';
import { getBankAccountsAction } from '@/actions/bank.actions';
import { toast } from 'sonner';
import { DocumentHeader } from '../../components/shared/DocumentHeader';
import { generateInvoicePDF } from '@/lib/pdf-generator';
import { cn } from '@/lib/utils';

interface CreateInvoiceModalProps {
  projectId: string;
  projectName: string;
  clientName: string;
  milestoneId?: string;
  milestoneTitle?: string;
  milestoneDueDate?: string | null;
  expenseId?: string;
  expenseTitle?: string;
  visitId?: string;
  visitTitle?: string;
  initialAmount?: number;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onSuccess?: () => void;
}

export function CreateInvoiceModal({ projectId, projectName, clientName, milestoneId, milestoneTitle, milestoneDueDate, expenseId, expenseTitle, visitId, visitTitle, initialAmount, isOpen, onOpenChange, onSuccess }: CreateInvoiceModalProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [createdInvoice, setCreatedInvoice] = useState<any>(null);
  
  const isControlled = isOpen !== undefined && onOpenChange !== undefined;
  const open = isControlled ? isOpen : internalOpen;
  const setOpen = isControlled ? onOpenChange : setInternalOpen;

  const [loading, setLoading] = useState(false);
  const { settings: companySettings } = useCompanySettings();
  const [projectData, setProjectData] = useState<any>(null);
  const [banks, setBanks] = useState<any[]>([]);
  
  const [formData, setFormData] = useState({
    invoice_number: `INV-${Date.now().toString().slice(-6)}`,
    amount: initialAmount || 0,
    gst_rate: 18,
    notes: '',
    due_date: milestoneDueDate ? new Date(milestoneDueDate).toISOString().split('T')[0] : new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Default 7 days
    bank_id: ''
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) {
      
      const fetchProject = async () => {
        const supabase = createClient();
        const { data, error } = await supabase
          .from('projects')
          .select('budget, payments(amount, status)')
          .eq('id', projectId)
          .single();
        if (data) {
          const project = data as any;
          const activeBudget = Number(project.budget) || 0;
          let projectGstRate = 18;
          if (visitId) {
            projectGstRate = 0; // Field visits do not apply GST by default
          }
          project.calculated_budget = activeBudget;
          setProjectData(project);
          setFormData(prev => ({ 
            ...prev, 
            gst_rate: projectGstRate,
            amount: initialAmount ? Number((initialAmount / (1 + projectGstRate / 100)).toFixed(2)) : prev.amount
          }));
        }
      };
      if (!projectData) fetchProject();

      const fetchBanks = async () => {
        const res = await getBankAccountsAction();
        if (res && res.success && res.data) {
          setBanks(res.data as any[]);
          const projectBankId = (projectData as any)?.requirement_checklist?.bank_account_id;
          const preferredBank = projectBankId ? (res.data as any[]).find((b: any) => b.id === projectBankId) : null;
          const defaultBank = preferredBank || (res.data as any[]).find((b: any) => b.is_default) || (res.data as any[])[0];
          if (defaultBank && !formData.bank_id) {
            setFormData(prev => ({ ...prev, bank_id: defaultBank.id }));
          }
        }
      };
      if (banks.length === 0) fetchBanks();
    }
  }, [open, companySettings, projectId, projectData, banks.length, initialAmount]);

  useEffect(() => {
    if (initialAmount !== undefined && !open) {
      // Don't override while open unless triggered by open change, handled above
      setFormData(prev => ({ ...prev, amount: Number((initialAmount / (1 + prev.gst_rate / 100)).toFixed(2)) }));
    }
    if (milestoneDueDate !== undefined && milestoneDueDate !== null) {
      setFormData(prev => ({ ...prev, due_date: new Date(milestoneDueDate).toISOString().split('T')[0] }));
    }
  }, [initialAmount, milestoneDueDate, open]);

  const [isDuplicateError, setIsDuplicateError] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const result = await createInvoiceAction({
        project_id: projectId,
        milestone_id: milestoneId,
        visit_id: visitId,
        invoice_number: formData.invoice_number,
        amount: Number(formData.amount),
        gst_rate: Number(formData.gst_rate),
        notes: formData.notes,
        due_date: formData.due_date,
        bank_id: formData.bank_id || undefined
      });

      if (result.success) {
        toast.success('Invoice created successfully');
        setCreatedInvoice(result.data);
        onSuccess?.();
      } else {
        toast.error(result.error || 'Failed to create invoice');
        if (result.error?.includes('active Invoice already exists')) {
          setIsDuplicateError(true);
        }
      }
    } catch(error) {
      toast.error('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const [isMarkingShared, setIsMarkingShared] = useState(false);

  const handleMarkAsShared = async () => {
    if (!createdInvoice || createdInvoice.status !== 'draft') return;
    setIsMarkingShared(true);
    const result = await markInvoiceAsSentAction(createdInvoice.id);
    if (result.success) {
      toast.success('Invoice marked as shared');
      setCreatedInvoice({ ...createdInvoice, status: 'sent' });
    } else {
      toast.error('Failed to mark as shared');
    }
    setIsMarkingShared(false);
  };

  const gstAmount = (formData.amount * formData.gst_rate) / 100;
  const totalAmount = Number(formData.amount) + gstAmount;
  const issueDate = new Date();
  
  // Safe parsing of due date
  let dueDateObj = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  if (formData.due_date) {
    const parsed = new Date(formData.due_date);
    if (!isNaN(parsed.getTime())) {
      dueDateObj = parsed;
    }
  }

  if (!mounted) return null;

  return (
    <>
      {!isControlled && (
        <Button onClick={() => setOpen(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-2">
          <FilePlus className="w-4 h-4" />
          Create Invoice
        </Button>
      )}

      {open && createPortal(
        <div className="fixed inset-0 z-[9999] overflow-y-auto p-6 md:p-12 flex justify-center items-start animate-in fade-in duration-300">
          <div 
            className="fixed inset-0 bg-slate-950/60 dark:bg-black/85 backdrop-blur-md z-0" 
            onClick={() => setOpen(false)}
          />
          
          <div className="relative w-full max-w-5xl flex flex-col gap-6 z-10 my-4">
            {/* Sticky Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-slate-900/95 dark:bg-slate-950/90 backdrop-blur-md px-5 py-4 sm:py-3 rounded-xl border border-white/10 shadow-xl text-white sticky top-4 z-50">
              <div className="flex items-center gap-3">
                 <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shrink-0">
                    <FileText className="w-4 h-4" />
                 </div>
                 <div>
                    <h3 className="text-sm font-semibold tracking-tight flex items-center gap-2">
                      Invoice Portal
                      <span className={cn(
                        "px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border shadow-sm ml-2",
                        createdInvoice ? (
                          createdInvoice.status === 'paid' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/20' :
                          createdInvoice.status === 'accepted' ? 'bg-teal-500/20 text-teal-300 border-teal-500/20' :
                          createdInvoice.status === 'rejected' ? 'bg-red-500/20 text-red-300 border-red-500/20' :
                          createdInvoice.status === 'in_review' ? 'bg-amber-500/20 text-amber-300 border-amber-500/20' :
                          createdInvoice.status === 'overdue' ? 'bg-rose-500/20 text-rose-300 border-rose-500/20' :
                          createdInvoice.status === 'cancelled' ? 'bg-white/10 text-slate-300 border-white/10' :
                          'bg-blue-500/20 text-blue-300 border-blue-500/20'
                        ) : 'bg-slate-500/20 text-slate-300 border-slate-500/20'
                      )}>
                        {createdInvoice ? createdInvoice.status : 'DRAFT'}
                      </span>
                    </h3>
                    <p className="text-[10px] text-slate-400 font-medium mt-0.5">
                      Reviewing {formData.invoice_number} • Malee House Surveying OS
                    </p>
                 </div>
              </div>

              <div className="flex items-center gap-2 mt-4 sm:mt-0">
                {createdInvoice && (
                  <>
                    <Button 
                      onClick={() => window.print()}
                      variant="ghost" 
                      className="text-slate-300 hover:text-white hover:bg-white/10 px-3 py-1.5 h-8 text-xs font-semibold gap-1.5 rounded-lg transition-all"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      Print
                    </Button>
                    <Button 
                      onClick={() => generateInvoicePDF(createdInvoice, projectData, companySettings, banks.find(b => b.id === (createdInvoice.bank_id || formData.bank_id)))}
                      variant="ghost" 
                      className="text-slate-300 hover:text-white hover:bg-white/10 px-3 py-1.5 h-8 text-xs font-semibold gap-1.5 rounded-lg transition-all"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download PDF
                    </Button>
                    <Button 
                      onClick={() => {
                         const link = `${window.location.origin}/invoices/${createdInvoice.id}`;
                         window.location.href = `mailto:?subject=Malee House - Invoice ${formData.invoice_number}&body=Dear Client,%0D%0A%0D%0APlease find your invoice ${formData.invoice_number} ready for your review and payment here:%0D%0A${link}%0D%0A%0D%0ABest regards,%0D%0AMalee House Finance`;
                      }}
                      variant="ghost" 
                      className="text-slate-300 hover:text-white hover:bg-white/10 px-3 py-1.5 h-8 text-xs font-semibold gap-1.5 rounded-lg transition-all"
                    >
                      <Mail className="w-3.5 h-3.5" />
                      Email
                    </Button>
                    <div className="w-px h-5 bg-white/10 mx-1" />
                  </>
                )}
                <Button 
                  onClick={() => setOpen(false)}
                  className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-white flex items-center justify-center p-0 transition-colors"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
              <div className="lg:col-span-2 space-y-6">
                {/* WYSIWYG Invoice Body */}
                <div className={`bg-white text-slate-800 shadow-2xl border border-slate-200/60 rounded-xl overflow-hidden flex flex-col p-10 md:p-12 relative min-h-[900px] justify-between transition-all ${createdInvoice ? 'opacity-80 scale-[0.99] pointer-events-none' : ''}`}>
               <div className="absolute top-4 right-4 text-[8px] text-slate-300 uppercase tracking-widest pointer-events-none select-none font-medium">Page 1 of 1</div>

               <div className="space-y-8 flex-1">
                  {/* Document Header */}
                  <div className="flex justify-between items-start border-b border-slate-100 pb-6">
                     <DocumentHeader companySettings={companySettings} />

                     <div className="text-right space-y-4">
                        <h1 className="text-3xl font-extrabold text-slate-200 uppercase tracking-tight leading-none">Invoice</h1>
                        
                        <div className="space-y-2 text-xs">
                           <div className="flex flex-col items-end">
                              <label className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">Invoice Number</label>
                              <div className="flex items-center">
                                <span className="font-semibold text-slate-800">#</span>
                                <input 
                                  value={formData.invoice_number}
                                  onChange={(e) => setFormData({...formData, invoice_number: e.target.value})}
                                  className="font-semibold text-slate-800 nums bg-amber-50 focus:bg-amber-100 px-1 py-0.5 rounded border border-transparent focus:border-amber-300 outline-none w-28 text-right transition-colors"
                                />
                              </div>
                           </div>
                           <div className="flex flex-col items-end">
                              <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">Date Issued</p>
                              <p className="font-semibold text-slate-800 py-0.5">{format(issueDate, 'MMMM dd, yyyy')}</p>
                           </div>
                           <div className="flex flex-col items-end mt-1">
                              <label className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">Due Date</label>
                              <input 
                                type="date"
                                value={formData.due_date}
                                onChange={(e) => setFormData({...formData, due_date: e.target.value})}
                                className="font-semibold text-slate-800 bg-amber-50 focus:bg-amber-100 px-1 py-0.5 rounded border border-transparent focus:border-amber-300 outline-none text-right transition-colors text-xs"
                              />
                           </div>
                        </div>
                     </div>
                  </div>

                  {/* Client Bill To & Project info */}
                  <div className="grid grid-cols-2 gap-6 bg-slate-50 p-5 rounded-xl border border-slate-200/50 text-slate-700">
                     <div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Client Bill To:</p>
                        <h2 className="text-sm font-semibold text-slate-800 leading-tight">{clientName || 'Client Name'}</h2>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">Authorized project engagement</p>
                     </div>
                     <div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Project Assignment:</p>
                        <h2 className="text-sm font-semibold text-slate-800 leading-tight">{projectName || 'Project Name'}</h2>
                        <p className="text-xs text-slate-500 font-medium mt-0.5">Location: Site Technical Survey</p>
                     </div>
                  </div>

                  {/* Services Table */}
                  <div className="space-y-4">
                     <table className="w-full border-collapse">
                        <thead>
                           <tr className="border-b border-slate-900 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                              <th className="py-2.5 text-left w-12">#</th>
                              <th className="py-2.5 text-left">Service Description</th>
                              <th className="py-2.5 text-center w-20">Qty</th>
                              <th className="py-2.5 text-right w-36">Unit Price</th>
                              <th className="py-2.5 text-right w-36">Total</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                           <tr className="align-top">
                              <td className="py-4 text-xs font-semibold text-slate-400">1</td>
                               <td className="py-4">
                                 <p className="text-xs font-semibold text-slate-900 uppercase tracking-tight">
                                   {expenseId ? 'Project Expense Reimbursement' : visitId ? 'Field Visit Services' : 'Professional Services'}
                                 </p>
                                 <p className="text-[11px] text-slate-500 mt-1 leading-relaxed max-w-lg">
                                   {expenseId ? (expenseTitle || 'Approved project expense reimbursement.') : visitId ? (visitTitle || 'Field visit and inspection.') : milestoneTitle ? `As per milestone: ${milestoneTitle}` : 'As per project milestone agreement.'}
                                 </p>
                              </td>
                              <td className="py-4 text-center text-xs font-semibold text-slate-800">1</td>
                              <td className="py-4 text-right">
                                <div className="flex items-center justify-end">
                                  <span className="text-xs font-medium text-slate-800 nums mr-1">INR</span>
                                  <input 
                                    type="number"
                                    value={formData.amount}
                                    onChange={(e) => setFormData({...formData, amount: Number(e.target.value)})}
                                    className="text-xs font-medium text-slate-800 nums bg-amber-50 focus:bg-amber-100 px-1 py-0.5 rounded border border-transparent focus:border-amber-300 outline-none w-24 text-right transition-colors"
                                  />
                                </div>
                              </td>
                              <td className="py-4 text-right text-xs font-semibold text-slate-900 nums">INR {Number(formData.amount).toLocaleString('en-IN')}</td>
                           </tr>
                        </tbody>
                     </table>
                  </div>
               </div>

               {/* Totals panel */}
               <div className="border-t-2 border-double border-slate-900 pt-6 mt-8 flex justify-end">
                  <div className="w-full md:w-[350px] space-y-2.5">
                     <div className="flex justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider nums">
                        <span>Total Cost of Project</span>
                        <span>INR {Number(projectData?.calculated_budget || 0).toLocaleString('en-IN')}</span>
                     </div>
                     <div className="flex justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider nums">
                        <span>Total Project Paid</span>
                        <span>INR {((projectData?.payments || [])
                                      .filter((p: any) => p.status === 'verified' || p.status === 'paid')
                                      .reduce((sum: number, p: any) => sum + Number(p.amount), 0)).toLocaleString('en-IN')}</span>
                     </div>
                     <div className="flex justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider nums pt-2 border-t border-slate-100">
                        <span>Current Invoice Amount {visitId && <span className="text-emerald-500 lowercase ml-1">(extra charge)</span>}</span>
                        <span>INR {totalAmount.toLocaleString('en-IN')}</span>
                     </div>
                     <div className={`flex justify-between items-end p-3 rounded-lg mt-2 ${totalAmount > 0 ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
                        <div className="space-y-0.5">
                          <p className="text-[11px] font-bold uppercase tracking-wider">Project Balance Remaining</p>
                          {visitId && <p className="text-[9px] font-medium opacity-80">* Field visit charges do not deduct from this total.</p>}
                        </div>
                        <p className="text-lg font-bold tracking-tight nums">
                          INR {Math.max(0, Number(projectData?.calculated_budget || 0) - ((projectData?.payments || [])
                            .filter((p: any) => p.status === 'verified' || p.status === 'paid')
                            .reduce((sum: number, p: any) => sum + Number(p.amount), 0)) - (visitId ? 0 : totalAmount)).toLocaleString('en-IN')}
                        </p>
                     </div>
                  </div>
               </div>
            </div>             {/* Bottom Actions Area */}
             {!createdInvoice && (
                <div className="mt-8 flex justify-end pb-8">
                    <Button 
                      onClick={handleSubmit}
                      disabled={loading || formData.amount <= 0 || isDuplicateError}
                      className={cn(
                        "text-white px-10 py-6 h-12 text-sm font-bold gap-2 rounded-xl transition-all shadow-xl shadow-indigo-600/20",
                        isDuplicateError ? "bg-slate-400 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700"
                      )}
                   >
                      {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <FilePlus className="w-5 h-5" />}
                      Create Official Invoice
                   </Button>
                </div>
             )}
          </div>
          
          {/* ── Sticky Action Panel (Right Col) ── */}
          <div className="lg:col-span-1 space-y-4 lg:sticky lg:top-24">
            {createdInvoice && (
              <>
                <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-xl shadow-slate-200/40">
                  <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4">Invoice Actions</h3>
                  
                  <div className="space-y-3">
                    <button 
                      onClick={() => generateInvoicePDF(createdInvoice, projectData, companySettings, banks.find(b => b.id === (createdInvoice.bank_id || formData.bank_id)))}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-indigo-600/20"
                    >
                      <Download className="w-4 h-4" /> Download PDF
                    </button>
                    
                    <button 
                      onClick={() => window.print()}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
                    >
                      <Printer className="w-4 h-4" /> Print Document
                    </button>
                  </div>
                </div>

                <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-xl shadow-slate-200/40">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Share Invoice</h3>
                    {createdInvoice.status === 'draft' ? (
                      <button
                        onClick={handleMarkAsShared}
                        disabled={isMarkingShared}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all disabled:opacity-50 flex items-center gap-1.5 shadow-sm shadow-emerald-600/20"
                      >
                        {isMarkingShared ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                        {isMarkingShared ? 'Marking...' : 'Share Successfully'}
                      </button>
                    ) : (
                      <div className="bg-emerald-50 text-emerald-600 border border-emerald-200 px-3 py-1.5 rounded-lg text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5">
                        <CheckCircle2 className="w-3 h-3" />
                        Shared
                      </div>
                    )}
                  </div>
                  <div className="space-y-3">
                    <button 
                      onClick={() => {
                        const link = `${window.location.origin}/invoices/${createdInvoice.id}`;
                        navigator.clipboard.writeText(link);
                        toast.success('Invoice link copied to clipboard!');
                      }}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
                    >
                      <Link2 className="w-4 h-4" /> Copy Link
                    </button>
                    <a
                      onClick={() => { if (createdInvoice.status === 'draft') handleMarkAsShared(); }}
                      href={`mailto:?subject=Malee House - Invoice ${formData.invoice_number}&body=Dear Client,%0D%0A%0D%0APlease find your invoice ${formData.invoice_number} ready for your review and payment here:%0D%0A${window.location.origin}/invoices/${createdInvoice.id}%0D%0A%0D%0ABest regards,%0D%0AMalee House Finance`}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 text-slate-700 hover:text-indigo-700 rounded-xl text-xs font-bold transition-all"
                    >
                      <Mail className="w-4 h-4" /> Email Invoice
                    </a>
                    <a
                      onClick={() => { if (createdInvoice.status === 'draft') handleMarkAsShared(); }}
                      href={`https://wa.me/?text=Hi, please find the invoice ${formData.invoice_number} from Malee House for your payment here: ${window.location.origin}/invoices/${createdInvoice.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-700 rounded-xl text-xs font-bold transition-all"
                    >
                      <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                        <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.625 1.451 5.403.002 9.803-4.394 9.805-9.805.001-2.621-1.013-5.085-2.86-6.933-1.847-1.847-4.308-2.859-6.924-2.86-5.412 0-9.815 4.398-9.818 9.807-.001 1.536.417 3.033 1.21 4.385l-.995 3.636 3.733-.979zm11.105-6.857c-.247-.124-1.464-.722-1.692-.806-.228-.083-.393-.124-.559.124-.166.247-.641.806-.784.969-.143.163-.286.183-.534.059-.247-.124-1.043-.385-1.986-1.227-.733-.654-1.229-1.462-1.373-1.71-.143-.248-.015-.381.109-.504.111-.11.247-.286.371-.429.124-.143.165-.247.247-.412.082-.166.041-.309-.021-.433-.062-.124-.559-1.345-.765-1.838-.2-.486-.398-.419-.559-.427-.144-.008-.309-.009-.473-.009a.913.913 0 0 0-.66.309c-.228.247-.867.846-.867 2.062 0 1.216.883 2.39 1.007 2.556.124.165 1.737 2.654 4.209 3.717.588.253 1.047.404 1.405.518.59.187 1.127.161 1.551.098.473-.069 1.464-.598 1.67-.175.206.423.206.784.103.969-.103.186-.247.309-.494.186z" />
                      </svg>
                      WhatsApp
                    </a>
                  </div>
                </div>
              </>
            )}

            <div className="bg-indigo-50 border border-indigo-100 p-5 rounded-2xl shadow-sm">
              <div className="flex items-start gap-3 mb-3">
                <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
                  <CreditCard className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-indigo-950 uppercase tracking-wider">Payment Details</h4>
                  <p className="text-[10px] text-indigo-700 mt-1 font-medium">Please include invoice number in payment reference.</p>
                </div>
              </div>

              {!createdInvoice && (
                <div className="mb-4">
                  <label className="text-[10px] font-bold text-indigo-900 uppercase tracking-wider mb-1 block">Select Bank Account</label>
                  <select 
                    value={formData.bank_id}
                    onChange={(e) => setFormData({...formData, bank_id: e.target.value})}
                    className="w-full bg-white border border-indigo-200 rounded-lg p-2 text-xs font-semibold text-indigo-950 focus:ring-1 focus:ring-indigo-500 outline-none"
                  >
                    <option value="">Select Bank...</option>
                    {banks.map((b: any) => (
                      <option key={b.id} value={b.id}>{b.bank_name} - {b.account_number}</option>
                    ))}
                  </select>
                </div>
              )}

              {formData.bank_id && banks.find(b => b.id === formData.bank_id) ? (() => {
                const b = banks.find(b => b.id === formData.bank_id);
                return (
                  <div className="bg-white/60 p-3 rounded-lg border border-indigo-200/50 space-y-2 text-[11px] text-indigo-900 font-medium">
                    <div className="flex justify-between">
                        <span className="text-indigo-600">Bank</span>
                        <span>{b.bank_name}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-indigo-600">A/C Name</span>
                        <span>{b.account_name}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-indigo-600">A/C No</span>
                        <span className="font-mono">{b.account_number}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-indigo-600">IFSC</span>
                        <span className="font-mono">{b.ifsc_code}</span>
                    </div>
                    <div className="flex justify-between">
                        <span className="text-indigo-600">Branch</span>
                        <span>{b.branch_name}</span>
                    </div>
                  </div>
                );
              })() : (
                <div className="bg-white/60 p-3 rounded-lg border border-indigo-200/50 space-y-2 text-[11px] text-indigo-900 font-medium text-center">
                   Please select a bank account to display payment details.
                </div>
              )}
            </div>
          </div>
        </div>

          </div>
        </div>,
        document.body
      )}
    </>
  );
}
