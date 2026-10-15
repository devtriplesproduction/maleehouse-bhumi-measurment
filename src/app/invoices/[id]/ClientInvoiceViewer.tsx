"use client";

import React from 'react';
import { Download, FileText, Printer, CreditCard } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { generateInvoicePDF } from '@/lib/pdf-generator';
import { toast } from 'sonner';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { publicUpdateInvoiceStatusAction } from '@/actions/finance.actions';
import { CheckCircle2, XCircle, Clock } from 'lucide-react';
import { DocumentHeader } from '../../../components/shared/DocumentHeader';

interface ClientInvoiceViewerProps {
  invoice: any;
  companySettings: any;
}

export function ClientInvoiceViewer({ invoice, companySettings }: ClientInvoiceViewerProps) {
  const router = useRouter();
  const [isUpdating, setIsUpdating] = useState(false);

  const handleUpdateStatus = async (status: string) => {
    setIsUpdating(true);
    try {
      const res = await publicUpdateInvoiceStatusAction(invoice.id, status);
      if (res.success) {
        toast.success(`Invoice marked as ${status.replace('_', ' ')}`);
        router.refresh();
      } else {
        toast.error(res.error || 'Failed to update invoice');
      }
    } catch(error) {
      toast.error('An unexpected error occurred');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDownload = () => {
    generateInvoicePDF(invoice, invoice.projects, companySettings);
  };

  const invoiceLink = typeof window !== 'undefined' ? window.location.href : '';

  const verifiedPayments = (invoice.payments || []).filter((p: any) => p.status === 'verified' || p.status === 'paid');
  const amountPaid = verifiedPayments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
  const totalAmount = Number(invoice.total_amount);
  const remainingAmount = Math.max(0, totalAmount - amountPaid);

  let projectBudget = Number(invoice.projects?.budget) || 0;
  const projectPayments = invoice.projects?.payments || [];
  const projectVerifiedPayments = projectPayments.filter((p: any) => p.status === 'verified' || p.status === 'paid');
  let projectAmountPaid = projectVerifiedPayments.reduce((sum: number, p: any) => sum + Number(p.amount), 0);
  if (projectAmountPaid === 0 && amountPaid > 0) {
    projectAmountPaid = amountPaid;
  }
  const projectAmountRemaining = Math.max(0, projectBudget - projectAmountPaid);
  const gstType: string = 'CGST_SGST';
  const gstRate = Number(
    invoice.gst_rate ?? (
      Number(invoice.amount) > 0
        ? Math.round((Number(invoice.gst_amount) / Number(invoice.amount)) * 100)
        : 0
    )
  ) || 0;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between py-10 px-4 sm:px-6 lg:px-8">
      {/* ── Outer Container ── */}
      <div className="max-w-5xl mx-auto w-full space-y-8 animate-in fade-in duration-500">
        
        {/* ── Top Control Bar (Dark Sticky Header) ── */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-slate-900/95 dark:bg-slate-950/90 backdrop-blur-md px-5 py-4 sm:py-3 rounded-xl border border-white/10 shadow-xl text-white gap-4 sm:gap-0 sticky top-4 z-50">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shrink-0">
                <FileText className="w-4 h-4" />
             </div>
             <div>
                <h3 className="text-sm font-semibold tracking-tight flex items-center gap-2">
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

          <div className="flex items-center gap-2">
            <button 
              onClick={() => window.print()}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg text-xs font-semibold transition-all"
            >
              <Printer className="w-3.5 h-3.5" />
              Print
            </button>
            <button 
              onClick={handleDownload}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-slate-300 hover:text-white hover:bg-white/10 rounded-lg text-xs font-semibold transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              Download PDF
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            
          {/* ── Beautiful A4 Visuals (Left 2 cols) ── */}
          <div className="lg:col-span-2 space-y-6 overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0 min-w-0">
            
            {/* PAGE 1: Services Table and Totals */}
            <div className="bg-white text-slate-800 shadow-2xl border border-slate-200/60 rounded-xl flex flex-col p-6 sm:p-10 relative w-full md:min-w-[700px] overflow-x-auto">
               <div className="absolute top-4 right-4 text-[8px] text-slate-300 uppercase tracking-widest pointer-events-none select-none font-medium">Page 1 of {projectBudget > 0 && invoice.milestone_id ? '2' : '1'}</div>

               <div className="space-y-6 flex-1 mt-4">
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
                        {invoice.projects?.gst_number && (
                           <p className="text-[10px] text-slate-500 font-medium mt-1 uppercase font-semibold">GSTIN: {invoice.projects.gst_number}</p>
                        )}
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
                                   {invoice.visit_id ? 'FIELD VISIT SERVICES' : 'PROFESSIONAL SERVICES'}
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

               {/* Totals panel located right below services */}
               <div className="border-t-2 border-double border-slate-900 pt-6 mt-8 flex justify-end">
                  <div className="w-full md:w-72 space-y-2.5">
                     <div className="flex justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider nums">
                        <span>Subtotal</span>
                        <span>INR {Number(invoice.amount).toLocaleString('en-IN')}</span>
                     </div>

                     {(!gstType || gstType === 'CGST_SGST') && Number(invoice.gst_amount) > 0 ? (
                        <>
                           <div className="flex justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider nums">
                              <span>CGST ({gstRate / 2}%)</span>
                              <span>INR {(Number(invoice.gst_amount) / 2).toLocaleString('en-IN')}</span>
                           </div>
                           <div className="flex justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider nums">
                              <span>SGST ({gstRate / 2}%)</span>
                              <span>INR {(Number(invoice.gst_amount) / 2).toLocaleString('en-IN')}</span>
                           </div>
                        </>
                     ) : gstType === 'IGST' && Number(invoice.gst_amount) > 0 ? (
                        <div className="flex justify-between text-xs font-semibold text-slate-500 uppercase tracking-wider nums">
                           <span>IGST ({gstRate}%)</span>
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

                     {/* End of Totals */}
                  </div>
               </div>
            </div>

            {/* PAGE 2: Project Financial Summary */}
            {projectBudget > 0 && invoice.milestone_id && (
               <div className="bg-white text-slate-800 shadow-2xl border border-slate-200/60 rounded-xl flex flex-col p-6 sm:p-10 relative mt-6 min-h-[500px] w-full md:min-w-[700px] overflow-x-auto">
                  <div className="absolute top-4 right-4 text-[8px] text-slate-300 uppercase tracking-widest pointer-events-none select-none font-medium">Page 2 of 2</div>
                  <div className="space-y-6 flex-1 mt-4">
                     <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-6">Project Financial Summary</h2>
                     
                     <div className="space-y-4">
                        <table className="w-full border-collapse">
                           <thead>
                              <tr className="border-b border-slate-900 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                                 <th className="py-2.5 text-left w-12">#</th>
                                 <th className="py-2.5 text-left">Description</th>
                                 <th className="py-2.5 text-right w-36">Amount</th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-slate-100 text-slate-700">
                              <tr className="align-top">
                                 <td className="py-4 text-xs font-semibold text-slate-400">1</td>
                                 <td className="py-4">
                                    <p className="text-xs font-semibold text-slate-900 uppercase tracking-tight">Total Cost of Project</p>
                                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed max-w-lg">Total approved budget for this project.</p>
                                 </td>
                                 <td className="py-4 text-right text-xs font-semibold text-slate-900 nums">INR {projectBudget.toLocaleString('en-IN')}</td>
                              </tr>
                              <tr className="align-top">
                                 <td className="py-4 text-xs font-semibold text-slate-400">2</td>
                                 <td className="py-4">
                                    <p className="text-xs font-semibold text-slate-900 uppercase tracking-tight">Previously Paid</p>
                                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed max-w-lg">Sum of all payments cleared before this invoice.</p>
                                 </td>
                                 <td className="py-4 text-right text-xs font-semibold text-slate-900 nums">INR {Math.max(0, projectAmountPaid - amountPaid).toLocaleString('en-IN')}</td>
                              </tr>
                              <tr className="align-top bg-indigo-50/30">
                                 <td className="py-4 text-xs font-semibold text-indigo-400 px-2 rounded-l-lg">3</td>
                                 <td className="py-4">
                                    <p className="text-xs font-bold text-indigo-700 uppercase tracking-tight">Current Invoice Due</p>
                                    <p className="text-[11px] text-indigo-600/70 mt-1 leading-relaxed max-w-lg">Amount requested in this current milestone invoice.</p>
                                 </td>
                                 <td className="py-4 text-right text-xs font-bold text-indigo-700 nums px-2 rounded-r-lg">INR {totalAmount.toLocaleString('en-IN')}</td>
                              </tr>
                           </tbody>
                        </table>
                     </div>

                     <div className="border-t-2 border-double border-slate-900 pt-6 mt-8 flex justify-end">
                        <div className="w-full md:w-[350px] space-y-2.5">
                           <div className="flex justify-between items-end bg-slate-50 p-4 rounded-xl border border-slate-200">
                              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-600">Project Balance Remaining</p>
                              <p className="text-xl font-bold text-slate-900 tracking-tight nums">INR {Math.max(0, projectBudget - (projectAmountPaid - amountPaid) - totalAmount).toLocaleString('en-IN')}</p>
                           </div>
                        </div>
                     </div>
                  </div>
               </div>
            )}
          </div>

          {/* ── Sticky Action Panel (Right Col) ── */}
          <div className="lg:col-span-1 space-y-4 lg:sticky lg:top-8">
            <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-xl shadow-slate-200/40">
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4">Invoice Actions</h3>
              
              <div className="space-y-3">
                <button 
                  onClick={handleDownload}
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

            {/* Client Response Actions */}
            {invoice.status !== 'paid' && invoice.status !== 'cancelled' && (
              <div className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-xl shadow-slate-200/40">
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-4">Client Response</h3>
                
                <div className="space-y-3">
                  {invoice.status !== 'accepted' && (
                    <button 
                      onClick={() => handleUpdateStatus('accepted')}
                      disabled={isUpdating}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-4 h-4" /> Accept Invoice
                    </button>
                  )}
                  
                  {invoice.status !== 'in_review' && (
                    <button 
                      onClick={() => handleUpdateStatus('in_review')}
                      disabled={isUpdating}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                    >
                      <Clock className="w-4 h-4" /> Mark Under Review
                    </button>
                  )}

                  {invoice.status !== 'rejected' && (
                    <button 
                      onClick={() => handleUpdateStatus('rejected')}
                      disabled={isUpdating}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
                    >
                      <XCircle className="w-4 h-4" /> Reject Invoice
                    </button>
                  )}
                </div>
              </div>
            )}



            {invoice.bank && (
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
                <div className="bg-white/60 p-3 rounded-lg border border-indigo-200/50 space-y-2 text-[11px] text-indigo-900 font-medium">
                   <div className="flex justify-between">
                      <span className="text-indigo-600">Bank</span>
                      <span>{invoice.bank.bank_name}</span>
                   </div>
                   <div className="flex justify-between">
                      <span className="text-indigo-600">A/C Name</span>
                      <span>{invoice.bank.account_name}</span>
                   </div>
                   <div className="flex justify-between">
                      <span className="text-indigo-600">A/C No</span>
                      <span className="font-mono">{invoice.bank.account_number}</span>
                   </div>
                   <div className="flex justify-between">
                      <span className="text-indigo-600">IFSC</span>
                      <span className="font-mono">{invoice.bank.ifsc_code}</span>
                   </div>
                </div>
              </div>
            )}

          </div>

        </div>
      </div>
      
      {/* ── Footer ── */}
      <div className="max-w-5xl mx-auto w-full mt-12 pt-6 border-t border-slate-200 text-center">
        <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
          © {new Date().getFullYear()} Malee House. All rights reserved.
        </p>
      </div>
    </div>
  );
}
