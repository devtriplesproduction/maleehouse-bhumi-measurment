'use client';

import React from 'react';
import { 
  FileText, 
  Printer, 
  CheckCircle,
  Download
} from 'lucide-react';
import { format } from 'date-fns';
import type { CompanySettings } from '@/actions/settings.actions';
import { Button } from '@/components/ui/button';
import { DocumentHeader } from '../../../components/shared/DocumentHeader';

interface ClientReceiptViewerProps {
  receipt: {
    id: string; // The formatted display ID (e.g. REC-MS-...)
    type: 'milestone' | 'invoice';
    projectName: string;
    clientName: string;
    title: string;
    amount: number;
    dateCleared: string;
    originalId: string;
    projectId?: string;
    clientGstNumber?: string | null;
    gstType?: 'no_gst' | 'cgst_sgst_2_5' | 'cgst_sgst_5' | 'igst_5' | string;
    gstRate?: number;
    baseAmount?: number;
    gstAmount?: number;
  };
  companySettings: CompanySettings | null;
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
};

export function ClientReceiptViewer({ receipt, companySettings }: ClientReceiptViewerProps) {
  const handlePrint = () => {
    window.print();
  };

  const isIgst = receipt.gstType === 'igst_5' || receipt.gstType === 'IGST';
  const gstRate = receipt.gstRate ?? (receipt.gstType === 'cgst_sgst_5' ? 10 : (receipt.gstType === 'cgst_sgst_2_5' || receipt.gstType === 'igst_5') ? 5 : 0);
  const totalAmount = Number(receipt.amount) || 0;
  
  let baseAmount = totalAmount;
  let totalGst = 0;
  let cgst = 0;
  let sgst = 0;

  if (gstRate > 0) {
    baseAmount = Math.round(totalAmount / (1 + gstRate / 100));
    totalGst = totalAmount - baseAmount;
    if (!isIgst) {
      cgst = Math.round(totalGst / 2);
      sgst = totalGst - cgst;
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#0a0a0a] flex justify-center py-12 px-4 print:bg-white print:p-0 print:py-0">
      <style dangerouslySetInnerHTML={{ __html: `
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

      <div className="w-full max-w-[850px] flex flex-col gap-6">
        {/* Top Actions */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between bg-white dark:bg-[#111] p-4 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm print:hidden gap-4 md:gap-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 shrink-0">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-slate-900 dark:text-white">Payment Receipt</h1>
              <p className="text-xs font-medium text-slate-500 break-all">{receipt.id}</p>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
            <Button onClick={handlePrint} variant="outline" className="gap-2">
              <Printer className="w-4 h-4" />
              Print Receipt
            </Button>
            <Button onClick={handlePrint} variant="outline" className="gap-2">
              <Download className="w-4 h-4" />
              Download
            </Button>
          </div>
        </div>

        {/* Receipt Document Wrapper */}
        <div className="overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0 w-full">
          <div className="bg-white text-slate-800 shadow-xl border border-slate-200/60 rounded-xl flex flex-col p-6 sm:p-10 md:p-12 relative min-h-[750px] w-full md:min-w-[700px] overflow-x-auto print:overflow-visible print:border-none print:shadow-none print:p-0 print:m-0 print:min-w-0" id="printable-receipt">
           <div className="space-y-8 flex-1">
              {/* Document Header with Full Malee House Details */}
              <div className="flex flex-col sm:flex-row justify-between items-start gap-6 border-b border-slate-100 pb-6">
                 <DocumentHeader companySettings={companySettings} />

                 <div className="text-left sm:text-right space-y-4">
                    <h1 className="text-3xl font-extrabold text-slate-200 uppercase tracking-tight leading-none print:text-slate-300">Payment Receipt</h1>
                    
                    <div className="space-y-2 text-xs">
                       <div className="flex flex-col items-start sm:items-end">
                          <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">Receipt Number</p>
                          <p className="font-semibold text-slate-800 nums">#{receipt.id}</p>
                       </div>
                       <div className="flex flex-col items-start sm:items-end">
                          <p className="text-[9px] font-semibold text-slate-400 uppercase tracking-wider">Date Settled</p>
                          <p className="font-semibold text-slate-800">{format(new Date(receipt.dateCleared), 'MMMM dd, yyyy')}</p>
                       </div>
                    </div>
                 </div>
              </div>

              {/* Client Bill To & Project info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-slate-50 p-5 rounded-xl border border-slate-200/50 text-slate-700">
                  <div>
                     <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Billed To:</p>
                     <h2 className="text-sm font-semibold text-slate-800 leading-tight">{receipt.clientName}</h2>
                     <p className="text-xs text-slate-500 font-medium mt-0.5">Authorized client representative</p>
                     {receipt.clientGstNumber && (
                        <p className="text-[10px] text-slate-500 font-medium mt-1 uppercase font-semibold">GSTIN: {receipt.clientGstNumber}</p>
                     )}
                  </div>
                 <div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Project Assignment:</p>
                    <h2 className="text-sm font-semibold text-slate-800 leading-tight">{receipt.projectName}</h2>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">ID: {receipt.projectId || 'N/A'}</p>
                 </div>
              </div>

              {/* Items Table */}
              <div className="space-y-4 overflow-x-auto">
                 <table className="w-full border-collapse min-w-[500px]">
                    <thead>
                       <tr className="border-b border-slate-900 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                          <th className="py-2.5 text-left w-12">#</th>
                          <th className="py-2.5 text-left">Paid Item Description</th>
                          <th className="py-2.5 text-right w-36">Settled Amount</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                       <tr className="align-top">
                          <td className="py-4 text-xs font-semibold text-slate-400">1</td>
                          <td className="py-4">
                             <p className="text-xs font-semibold text-slate-900 uppercase tracking-tight">{receipt.title}</p>
                             <p className="text-[11px] text-slate-500 mt-1 leading-relaxed max-w-lg">
                                {receipt.type === 'milestone' 
                                   ? `Project milestone payment collection - status: paid & verified.`
                                   : `Project invoice payment ledger collection.`}
                             </p>
                           </td>
                           <td className="py-4 text-right text-xs font-semibold text-slate-900 nums">{formatCurrency(receipt.amount)}</td>
                       </tr>
                    </tbody>
                 </table>
              </div>
           </div>

           {/* Totals panel */}
           <div className="border-t-2 border-double border-slate-900 pt-6 mt-8 flex justify-end">
              <div className="w-full md:w-80 space-y-2.5 text-xs text-slate-600">
                 <div className="flex justify-between items-center">
                    <span>Taxable Base Value:</span>
                    <span className="font-semibold text-slate-900 nums">{formatCurrency(baseAmount)}</span>
                 </div>
                 {gstRate > 0 ? (
                    isIgst ? (
                       <div className="flex justify-between items-center">
                          <span>IGST ({gstRate}%):</span>
                          <span className="font-semibold text-slate-900 nums">{formatCurrency(totalGst)}</span>
                       </div>
                    ) : (
                       <>
                          <div className="flex justify-between items-center">
                             <span>CGST ({gstRate / 2}%):</span>
                             <span className="font-semibold text-slate-900 nums">{formatCurrency(cgst)}</span>
                          </div>
                          <div className="flex justify-between items-center">
                             <span>SGST ({gstRate / 2}%):</span>
                             <span className="font-semibold text-slate-900 nums">{formatCurrency(sgst)}</span>
                          </div>
                       </>
                    )
                 ) : (
                    <div className="flex justify-between items-center text-slate-400 italic text-[11px]">
                       <span>GST Rate:</span>
                       <span>Exempt / Nil Rated (0% GST)</span>
                    </div>
                 )}
                 <div className="pt-3 border-t border-slate-200 flex justify-between items-end">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-emerald-600">Total Payout Received</p>
                    <p className="text-xl font-bold text-slate-900 tracking-tight nums">{formatCurrency(receipt.amount)}</p>
                 </div>
              </div>
           </div>

           {/* Signatures / Verification */}
           <div className="border-t border-slate-200 pt-8 mt-10 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-8 text-slate-700">
              <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-slate-50 border border-slate-200/60 w-fit text-slate-500">
                 <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                 <div className="text-left leading-none">
                    <span className="text-[8px] font-bold uppercase tracking-wider block">Digitally Verified</span>
                    <span className="text-[7.5px] font-medium text-slate-400 block mt-0.5">ID: {receipt.originalId?.slice(0, 12)}</span>
                 </div>
              </div>

              <div className="flex flex-wrap sm:flex-nowrap gap-6 sm:gap-12 text-center text-[10px] text-slate-500 uppercase tracking-wider">
                     <div className="w-36">
                        <div className="h-16 border-b border-slate-300 flex items-end justify-center pb-1">
                           <img src="/signature.png" alt="Signature" className="h-14 scale-110 object-contain opacity-80" />
                        </div>
                        <p className="font-semibold text-slate-800 mt-2">Prepared By</p>
                        <p className="text-[8px] text-slate-400 mt-0.5">Finance Department</p>
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
    </div>
  );
}
