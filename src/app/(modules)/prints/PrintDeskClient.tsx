"use client";

import { useState, useMemo } from "react";
import { format, isToday } from "date-fns";
import { 
  Plus, 
  Printer, 
  Calendar, 
  User, 
  FileText, 
  IndianRupee, 
  Copy, 
  Eye, 
  Search, 
  CheckCircle2, 
  Clock, 
  Layers, 
  Sparkles,
  CreditCard,
  Banknote,
  ArrowUpRight,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { PageHeader } from "@/components/modules/PageHeader";
import NewPrintJobDialog from "./NewPrintJobDialog";
import ReceiptViewModal from "./ReceiptViewModal";
import LogPaymentModal from "./LogPaymentModal";
import ManageDocTypesModal from "./ManageDocTypesModal";
import type { PrintDocumentType } from "@/actions/print.actions";
import { Select, SelectItem } from "@/components/ui/select";
import { cn } from "@/lib/utils";

const avatarColors = [
  "bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border-purple-200",
  "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border-indigo-200",
  "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 border-blue-200",
  "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-200",
  "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border-amber-200",
];

function getAvatarStyle(name: string) {
  const code = (name || "C").charCodeAt(0);
  return avatarColors[code % avatarColors.length];
}

export default function PrintDeskClient({ 
  initialJobs, 
  initialDocTypes = [],
  userRole, 
  projects, 
  urlPrefill 
}: { 
  initialJobs: any[]; 
  initialDocTypes?: PrintDocumentType[];
  userRole: string; 
  projects: any[]; 
  urlPrefill?: any; 
}) {
  const [jobs, setJobs] = useState<any[]>(initialJobs);
  const [docTypes, setDocTypes] = useState<PrintDocumentType[]>(initialDocTypes);
  const [isNewJobOpen, setIsNewJobOpen] = useState(!!urlPrefill?.projectId || !!urlPrefill?.clientName);
  const [isManageTypesOpen, setIsManageTypesOpen] = useState(false);
  const [receiptModalJob, setReceiptModalJob] = useState<any | null>(null);
  const [paymentModalJob, setPaymentModalJob] = useState<any | null>(null);

  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paperFilter, setPaperFilter] = useState("all");

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Real-time KPI metrics
  const stats = useMemo(() => {
    const totalJobsCount = jobs.filter(j => j.status !== "cancelled").length;
    const todayJobsCount = jobs.filter(j => j.status !== "cancelled" && j.created_at && isToday(new Date(j.created_at))).length;
    
    const paidRevenue = jobs
      .filter(j => j.status === "paid")
      .reduce((sum, j) => sum + (Number(j.amount) || 0), 0);

    const pendingRevenue = jobs
      .filter(j => j.status !== "paid" && j.status !== "cancelled")
      .reduce((sum, j) => sum + (Number(j.amount) || 0), 0);

    return { totalJobsCount, todayJobsCount, paidRevenue, pendingRevenue };
  }, [jobs]);

  // Filtered jobs
  const filteredJobs = useMemo(() => {
    return jobs.filter(j => {
      // Exclude cancelled unless needed
      if (j.status === "cancelled") return false;

      // Status filter
      if (statusFilter === "paid" && j.status !== "paid") return false;
      if (statusFilter === "pending" && j.status === "paid") return false;

      // Paper filter
      if (paperFilter !== "all" && j.paper_size !== paperFilter) return false;

      // Search term
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const client = (j.client_name || "").toLowerCase();
        const phone = (j.client_phone || "").toLowerCase();
        const file = (j.file_name || "").toLowerCase();
        const docType = (j.doc_type || "").toLowerCase();
        const id = (j.id || "").toLowerCase();
        const receiptNo = (j.receipt_number || "").toLowerCase();
        return client.includes(query) || phone.includes(query) || file.includes(query) || docType.includes(query) || id.includes(query) || receiptNo.includes(query);
      }

      return true;
    });
  }, [jobs, searchTerm, statusFilter, paperFilter]);

  const totalItems = filteredJobs.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const startIndex = (safeCurrentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalItems);
  const currentJobs = useMemo(() => {
    return filteredJobs.slice(startIndex, endIndex);
  }, [filteredJobs, startIndex, endIndex]);

  const fromItem = totalItems === 0 ? 0 : startIndex + 1;
  const toItem = endIndex;

  const getPageNumbers = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (safeCurrentPage <= 4) {
      return [1, 2, 3, 4, 5, "...", totalPages];
    }
    if (safeCurrentPage >= totalPages - 3) {
      return [1, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, "...", safeCurrentPage - 1, safeCurrentPage, safeCurrentPage + 1, "...", totalPages];
  };

  const handleJobCreated = (newJob: any) => {
    setJobs([newJob, ...jobs]);
    setCurrentPage(1);
    // Optional auto-open receipt after creating
    setReceiptModalJob(newJob);
  };

  const handlePaymentLogged = (updatedJob: any) => {
    setJobs(jobs.map(j => j.id === updatedJob.id ? updatedJob : j));
    setPaymentModalJob(null);
  };

  return (
    <div className="space-y-6">
      {/* Top Page Header */}
      <PageHeader 
        title={
          <div className="flex items-center gap-3">
            <span className="text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Print <span className="bg-gradient-to-r from-emerald-600 to-emerald-500 bg-clip-text text-transparent">Desk</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/60 shadow-xs">
              <Sparkles className="w-3.5 h-3.5" /> Front Operations
            </span>
          </div>
        } 
        subtitle={<span className="text-sm text-slate-500 font-medium">Walk-in clients, CAD plot outputs & project-linked print jobs</span>} 
        icon={Printer}
        className="pb-2"
        actions={
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setIsManageTypesOpen(true)}
              className="flex items-center gap-2 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-white/10 px-4 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-xs active:scale-[0.98]"
            >
              <SlidersHorizontal className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <span>Doc Types & Rates</span>
            </button>
            <button
              onClick={() => setIsNewJobOpen(true)}
              className="flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 active:scale-[0.98] text-white px-5 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-md shadow-emerald-500/25"
            >
              <Plus className="h-4 w-4" />
              <span>New Print Job</span>
            </button>
          </div>
        }
      />

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Today's Jobs */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 p-4 rounded-2xl shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Today&apos;s Jobs</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{stats.todayJobsCount}</p>
            <p className="text-[11px] font-medium text-slate-500 mt-0.5">Logged today</p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-100 dark:border-indigo-900/40">
            <Calendar className="w-5 h-5" />
          </div>
        </div>

        {/* Total Active Jobs */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 p-4 rounded-2xl shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Total Print Orders</p>
            <p className="text-2xl font-black text-slate-900 dark:text-white mt-1">{stats.totalJobsCount}</p>
            <p className="text-[11px] font-medium text-slate-500 mt-0.5">All-time print jobs</p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-100 dark:border-purple-900/40">
            <Printer className="w-5 h-5" />
          </div>
        </div>

        {/* Paid Revenue */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 p-4 rounded-2xl shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Paid Revenue</p>
            <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
              ₹{stats.paidRevenue.toLocaleString("en-IN")}
            </p>
            <p className="text-[11px] font-medium text-emerald-600/80 mt-0.5">Settled collections</p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center border border-emerald-100 dark:border-emerald-900/40">
            <Banknote className="w-5 h-5" />
          </div>
        </div>

        {/* Pending Invoices */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 p-4 rounded-2xl shadow-xs flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Pending Collection</p>
            <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-1">
              ₹{stats.pendingRevenue.toLocaleString("en-IN")}
            </p>
            <p className="text-[11px] font-medium text-amber-600/80 mt-0.5">Awaiting settlement</p>
          </div>
          <div className="w-11 h-11 rounded-2xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center border border-amber-100 dark:border-amber-900/40">
            <Clock className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Main Table Container */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 shadow-sm rounded-2xl overflow-hidden">
        
        {/* Search & Filter Toolbar */}
        <div className="p-4 border-b border-slate-100 dark:border-white/10 bg-slate-50/50 dark:bg-slate-800/30 flex flex-col sm:flex-row items-center justify-between gap-3">
          
          {/* Search Box */}
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by client, phone, or file..."
              value={searchTerm}
              onChange={e => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl text-xs font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 transition-all"
            />
          </div>

          {/* Quick Filters */}
          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            {/* Paper Size Filter */}
            <div className="w-36">
              <Select
                value={paperFilter}
                onValueChange={(val) => {
                  setPaperFilter(val);
                  setCurrentPage(1);
                }}
                buttonClassName="h-9 bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                <SelectItem value="all">All Sizes</SelectItem>
                <SelectItem value="A4">A4</SelectItem>
                <SelectItem value="A3">A3</SelectItem>
                <SelectItem value="A1">A1</SelectItem>
                <SelectItem value="A0">A0</SelectItem>
                <SelectItem value="Custom">Custom</SelectItem>
              </Select>
            </div>

            {/* Status Filter */}
            <div className="w-36">
              <Select
                value={statusFilter}
                onValueChange={(val) => {
                  setStatusFilter(val);
                  setCurrentPage(1);
                }}
                buttonClassName="h-9 bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300"
              >
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </Select>
            </div>
          </div>
        </div>

        {/* Table Body */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-slate-600 dark:text-slate-400">
            <thead className="text-[11px] text-slate-500 uppercase tracking-wider bg-slate-50/80 dark:bg-slate-800/50 border-b border-slate-200 dark:border-white/10">
              <tr>
                <th className="px-6 py-3.5 font-bold text-slate-600 dark:text-slate-300">
                  <div className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5 text-slate-400" /> Date & ID</div>
                </th>
                <th className="px-6 py-3.5 font-bold text-slate-600 dark:text-slate-300">
                  <div className="flex items-center gap-1.5"><User className="w-3.5 h-3.5 text-slate-400" /> Client</div>
                </th>
                <th className="px-6 py-3.5 font-bold text-slate-600 dark:text-slate-300">
                  <div className="flex items-center gap-1.5"><FileText className="w-3.5 h-3.5 text-slate-400" /> Document Specs</div>
                </th>
                <th className="px-6 py-3.5 font-bold text-slate-600 dark:text-slate-300">
                  <div className="flex items-center gap-1.5"><Copy className="w-3.5 h-3.5 text-slate-400" /> Copies</div>
                </th>
                <th className="px-6 py-3.5 font-bold text-slate-600 dark:text-slate-300">
                  <div className="flex items-center gap-1.5"><IndianRupee className="w-3.5 h-3.5 text-slate-400" /> Amount & Status</div>
                </th>
                <th className="px-6 py-3.5 font-bold text-slate-600 dark:text-slate-300 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-white/5">
              {currentJobs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-16 text-center text-slate-500 bg-slate-50/30 dark:bg-slate-900/30">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <div className="w-14 h-14 rounded-3xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 flex items-center justify-center border border-purple-200/60 shadow-xs">
                        <Printer className="w-7 h-7" />
                      </div>
                      <p className="text-base font-bold text-slate-800 dark:text-slate-200">No print jobs found</p>
                      <p className="text-xs text-slate-400 max-w-sm">
                        {searchTerm ? "No orders match your filter criteria." : "Create your first walk-in or project print order using the button above."}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : currentJobs.map((job) => {
                const isPaid = job.status === "paid";
                return (
                  <tr key={job.id} className="hover:bg-purple-50/40 dark:hover:bg-purple-950/20 transition-colors group">
                    
                    {/* ID & Date */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-bold text-slate-900 dark:text-white group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors flex items-center gap-1.5">
                        <span>#{job.receipt_number || job.id?.slice(0, 8)}</span>
                      </div>
                      <div className="text-xs text-slate-400 font-medium mt-0.5">
                        {job.created_at ? format(new Date(job.created_at), "MMM d, yyyy • h:mm a") : "N/A"}
                      </div>
                    </td>

                    {/* Client */}
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className={cn("w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs border shrink-0", getAvatarStyle(job.client_name))}>
                          {(job.client_name || "C").charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-white leading-tight">{job.client_name}</div>
                          {job.client_phone && (
                            <div className="text-xs text-slate-400 font-medium mt-0.5">{job.client_phone}</div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Document Specs */}
                    <td className="px-6 py-4">
                      <div className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate max-w-[220px]" title={job.file_name || "Walk-in Document"}>
                        {job.file_name || "Walk-in Document"}
                      </div>
                      <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                        {job.doc_type && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200/50">
                            {job.doc_type}
                          </span>
                        )}
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200/50">
                          {job.paper_size}
                        </span>
                        <span className={cn(
                          "text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border",
                          job.print_type === "color"
                            ? "bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border-rose-200/50"
                            : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200"
                        )}>
                          {job.print_type === "color" ? "Color" : "B&W"}
                        </span>
                      </div>
                    </td>

                    {/* Copies */}
                    <td className="px-6 py-4">
                      <span className="font-bold text-xs text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg border border-slate-200/80 dark:border-white/10">
                        {job.copies} {job.copies === 1 ? "Copy" : "Copies"}
                      </span>
                    </td>

                    {/* Amount & Status */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-bold text-slate-900 dark:text-white text-base">
                        ₹{Number(job.amount || 0).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                      </div>
                      <div className="mt-1">
                        {isPaid ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400 border border-emerald-200/80">
                            <CheckCircle2 className="w-3 h-3" /> Paid
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-400 border border-amber-200/80">
                            <Clock className="w-3 h-3" /> Pending
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {/* Collect Payment (if pending) */}
                        {!isPaid && (
                          <button
                            onClick={() => setPaymentModalJob(job)}
                            className="h-8 px-3 rounded-lg text-xs font-bold uppercase tracking-wider bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all active:scale-95 flex items-center justify-center gap-1.5"
                            title="Collect & record payment"
                          >
                            <Banknote className="w-3.5 h-3.5" />
                            Collect
                          </button>
                        )}

                        {/* View Receipt */}
                        <button 
                          onClick={() => setReceiptModalJob(job)} 
                          className="h-8 px-3 rounded-lg text-xs font-bold uppercase tracking-wider bg-purple-50 hover:bg-purple-100 text-purple-700 dark:bg-purple-950/50 dark:text-purple-300 border border-purple-200/60 transition-all active:scale-95 flex items-center justify-center gap-1.5"
                          title="View receipt"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Receipt
                        </button>
                      </div>
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        
        {/* Pagination Bar */}
        {filteredJobs.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-3.5 border-t border-slate-100 dark:border-white/10 bg-slate-50/60 dark:bg-slate-800/40 gap-3">
            <div className="text-xs text-slate-500 font-medium">
              Showing <span className="font-bold text-slate-900 dark:text-white">{fromItem}</span> to{" "}
              <span className="font-bold text-slate-900 dark:text-white">{toItem}</span> of{" "}
              <span className="font-bold text-slate-900 dark:text-white">{totalItems}</span> print jobs
            </div>
            
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={safeCurrentPage === 1}
                className="flex items-center justify-center w-8 h-8 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 shadow-2xs"
                title="Previous Page"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-1">
                {getPageNumbers().map((item, idx) => {
                  if (typeof item === "string") {
                    return (
                      <span key={`ellipsis-${idx}`} className="px-1.5 text-slate-400 text-xs font-semibold">
                        ...
                      </span>
                    );
                  }
                  const isActive = item === safeCurrentPage;
                  return (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setCurrentPage(item)}
                      className={cn(
                        "w-8 h-8 rounded-xl text-xs font-bold transition-all active:scale-95",
                        isActive
                          ? "bg-purple-600 text-white shadow-xs"
                          : "border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                      )}
                    >
                      {item}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={safeCurrentPage === totalPages}
                className="flex items-center justify-center w-8 h-8 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95 shadow-2xs"
                title="Next Page"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <NewPrintJobDialog
        isOpen={isNewJobOpen}
        onClose={() => setIsNewJobOpen(false)}
        projects={projects}
        urlPrefill={urlPrefill}
        initialDocTypes={docTypes}
        onSuccess={handleJobCreated}
      />

      {isManageTypesOpen && (
        <ManageDocTypesModal
          isOpen={isManageTypesOpen}
          onClose={() => setIsManageTypesOpen(false)}
          initialDocTypes={docTypes}
          onTypesUpdated={setDocTypes}
        />
      )}

      {receiptModalJob && (
        <ReceiptViewModal
          isOpen={!!receiptModalJob}
          onClose={() => setReceiptModalJob(null)}
          job={receiptModalJob}
        />
      )}

      {paymentModalJob && (
        <LogPaymentModal
          isOpen={!!paymentModalJob}
          onClose={() => setPaymentModalJob(null)}
          job={paymentModalJob}
          onSuccess={handlePaymentLogged}
        />
      )}
    </div>
  );
}
