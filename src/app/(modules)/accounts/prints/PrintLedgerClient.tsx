"use client";

import { useState, useMemo, useEffect } from "react";
import { format } from "date-fns";
import { 
  CreditCard, 
  Ban, 
  Receipt, 
  Search, 
  X, 
  Calendar, 
  User, 
  FileText, 
  IndianRupee, 
  Printer, 
  Copy, 
  RefreshCw, 
  Download,
  Eye
} from "lucide-react";
import * as XLSX from "xlsx";
import { PageHeader } from "@/components/modules/PageHeader";
import { DatePicker } from "@/components/ui/date-picker";
import { Select, SelectItem } from "@/components/ui/select";
import ReceiptViewModal from "../../prints/ReceiptViewModal";
import { cancelPrintJobAction } from "@/actions/print.actions";
import { useRouter, usePathname, useSearchParams } from "next/navigation";

export default function PrintLedgerClient({ 
  initialJobs, 
  userRole, 
  filters 
}: { 
  initialJobs: any[]; 
  userRole: string; 
  filters: any; 
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [jobs, setJobs] = useState<any[]>(initialJobs);
  const [receiptModalJob, setReceiptModalJob] = useState<any | null>(null);

  const [localSearch, setLocalSearch] = useState(filters.search || "");
  const [localStatus, setLocalStatus] = useState(filters.status || "");
  const [localFrom, setLocalFrom] = useState(filters.from || "");
  const [localTo, setLocalTo] = useState(filters.to || "");

  useEffect(() => {
    setJobs(initialJobs);
  }, [initialJobs]);

  useEffect(() => {
    const handler = setTimeout(() => {
      const params = new URLSearchParams(searchParams.toString());
      const currentSearch = params.get('search') || '';
      const currentStatus = params.get('status') || '';
      const currentFrom = params.get('from') || '';
      const currentTo = params.get('to') || '';

      if (currentSearch === localSearch && currentStatus === localStatus && 
          currentFrom === localFrom && currentTo === localTo) {
        return;
      }

      if (localSearch) params.set('search', localSearch); else params.delete('search');
      if (localStatus) params.set('status', localStatus); else params.delete('status');
      if (localFrom) params.set('from', localFrom); else params.delete('from');
      if (localTo) params.set('to', localTo); else params.delete('to');
      
      router.push(`${pathname}?${params.toString()}`);
    }, 400);

    return () => clearTimeout(handler);
  }, [localSearch, localStatus, localFrom, localTo, pathname, router, searchParams]);

  const handleClearFilters = () => {
    setLocalSearch("");
    setLocalStatus("");
    setLocalFrom("");
    setLocalTo("");
    router.push(pathname);
  };

  const handleCancel = async (jobId: string) => {
    if (!confirm("Are you sure you want to cancel this print job?")) return;
    const res = await cancelPrintJobAction(jobId);
    if (res.success) {
      setJobs(jobs.map(j => j.id === jobId ? { ...j, status: 'cancelled' } : j));
    } else {
      alert(res.error || "Failed to cancel");
    }
  };

  const handleExportExcel = () => {
    const headers = [
      "Job ID",
      "Date",
      "Client Name",
      "Client Phone",
      "Details",
      "Paper Size",
      "Print Type",
      "Copies",
      "Amount",
      "Status"
    ];
    
    const rows = jobs.map(job => [
      job.id,
      format(new Date(job.created_at), "yyyy-MM-dd HH:mm"),
      job.client_name,
      job.client_phone || '',
      job.file_name || 'Walk-in Document',
      job.paper_size,
      job.print_type?.toUpperCase(),
      job.copies,
      job.amount,
      job.status?.toUpperCase()
    ]);
    
    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Print Ledger');
    
    XLSX.writeFile(workbook, `Print_Ledger_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`);
  };

  const totals = useMemo(() => {
    let count = 0;
    let totalAmount = 0;
    let paidAmount = 0;
    let unpaidAmount = 0;

    jobs.forEach(job => {
      count++;
      const amt = Number(job.amount) || 0;
      totalAmount += amt;
      if (job.status === 'paid') {
        paidAmount += amt;
      } else if (job.status !== 'cancelled') {
        unpaidAmount += amt;
      }
    });

    return { count, totalAmount, paidAmount, unpaidAmount };
  }, [jobs]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={<span className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">Print <span className="text-indigo-600">Ledger</span></span>}
        subtitle={<span className="text-base text-slate-500 font-medium">Accounting and revenue logs for all print desk operations</span>}
        icon={Receipt}
        actions={
          <button
            onClick={handleExportExcel}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all shadow-sm active:scale-95"
          >
            <Download className="w-4 h-4" />
            Export Excel
          </button>
        }
      />

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total Revenue</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">₹{totals.totalAmount.toLocaleString()}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wider">Collected (Paid)</p>
          <p className="text-2xl font-bold text-emerald-700 dark:text-emerald-400 mt-1">₹{totals.paidAmount.toLocaleString()}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider">Unpaid / Pending</p>
          <p className="text-2xl font-bold text-amber-700 dark:text-amber-400 mt-1">₹{totals.unpaidAmount.toLocaleString()}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl p-4 shadow-sm">
          <p className="text-xs font-semibold text-indigo-600 uppercase tracking-wider">Total Jobs</p>
          <p className="text-2xl font-bold text-indigo-700 dark:text-indigo-400 mt-1">{totals.count}</p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col md:flex-row items-end gap-4 p-5 rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900/40">
        {/* Search */}
        <div className="flex-1 w-full space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block ml-1">Search</label>
          <div className="relative group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              placeholder="Search client, phone, or job ID..."
              className="w-full h-10 bg-white dark:bg-slate-950 border border-slate-200 dark:border-white/10 rounded-xl pl-10 pr-4 text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all placeholder:text-slate-400"
            />
          </div>
        </div>
        
        {/* Status */}
        <div className="w-full md:w-44 space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block ml-1">Status</label>
          <Select
            value={localStatus}
            onValueChange={setLocalStatus}
            buttonClassName="h-10 w-full"
          >
            <SelectItem value="">All Statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="printed">Printed</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </Select>
        </div>

        {/* From Date */}
        <div className="w-full md:w-40 space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block ml-1">From</label>
          <DatePicker
            value={localFrom}
            onChange={(e) => setLocalFrom(e.target.value)}
            className="h-10"
          />
        </div>

        {/* To Date */}
        <div className="w-full md:w-40 space-y-1.5">
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block ml-1">To</label>
          <DatePicker
            value={localTo}
            onChange={(e) => setLocalTo(e.target.value)}
            className="h-10"
          />
        </div>

        {/* Actions */}
        <div className="flex items-end gap-2 w-full md:w-auto shrink-0">
          <button
            onClick={handleClearFilters}
            className="h-10 px-4 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-semibold text-xs flex items-center justify-center gap-1.5 border border-indigo-200/50 dark:border-indigo-500/20 transition-all active:scale-95"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Reset
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-slate-600">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50/80 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-semibold text-slate-600">
                  <div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-slate-400" /> Job ID / Date</div>
                </th>
                <th className="px-6 py-4 font-semibold text-slate-600">
                  <div className="flex items-center gap-2"><User className="w-4 h-4 text-slate-400" /> Client Info</div>
                </th>
                <th className="px-6 py-4 font-semibold text-slate-600">
                  <div className="flex items-center gap-2"><FileText className="w-4 h-4 text-slate-400" /> Details</div>
                </th>
                <th className="px-6 py-4 font-semibold text-slate-600">
                  <div className="flex items-center gap-2"><Copy className="w-4 h-4 text-slate-400" /> Copies</div>
                </th>
                <th className="px-6 py-4 font-semibold text-slate-600">
                  <div className="flex items-center gap-2"><IndianRupee className="w-4 h-4 text-slate-400" /> Finance</div>
                </th>
                <th className="px-6 py-4 font-semibold text-slate-600 text-center">Status</th>
                <th className="px-6 py-4 font-semibold text-slate-600 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {jobs.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-slate-500 bg-slate-50/50">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <Printer className="w-8 h-8 text-slate-300" />
                      <p className="text-sm font-medium text-slate-500">No print jobs found matching filters.</p>
                    </div>
                  </td>
                </tr>
              ) : jobs.map((job) => (
                <tr key={job.id} className="hover:bg-indigo-50/30 transition-colors group">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">{job.id}</div>
                    <div className="text-xs text-slate-500 font-medium">{format(new Date(job.created_at), "MMM d, yyyy HH:mm")}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-semibold text-slate-800">{job.client_name}</div>
                    {job.client_phone && <div className="text-xs text-slate-500 font-medium">{job.client_phone}</div>}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-slate-700 truncate max-w-[200px]" title={job.file_name || "N/A"}>
                      {job.file_name || "Walk-in Document"}
                    </div>
                    <div className="text-[11px] text-slate-600 mt-1 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 font-medium">
                      {job.paper_size} {job.print_type?.toUpperCase()}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-semibold text-slate-700 bg-slate-50 px-2.5 py-1 rounded-md inline-block border border-slate-200">
                      {job.copies}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-bold text-slate-900">
                      ₹{job.amount?.toLocaleString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className={`px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wider border
                        ${job.status === 'paid' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : ''}
                        ${job.status === 'printed' ? 'bg-blue-50 text-blue-700 border-blue-100' : ''}
                        ${job.status === 'draft' ? 'bg-slate-50 text-slate-700 border-slate-200' : ''}
                        ${job.status === 'cancelled' ? 'bg-red-50 text-red-700 border-red-100' : ''}
                    `}>
                      {job.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => setReceiptModalJob(job)} 
                        className="h-8 px-3 rounded-lg text-xs font-semibold bg-indigo-50 hover:bg-indigo-100 text-indigo-600 border border-indigo-200 transition-all flex items-center gap-1"
                        title="View receipt"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        Receipt
                      </button>
                      {job.status !== 'cancelled' && job.status !== 'paid' && (
                        <button
                          onClick={() => handleCancel(job.id)}
                          className="h-8 px-3 rounded-lg text-xs font-semibold bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 transition-all flex items-center gap-1"
                          title="Cancel Job"
                        >
                          <Ban className="w-3.5 h-3.5" />
                          Cancel
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {receiptModalJob && (
        <ReceiptViewModal
          isOpen={!!receiptModalJob}
          onClose={() => setReceiptModalJob(null)}
          job={receiptModalJob}
        />
      )}
    </div>
  );
}
