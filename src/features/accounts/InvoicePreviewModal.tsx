'use client';

import React, { useState } from 'react';
import { Printer, Download, CreditCard, Send, CheckCircle2, ChevronRight, Share2, FileText, X, Mail, Link2, Loader2 } from 'lucide-react';
import { DocumentHeader } from '../../components/shared/DocumentHeader';
import { Button } from '@/components/ui/button';
import { format } from 'date-fns';
import { createPortal } from 'react-dom';
import { generateInvoicePDF } from '@/lib/pdf-generator';
import { getBankAccountsAction } from '@/actions/bank.actions';
import { markInvoiceAsSentAction, getInvoiceByIdAction } from '@/actions/finance.actions';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface InvoicePreviewModalProps {
  invoice: any;
  companySettings: any;
  onClose: () => void;
  onRefresh: () => void;
}

export function InvoicePreviewModal({ invoice, companySettings, onClose, onRefresh }: InvoicePreviewModalProps) {
  const [mounted, setMounted] = React.useState(false);
  const [isSending, setIsSending] = useState(false);
  const [bank, setBank] = useState<any>(null);
  const [banks, setBanks] = useState<any[]>([]);
  const [isUpdatingBank, setIsUpdatingBank] = useState(false);
  const [detailedInvoice, setDetailedInvoice] = useState<any>(invoice);

  React.useEffect(() => {
    setMounted(true);
    setDetailedInvoice(invoice);
    
    // Fetch complete invoice data with project payments if not already present
    if (invoice?.id && (!invoice.projects?.payments || invoice.projects?.payments.length === 0)) {
      getInvoiceByIdAction(invoice.id).then(res => {
        if (res && res.success && res.data) {
          setDetailedInvoice((prev: any) => ({ ...prev, ...res.data }));
        }
      }).catch(console.error);
    }

    getBankAccountsAction().then(res => {
      if (res && res.success && res.data) {
        setBanks(res.data);
        if (invoice.bank_id) {
          setBank(res.data.find((b: any) => b.id === invoice.bank_id) || null);
        }
      }
    }).catch(console.error);
  }, [invoice.id, invoice.bank_id]);

  const handleBankChange = async (bankId: string) => {
    setIsUpdatingBank(true);
    const { updateInvoiceBankAccountAction } = await import('@/actions/finance.actions');
    const result = await updateInvoiceBankAccountAction(invoice.id, bankId);
    if (result.success) {
      toast.success('Bank account updated successfully');
      setBank(banks.find(b => b.id === bankId) || null);
      onRefresh();
    } else {
      toast.error('Failed to update bank account', { description: result.error });
    }
    setIsUpdatingBank(false);
  };

  const invoiceLink = typeof window !== 'undefined' ? `${window.location.origin}/invoices/${invoice.id}` : '';

  const activeInvoice = detailedInvoice || invoice;
  const verifiedPayments = (activeInvoice.payments || []).filter((p: any) => p.status === 'verified' || p.status === 'paid');
  const amountPaid = verifiedPayments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
  const totalAmount = Number(activeInvoice.total_amount);
  const remainingAmount = Math.max(0, totalAmount - amountPaid);

  const projectBudget = Number(activeInvoice.projects?.budget) || 0;
  const projectChecklist = (activeInvoice.projects as any)?.requirement_checklist;
  const projectGstType = projectChecklist?.gst_type || (activeInvoice as any)?.gst_type;
  const gstType: string = projectGstType === 'igst_5' || projectGstType === 'IGST' ? 'IGST' : 'CGST_SGST';
  const projectPayments = activeInvoice.projects?.payments || [];
  const projectVerifiedPayments = projectPayments.filter((p: any) => p.status === 'verified' || p.status === 'paid');
  let projectAmountPaid = projectVerifiedPayments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
  if (projectAmountPaid === 0 && amountPaid > 0) {
    projectAmountPaid = amountPaid;
  }
  const projectAmountRemaining = Math.max(0, projectBudget - projectAmountPaid);

  const copyClientLink = () => {
    if (!invoiceLink) return;
    navigator.clipboard.writeText(invoiceLink);
    toast.success('Invoice link copied to clipboard');
  };

  const handleSend = async () => {
    setIsSending(true);
    const result = await markInvoiceAsSentAction(invoice.id);
    if (result.success) {
      toast.success('Invoice marked as sent successfully');
      onRefresh();
      onClose();
    } else {
      toast.error('Failed to send invoice', { description: result.error });
    }
    setIsSending(false);
  };

  if (!mounted) return null;
  
  return createPortal(
    <div className="fixed inset-0 z-[9999] overflow-y-auto p-6 md:p-12 flex justify-center items-start animate-in fade-in duration-300">
      {/* Full screen backdrop that blurs everything, including the sidebar */}
      <div 
        className="fixed inset-0 bg-slate-950/60 dark:bg-black/85 backdrop-blur-md z-0" 
        onClick={onClose}
      />
      
      <div className="relative w-full max-w-5xl flex flex-col gap-6 z-10 my-4">
        {/* Top Control Bar (Dark Sticky Header) */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between bg-slate-900/95 dark:bg-slate-950/90 backdrop-blur-md px-5 py-4 rounded-xl border border-white/10 shadow-xl text-white gap-4 md:gap-0">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shrink-0">
                <FileText className="w-4 h-4" />
             </div>
              <div>
                 <h3 className="text-sm font-semibold tracking-tight flex items-center gap-2 flex-wrap">
                   Invoice Portal
                   <span className={cn(
                     "px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider border shadow-sm ml-2",
                     invoice.status === 'paid' ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/20' :
                     invoice.status === 'accepted' ? 'bg-teal-500/20 text-teal-300 border-teal-500/20' :
                     invoice.status === 'rejected' ? 'bg-red-500/20 text-red-300 border-red-500/20' :
                     invoice.status === 'in_review' ? 'bg-amber-500/20 text-amber-300 border-amber-500/20' :
                     invoice.status === 'overdue' ? 'bg-rose-500/20 text-rose-300 border-rose-500/20' :
                     invoice.status === 'cancelled' ? 'bg-white/10 text-slate-300 border-white/10' :
                     'bg-blue-500/20 text-blue-300 border-blue-500/20'
                   )}>
                     {invoice.status}
                   </span>
                 </h3>
                 <p className="text-[10px] text-slate-400 font-medium mt-0.5">Reviewing {invoice.invoice_number} • Malee House Surveying OS</p>
              </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <Button 
              onClick={() => {
                window.print();
              }}
              variant="ghost" 
              className="text-slate-300 hover:text-white hover:bg-white/10 px-3 py-1.5 h-8 text-xs font-semibold gap-1.5 rounded-lg transition-all"
            >
              <Printer className="w-3.5 h-3.5" />
              Print
            </Button>
            <Button 
              onClick={() => generateInvoicePDF(invoice, invoice.projects, companySettings, bank)}
              variant="ghost" 
              className="text-slate-300 hover:text-white hover:bg-white/10 px-3 py-1.5 h-8 text-xs font-semibold gap-1.5 rounded-lg transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              Download PDF
            </Button>
            <Button 
              onClick={() => {
                 const link = `${window.location.origin}/invoices/${invoice.id}`;
                 window.location.href = `mailto:?subject=Malee House - Invoice ${invoice.invoice_number}&body=Dear Client,%0D%0A%0D%0APlease find your invoice ${invoice.invoice_number} ready for your review and payment here:%0D%0A${link}%0D%0A%0D%0ABest regards,%0D%0AMalee House Finance`;
              }}
              variant="ghost" 
              className="text-slate-300 hover:text-white hover:bg-white/10 px-3 py-1.5 h-8 text-xs font-semibold gap-1.5 rounded-lg transition-all"
            >
              <Mail className="w-3.5 h-3.5" />
              Email
            </Button>
            <Button 
              onClick={copyClientLink}
              variant="ghost" 
              className="text-slate-300 hover:text-white hover:bg-white/10 px-3 py-1.5 h-8 text-xs font-semibold gap-1.5 rounded-lg transition-all"
            >
              <Link2 className="w-3.5 h-3.5" />
              Copy Link
            </Button>
            
            {invoice.status === 'draft' ? (
              <Button 
                onClick={handleSend}
                disabled={isSending}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 h-8 text-xs font-semibold gap-1.5 rounded-lg transition-all ml-2"
              >
                {isSending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                {isSending ? 'Marking...' : 'Share Successfully'}
              </Button>
            ) : (
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-500/20 text-emerald-300 text-xs font-bold border border-emerald-500/20 ml-2">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Shared
              </div>
            )}

            <div className="w-px h-5 bg-white/10 mx-1" />
            <Button 
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-white flex items-center justify-center p-0 transition-colors"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          <div className="lg:col-span-2 space-y-6 overflow-x-auto pb-4 -mx-4 px-4 md:mx-0 md:px-0 w-full min-w-0">
            {/* Invoice Body Container */}
            <div className="bg-white text-slate-800 shadow-2xl border border-slate-200/60 rounded-xl flex flex-col p-6 sm:p-10 md:p-12 relative min-h-[900px] w-full md:min-w-[700px] overflow-x-auto justify-between">
           <div className="absolute top-4 right-4 text-[8px] text-slate-300 uppercase tracking-widest pointer-events-none select-none font-medium">Page 1 of 1</div>

           <div className="space-y-8 flex-1">
              {/* Document Header with Full Malee House Details */}
              <div className="flex flex-col sm:flex-row justify-between items-start gap-6 border-b border-slate-100 pb-6">
                 <DocumentHeader companySettings={companySettings} />

                 <div className="text-left sm:text-right space-y-4">
                    <h1 className="text-3xl font-extrabold text-slate-200 uppercase tracking-tight leading-none">
                      {amountPaid > 0 ? 'Tax Invoice' : 'Proforma Invoice'}
                    </h1>
                    
                    <div className="space-y-2 text-xs">
                       <div className="flex flex-col items-start sm:items-end">
                          <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">Invoice Number</p>
                          <p className="font-semibold text-slate-800 nums">#{invoice.invoice_number}</p>
                       </div>
                       <div className="flex flex-col items-start sm:items-end">
                          <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">Date Issued</p>
                          <p className="font-semibold text-slate-800">{format(new Date(invoice.created_at), 'MMMM dd, yyyy')}</p>
                       </div>
                       <div className="flex flex-col items-start sm:items-end">
                          <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">Due Date</p>
                          <p className="font-semibold text-slate-800">
                              {invoice.due_date ? format(new Date(invoice.due_date), 'MMMM dd, yyyy') : 'Upon Receipt'}
                          </p>
                       </div>
                    </div>
                 </div>
              </div>

              {/* Client Bill To & Project info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-slate-50 p-5 rounded-xl border border-slate-200/50 text-slate-700">
                 <div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Client Bill To:</p>
                    <h2 className="text-sm font-semibold text-slate-800 leading-tight">{invoice.projects?.client_name || 'Client Name'}</h2>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">{invoice.projects?.client_contact || 'Authorized project engagement'}</p>
                 </div>
                 <div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Project Assignment:</p>
                    <h2 className="text-sm font-semibold text-slate-800 leading-tight">{invoice.projects?.name || 'Project Name'}</h2>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">Location: {invoice.projects?.site_details?.address || 'Site Technical Survey'}</p>
                 </div>
              </div>

              {/* Services Table */}
              <div className="space-y-4 overflow-x-auto">
                 <table className="w-full border-collapse min-w-[500px]">
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
                               {invoice.visit_id ? 'FIELD VISIT SERVICES' : 'Professional Services'}
                             </p>
                             <p className="text-[11px] text-slate-500 mt-1 leading-relaxed max-w-lg">
                               {invoice.visit_id ? 'Scheduled from Milestones Portal' : 'As per project milestone agreement.'}
                             </p>
                          </td>
                          <td className="py-4 text-center text-xs font-semibold text-slate-800">1</td>
                          <td className="py-4 text-right text-xs font-medium text-slate-800 nums">INR {Number(invoice.amount).toLocaleString('en-IN')}</td>
                          <td className="py-4 text-right text-xs font-semibold text-slate-900 nums">INR {Number(invoice.amount).toLocaleString('en-IN')}</td>
                       </tr>
                    </tbody>
                 </table>
              </div>
           </div>

           {/* Totals and Bank Details panel located right below services */}
           <div className="border-t-2 border-double border-slate-900 pt-6 mt-8 flex flex-col md:flex-row justify-between items-start gap-8">
              {/* Bank Details on the left */}
              <div className="flex-1 max-w-sm">
                 <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Payment Information</h3>
                 {bank ? (
                    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/60 space-y-2 text-[11px] text-slate-700 font-medium">
                       <div className="flex justify-between border-b border-slate-200 pb-1.5">
                          <span className="text-slate-500">Bank</span>
                          <span className="font-semibold text-slate-900">{bank.bank_name}</span>
                       </div>
                       <div className="flex justify-between border-b border-slate-200 pb-1.5">
                          <span className="text-slate-500">Account Name</span>
                          <span className="font-semibold text-slate-900">{bank.account_name}</span>
                       </div>
                       <div className="flex justify-between border-b border-slate-200 pb-1.5">
                          <span className="text-slate-500">Account No.</span>
                          <span className="font-mono font-semibold text-slate-900">{bank.account_number}</span>
                       </div>
                       <div className="flex justify-between border-b border-slate-200 pb-1.5">
                          <span className="text-slate-500">IFSC Code</span>
                          <span className="font-mono font-semibold text-slate-900">{bank.ifsc_code}</span>
                       </div>
                       <div className="flex justify-between">
                          <span className="text-slate-500">Branch</span>
                          <span className="font-semibold text-slate-900">{bank.branch_name}</span>
                       </div>
                    </div>
                 ) : (
                    <div className="bg-amber-50 p-4 rounded-xl border border-amber-200/60 text-[11px] text-amber-700 font-medium flex items-center justify-center text-center">
                       No bank account selected for this invoice. Please select one from the right panel.
                    </div>
                 )}
              </div>

              <div className="w-full md:w-72 space-y-2.5">
                 <div className="flex justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider nums">
                    <span>Subtotal</span>
                    <span>INR {Number(invoice.amount).toLocaleString('en-IN')}</span>
                 </div>

                 {(!gstType || gstType === 'CGST_SGST') && Number(invoice.gst_amount) > 0 ? (
                    <>
                       <div className="flex justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider nums">
                          <span>CGST ({(Number(invoice.gst_rate || Math.round((Number(invoice.gst_amount) / Number(invoice.amount)) * 100) || 0)) / 2}%)</span>
                          <span>INR {(Number(invoice.gst_amount) / 2).toLocaleString('en-IN')}</span>
                       </div>
                       <div className="flex justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider nums">
                          <span>SGST ({(Number(invoice.gst_rate || Math.round((Number(invoice.gst_amount) / Number(invoice.amount)) * 100) || 0)) / 2}%)</span>
                          <span>INR {(Number(invoice.gst_amount) / 2).toLocaleString('en-IN')}</span>
                       </div>
                    </>
                 ) : gstType === 'IGST' && Number(invoice.gst_amount) > 0 ? (
                    <div className="flex justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider nums">
                       <span>IGST ({Number(invoice.gst_rate || Math.round((Number(invoice.gst_amount) / Number(invoice.amount)) * 100) || 0)}%)</span>
                       <span>INR {Number(invoice.gst_amount).toLocaleString('en-IN')}</span>
                    </div>
                 ) : null}

                 <div className="pt-3 border-t border-slate-200 flex justify-between items-end">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-indigo-600">Grand Total</p>
                    <p className="text-xl font-bold text-slate-900 tracking-tight nums">INR {Number(invoice.total_amount).toLocaleString('en-IN')}</p>
                 </div>

                 <div className="flex justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider nums pt-2 border-t border-slate-100">
                    <span>Amount Paid</span>
                    <span>INR {amountPaid.toLocaleString('en-IN')}</span>
                 </div>

                 <div className={`flex justify-between items-end p-2 rounded-lg ${remainingAmount > 0 ? 'bg-rose-50 text-rose-600 border border-rose-100' : 'bg-emerald-50 text-emerald-600 border border-emerald-100'}`}>
                    <p className="text-[11px] font-bold uppercase tracking-wider">Invoice Balance</p>
                    <p className="text-lg font-bold tracking-tight nums">INR {remainingAmount.toLocaleString('en-IN')}</p>
                 </div>

                 {/* Project Totals */}
                 {projectBudget > 0 && (
                   <div className="pt-4 mt-2 border-t border-slate-200">
                     <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 mb-2">Project Financial Summary</p>
                     <div className="space-y-1.5">
                       <div className="flex justify-between text-[10px] font-semibold text-slate-500 uppercase tracking-wider nums">
                          <span>Total Cost of Project</span>
                          <span>INR {projectBudget.toLocaleString('en-IN')}</span>
                       </div>
                       <div className="flex justify-between text-[10px] font-semibold text-slate-500 uppercase tracking-wider nums">
                          <span>Total Project Paid</span>
                          <span>INR {projectAmountPaid.toLocaleString('en-IN')}</span>
                       </div>
                       <div className="flex justify-between text-[10px] font-semibold text-slate-600 uppercase tracking-wider nums bg-slate-100 p-1.5 rounded">
                          <span>Project Balance Remaining</span>
                          <span className="font-bold">INR {projectAmountRemaining.toLocaleString('en-IN')}</span>
                       </div>
                     </div>
                   </div>
                 )}
              </div>
           </div>
          </div>
          </div>

          {/* ── Sticky Action Panel (Right Col) ── */}
          <div className="lg:col-span-1 space-y-4 lg:sticky lg:top-24">
            <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-xl shadow-slate-200/40">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4">Invoice Actions</h3>
              
              <div className="space-y-3">
                <button 
                  onClick={() => generateInvoicePDF(invoice, invoice.projects, companySettings, bank)}
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
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4">Share Invoice</h3>
              <div className="space-y-3">
                <button 
                  onClick={copyClientLink}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all"
                >
                  <Link2 className="w-4 h-4" /> Copy Link
                </button>
                <a
                  onClick={() => { if (invoice.status === 'draft') handleSend(); }}
                  href={`mailto:?subject=Malee House - Invoice ${invoice.invoice_number}&body=Dear Client,%0D%0A%0D%0APlease find your invoice ${invoice.invoice_number} ready for your review and payment here:%0D%0A${invoiceLink}%0D%0A%0D%0ABest regards,%0D%0AMalee House Finance`}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-50 hover:bg-indigo-50 border border-slate-200 hover:border-indigo-200 text-slate-700 hover:text-indigo-700 rounded-xl text-xs font-bold transition-all"
                >
                  <Mail className="w-4 h-4" /> Email Invoice
                </a>
                <a
                  onClick={() => { if (invoice.status === 'draft') handleSend(); }}
                  href={`https://wa.me/?text=Hi, please find the invoice ${invoice.invoice_number} from Malee House for your payment here: ${invoiceLink}`}
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
              {invoice.status === 'draft' && amountPaid === 0 ? (
                <div className="mb-3 space-y-2">
                  <label className="text-[10px] font-bold text-indigo-900 uppercase tracking-wider mb-1 block">
                    {bank ? 'Change Bank Account' : 'Select Bank Account'}
                  </label>
                  <select 
                    value={bank?.id || ''}
                    onChange={(e) => handleBankChange(e.target.value)}
                    disabled={isUpdatingBank}
                    className="w-full bg-white border border-indigo-200 rounded-lg p-2 text-xs font-semibold text-indigo-950 focus:ring-1 focus:ring-indigo-500 outline-none disabled:opacity-50"
                  >
                    <option value="">Select Bank...</option>
                    {banks.map((b: any) => (
                      <option key={b.id} value={b.id}>{b.bank_name} - {b.account_number}</option>
                    ))}
                  </select>
                </div>
              ) : null}

              {bank ? (
                <div className="bg-white/60 p-3 rounded-lg border border-indigo-200/50 space-y-2 text-[11px] text-indigo-900 font-medium">
                   <div className="flex justify-between">
                      <span className="text-indigo-600">Bank</span>
                      <span>{bank.bank_name}</span>
                   </div>
                   <div className="flex justify-between">
                      <span className="text-indigo-600">A/C Name</span>
                      <span>{bank.account_name}</span>
                   </div>
                   <div className="flex justify-between">
                      <span className="text-indigo-600">A/C No</span>
                      <span className="font-mono">{bank.account_number}</span>
                   </div>
                   <div className="flex justify-between">
                      <span className="text-indigo-600">IFSC</span>
                      <span className="font-mono">{bank.ifsc_code}</span>
                   </div>
                   <div className="flex justify-between">
                      <span className="text-indigo-600">Branch</span>
                      <span>{bank.branch_name}</span>
                   </div>
                </div>
              ) : (
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
  );
}
