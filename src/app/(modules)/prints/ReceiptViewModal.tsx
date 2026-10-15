"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { format } from "date-fns";
import { Printer, Download, CheckCircle, FileText, Ban, Link2, Mail, X } from "lucide-react";
import { DocumentHeader } from "@/components/shared/DocumentHeader";
import { Button } from "@/components/ui/button";

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
};

export default function ReceiptViewModal({ isOpen, onClose, job }: { isOpen: boolean, onClose: () => void, job: any }) {
  const [mounted, setMounted] = useState(false);

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

  const handlePrint = () => {
    window.print();
  };

  const isPaid = job.status === 'paid';
  const receiptTitle = isPaid ? 'Payment Receipt' : 'Client Bill / Estimate';
  const displayId = job.receipt_number || job.id;

  const copyReceiptLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard');
    } catch (err) {}
  };
  
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-md print:bg-white print:p-0">
      <div className="w-full max-w-[850px] flex flex-col gap-6 max-h-[90vh] overflow-y-auto print:max-h-none print:overflow-visible custom-scrollbar">
        {/* Top Control Bar */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between bg-slate-900/95 dark:bg-slate-950/90 backdrop-blur-md px-5 py-4 rounded-xl border border-white/10 shadow-xl text-white print:hidden gap-4 md:gap-0 sticky top-0 z-10">
          <div className="flex items-center gap-3">
             <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-purple-600 to-indigo-600 flex items-center justify-center text-white shrink-0 shadow-sm shadow-purple-500/20">
                <FileText className="w-4 h-4" />
             </div>
             <div>
                <h3 className="text-sm font-semibold tracking-tight">Receipt Preview</h3>
                <p className="text-[10px] text-slate-400 font-medium break-all">Reviewing {displayId}</p>
             </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            <button 
              onClick={handlePrint}
              className="text-slate-300 hover:text-white hover:bg-white/10 px-3 py-1.5 h-8 text-xs font-semibold gap-1.5 rounded-lg transition-all flex items-center"
            >
              <Printer className="w-3.5 h-3.5" />
              Print
            </button>
            <button 
              onClick={handlePrint}
              className="text-slate-300 hover:text-white hover:bg-white/10 px-3 py-1.5 h-8 text-xs font-semibold gap-1.5 rounded-lg transition-all flex items-center"
            >
              <Download className="w-3.5 h-3.5" />
              Download
            </button>
            <button 
              onClick={copyReceiptLink}
              className="text-slate-300 hover:text-white hover:bg-white/10 px-3 py-1.5 h-8 text-xs font-semibold gap-1.5 rounded-lg transition-all flex items-center"
            >
              <Link2 className="w-3.5 h-3.5" />
              Copy Link
            </button>
            <button 
              onClick={() => {
                  window.location.href = `mailto:?subject=Malee House - Print Receipt ${displayId}&body=Dear Client,%0D%0A%0D%0APlease find your print receipt ${displayId} here:%0D%0A${window.location.href}%0D%0A%0D%0ABest regards,%0D%0AMalee House`;
              }}
              className="text-slate-300 hover:text-white hover:bg-white/10 px-3 py-1.5 h-8 text-xs font-semibold gap-1.5 rounded-lg transition-all flex items-center"
            >
              <Mail className="w-3.5 h-3.5" />
              Email
            </button>
            <button 
              onClick={() => {
                  window.open(`https://wa.me/?text=Hi, please find the print receipt ${displayId} from Malee House here: ${window.location.href}`, '_blank');
              }}
              className="text-slate-300 hover:text-white hover:bg-emerald-500/20 hover:text-emerald-400 px-3 py-1.5 h-8 text-xs font-semibold gap-1.5 rounded-lg transition-all flex items-center"
            >
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.625 1.451 5.403.002 9.803-4.394 9.805-9.805.001-2.621-1.013-5.085-2.86-6.933-1.847-1.847-4.308-2.859-6.924-2.86-5.412 0-9.815 4.398-9.818 9.807-.001 1.536.417 3.033 1.21 4.385l-.995 3.636 3.733-.979zm11.105-6.857c-.247-.124-1.464-.722-1.692-.806-.228-.083-.393-.124-.559.124-.166.247-.641.806-.784.969-.143.163-.286.183-.534.059-.247-.124-1.043-.385-1.986-1.227-.733-.654-1.229-1.462-1.373-1.71-.143-.248-.015-.381.109-.504.111-.11.247-.286.371-.429.124-.143.165-.247.247-.412.082-.166.041-.309-.021-.433-.062-.124-.559-1.345-.765-1.838-.2-.486-.398-.419-.559-.427-.144-.008-.309-.009-.473-.009a.913.913 0 0 0-.66.309c-.228.247-.867.846-.867 2.062 0 1.216.883 2.39 1.007 2.556.124.165 1.737 2.654 4.209 3.717.588.253 1.047.404 1.405.518.59.187 1.127.161 1.551.098.473-.069 1.464-.598 1.67-.175.206.423.206.784.103.969-.103.186-.247.309-.494.186z" />
              </svg>
              WhatsApp
            </button>
            <div className="w-px h-5 bg-white/10 mx-1" />
            <button 
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 text-slate-400 hover:text-white flex items-center justify-center p-0 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Receipt Document Wrapper */}
        <div className="overflow-x-auto pb-4 px-0 w-full">
          <div className="bg-white text-slate-800 shadow-xl border border-slate-200/60 rounded-xl flex flex-col p-6 sm:p-10 md:p-12 relative min-h-[750px] w-full md:min-w-[700px] overflow-x-auto print:overflow-visible print:border-none print:shadow-none print:p-0 print:m-0 print:min-w-0" id="printable-receipt">
           <div className="space-y-8 flex-1">
              {/* Document Header with Full Malee House Details */}
              <div className="flex flex-col sm:flex-row justify-between items-start gap-6 border-b border-slate-100 pb-6">
                 <DocumentHeader companySettings={null} />

                 <div className="text-left sm:text-right space-y-4">
                    <h1 className="text-3xl font-extrabold text-slate-200 uppercase tracking-tight leading-none print:text-slate-300">{receiptTitle}</h1>
                    
                    <div className="space-y-2 text-xs">
                       <div className="flex flex-col items-start sm:items-end">
                          <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">{isPaid ? 'Receipt Number' : 'Job Number'}</p>
                          <p className="font-semibold text-slate-800 nums">#{displayId}</p>
                       </div>
                       <div className="flex flex-col items-start sm:items-end">
                          <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">{isPaid ? 'Date Settled' : 'Date Created'}</p>
                          <p className="font-semibold text-slate-800">{format(new Date(job.updated_at || job.created_at), 'MMMM dd, yyyy HH:mm')}</p>
                       </div>
                    </div>
                 </div>
              </div>

              {/* Client Bill To & Project info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-slate-50 p-5 rounded-xl border border-slate-200/50 text-slate-700">
                  <div>
                     <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Billed To:</p>
                     <h2 className="text-sm font-semibold text-slate-800 leading-tight">{job.client_name}</h2>
                     <p className="text-xs text-slate-500 font-medium mt-0.5">{job.client_phone || 'Walk-in customer'}</p>
                  </div>
                 <div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Service Type:</p>
                    <h2 className="text-sm font-semibold text-slate-800 leading-tight">Print Desk Services</h2>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">Status: <span className={`uppercase tracking-wide font-semibold ${isPaid ? 'text-green-600' : 'text-amber-600'}`}>{isPaid ? 'PAID' : 'PENDING'}</span></p>
                 </div>
              </div>

              {/* Items Table */}
              <div className="space-y-4 overflow-x-auto">
                 <table className="w-full border-collapse min-w-[500px]">
                    <thead>
                       <tr className="border-b border-slate-900 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                          <th className="py-2.5 text-left w-12">#</th>
                          <th className="py-2.5 text-left">Item Description</th>
                          <th className="py-2.5 text-right w-36">Amount</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                       <tr className="align-top">
                          <td className="py-4 text-xs font-semibold text-slate-400">1</td>
                          <td className="py-4">
                             <p className="text-xs font-semibold text-slate-900 uppercase tracking-tight">{job.file_name || 'Walk-in Print Document'}</p>
                             <p className="text-[11px] text-slate-500 mt-1 leading-relaxed max-w-lg">
                                {job.doc_type ? 'Type: ' + job.doc_type + ' • ' : ''}Specifications: {job.copies}x {job.paper_size} {job.print_type?.toUpperCase()}
                             </p>
                           </td>
                           <td className="py-4 text-right text-xs font-semibold text-slate-900 nums">{formatCurrency(job.amount)}</td>
                       </tr>
                    </tbody>
                 </table>
              </div>
           </div>

           {/* Totals panel */}
           <div className="border-t-2 border-double border-slate-900 pt-6 mt-8 flex justify-end">
              <div className="w-full md:w-72 space-y-2.5">
                 <div className="pt-3 border-t border-slate-200 flex justify-between items-end">
                    <p className={`text-[11px] font-bold uppercase tracking-wider ${isPaid ? 'text-emerald-600' : 'text-slate-600'}`}>Total Amount {isPaid ? 'Received' : 'Due'}</p>
                    <p className="text-xl font-bold text-slate-900 tracking-tight nums">{formatCurrency(job.amount)}</p>
                 </div>
              </div>
           </div>

           {/* Signatures / Verification */}
           <div className="border-t border-slate-200 pt-8 mt-10 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-8 text-slate-700">
              {isPaid ? (
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-slate-50 border border-slate-200/60 w-fit text-slate-500">
                   <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                   <div className="text-left leading-none">
                      <span className="text-[8px] font-bold uppercase tracking-wider block">Payment Verified</span>
                      <span className="text-[7.5px] font-medium text-slate-400 block mt-0.5">ID: {job.id.slice(0, 12)}</span>
                   </div>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-slate-50 border border-slate-200/60 w-fit text-slate-500 opacity-50">
                   <div className="text-left leading-none">
                      <span className="text-[8px] font-bold uppercase tracking-wider block">Payment Pending</span>
                      <span className="text-[7.5px] font-medium text-slate-400 block mt-0.5">ID: {job.id.slice(0, 12)}</span>
                   </div>
                </div>
              )}

              <div className="flex flex-wrap sm:flex-nowrap gap-6 sm:gap-12 text-center text-[10px] text-slate-500 uppercase tracking-wider">
                 <div className="w-36">
                    <div className="h-16 border-b border-slate-300 flex items-end justify-center pb-1">
                       <img src="/signature.png" alt="Signature" className="h-14 scale-110 object-contain opacity-80" />
                    </div>
                    <p className="font-semibold text-slate-800 mt-2">Prepared By</p>
                    <p className="text-[8px] text-slate-400 mt-0.5">Print Desk Services</p>
                 </div>
                 <div className="w-36">
                    <div className="h-16 border-b border-slate-300"></div>
                    <p className="font-semibold text-slate-800 mt-2">Verified By Client</p>
                    <p className="text-[8px] text-slate-400 mt-0.5">Receipt Acknowledged</p>
                 </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-receipt, #printable-receipt * {
            visibility: visible;
          }
          #printable-receipt {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            border: none !important;
            background: white !important;
            color: black !important;
            box-shadow: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
        }
      `}} />
    </div>,
    document.body
  );
}
