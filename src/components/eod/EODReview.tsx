"use client";

import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { format, parseISO, startOfDay, endOfDay } from "date-fns";
import { 
  Search, 
  User, 
  Clock, 
  CheckCircle2,
  Calendar,
  ChevronRight,
  ChevronLeft,
  RefreshCw,
  ChevronDown,
  Smile
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PremiumDatePicker } from "@/components/ui/PremiumDatePicker";
import { updateEODReportAction } from "@/actions/eod.actions";
import { toast } from "sonner";

interface EODReport {
  id: string;
  user_id: string;
  employee_name: string;
  tasks_completed: string;
  hours_spent: number;
  blockers: string | null;
  date: string;
  created_at: string;
  department?: string;
  status?: string;
  adjusted_hours?: number;
  admin_note?: string;
}

interface EODReviewProps {
  reports: EODReport[];
  staff: any[];
  currentUserRole?: string;
  currentUserId?: string;
  hideFilters?: boolean;
}

export function EODReview({ reports, staff, currentUserRole, currentUserId, hideFilters }: EODReviewProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState("all");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  // Map staff to reports to get departments and ensure employee_name exists
  const reportsWithDept = useMemo(() => {
    return reports.map((report: any) => {
      const member = staff.find((s: any) => s.id === report.user_id);
      const employeeName = report.employee_name || 
        (report.profiles ? `${report.profiles.first_name} ${report.profiles.last_name}` : 
        (member ? `${member.first_name} ${member.last_name}` : "Unknown"));
        
      return {
        ...report,
        employee_name: employeeName,
        department: report.department || report.profiles?.department || member?.department || member?.role || "Member"
      };
    });
  }, [reports, staff]);

  // 1. Filter and Sort All Reports
  const filteredAndSortedReports = useMemo(() => {
    return reportsWithDept
      .filter((report: any) => {
        const matchesSearch = 
          (report.employee_name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
          (report.department || "").toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchesEmployee = employeeFilter === "all" || report.user_id === employeeFilter;
        
        let matchesDate = true;
        const reportDate = parseISO(report.date);
        if (fromDate) {
          matchesDate = matchesDate && reportDate >= startOfDay(parseISO(fromDate));
        }
        if (toDate) {
          matchesDate = matchesDate && reportDate <= endOfDay(parseISO(toDate));
        }

        return matchesSearch && matchesEmployee && matchesDate;
      })
      .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [reportsWithDept, searchTerm, employeeFilter, fromDate, toDate]);

  // 2. Pagination Logic
  const totalPages = Math.ceil(filteredAndSortedReports.length / itemsPerPage);
  
  const paginatedReports = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedReports.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredAndSortedReports, currentPage]);

  // Reset page when filters change
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, employeeFilter, fromDate, toDate]);

  // 3. Group by Date
  const groupedReports = useMemo(() => {
    const groups: Record<string, EODReport[]> = {};
    
    paginatedReports.forEach((report: any) => {
      const dateKey = format(parseISO(report.date), "EEEE, d MMMM yyyy").toUpperCase();
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(report);
    });
      
    return groups;
  }, [paginatedReports]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      setSearchTerm("");
      setEmployeeFilter("all");
      setFromDate("");
      setToDate("");
      setCurrentPage(1);
    }, 600);
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Premium Filter Bar - Exactly matching user image layout */}
      {!hideFilters && (
        <div className="relative z-50 flex flex-col md:flex-row items-end gap-4 glass-card p-6 border-white/5 shadow-2xl bg-[#0a0f1d]/40 backdrop-blur-xl">
          {/* Search */}
          <div className="flex-1 w-full space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block ml-1">Search</label>
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-indigo-500 transition-colors" />
            <input
              placeholder="Name or department..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full h-11 bg-slate-100 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-xl pl-11 pr-4 text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/40 transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600"
            />
          </div>
        </div>

        {/* Employee */}
        <div className="w-full md:w-48 space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block ml-1">Employee</label>
          <div className="relative group">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-indigo-500 transition-colors" />
            <select
              value={employeeFilter}
              onChange={(e) => setEmployeeFilter(e.target.value)}
              className="w-full h-11 bg-slate-100 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-xl pl-11 pr-10 text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/40 transition-all appearance-none cursor-pointer"
            >
              <option value="all">All Employees</option>
              {staff
                .filter((member: any) => !(member.first_name === "Admin" && member.last_name === "System"))
                .map((member: any) => (
                  <option key={member.id} value={member.id}>
                    {member.first_name} {member.last_name}
                  </option>
                ))}
            </select>
            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 pointer-events-none" />
          </div>
        </div>

        {/* From Date */}
        <div className="w-full md:w-56 space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block ml-1">From</label>
          <PremiumDatePicker 
            value={fromDate} 
            onChange={setFromDate} 
            className="h-11"
          />
        </div>

        {/* To Date */}
        <div className="w-full md:w-56 space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 block ml-1">To</label>
          <PremiumDatePicker 
            value={toDate} 
            onChange={setToDate}
            className="h-11"
          />
        </div>

        {/* Refresh Button */}
        <div className="w-full md:w-auto">
          <button
            onClick={handleRefresh}
            className="w-full md:w-36 h-11 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 font-semibold text-sm flex items-center justify-center gap-2 border border-indigo-500/20 transition-all active:scale-95 group shadow-lg shadow-indigo-500/5 font-[inherit]"
          >
            <RefreshCw className={cn("w-4 h-4 transition-transform duration-500", isRefreshing && "animate-spin")} />
            Refresh
          </button>
        </div>
      </div>
      )}

      {/* Date-wise Groups */}
      <div className="space-y-8">
        {Object.entries(groupedReports).map(([dateLabel, dateReports]) => (
          <div key={dateLabel} className="space-y-3">
            <div className="flex items-center gap-3 px-2 mb-4">
              <Calendar className="w-4 h-4 text-slate-400 dark:text-slate-500" />
              <h3 className="text-xs font-black tracking-widest text-slate-500 dark:text-slate-400">
                {dateLabel}
              </h3>
              <div className="h-px flex-1 bg-slate-200 dark:bg-white/5 ml-2" />
            </div>

            <div className="space-y-2">
              {dateReports.map((report) => (
                <ReportRow 
                  key={report.id} 
                  report={report} 
                  currentUserRole={currentUserRole}
                  currentUserId={currentUserId}
                />
              ))}
            </div>
          </div>
        ))}

        {Object.keys(groupedReports).length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 glass-card border-dashed border-2 border-white/10 m-2">
            <div className="w-20 h-20 rounded-full bg-slate-500/5 flex items-center justify-center mb-4">
              <CheckCircle2 className="w-10 h-10 text-slate-500/20" />
            </div>
            <p className="text-sm font-black uppercase tracking-widest text-slate-400">No reports found</p>
            <p className="text-xs text-slate-500 mt-1">Try adjusting your filters or search terms.</p>
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex flex-col sm:flex-row items-center justify-between border-t border-slate-200 dark:border-white/10 pt-6 mt-8 gap-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Showing <span className="font-bold text-indigo-600 dark:text-indigo-400">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="font-bold text-indigo-600 dark:text-indigo-400">{Math.min(currentPage * itemsPerPage, filteredAndSortedReports.length)}</span> of <span className="font-bold text-slate-900 dark:text-white">{filteredAndSortedReports.length}</span> results
            </p>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="flex items-center gap-1 px-3 py-1.5 text-sm font-semibold rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/10 hover:text-indigo-600 dark:hover:text-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
                Prev
              </button>
              
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  // Show max 5 pages around current page
                  let pageToShow = i + 1;
                  if (totalPages > 5) {
                    if (currentPage > 3 && currentPage < totalPages - 1) {
                      pageToShow = currentPage - 2 + i;
                    } else if (currentPage >= totalPages - 1) {
                      pageToShow = totalPages - 4 + i;
                    }
                  }
                  
                  return (
                    <button
                      key={pageToShow}
                      onClick={() => setCurrentPage(pageToShow)}
                      className={cn(
                        "w-8 h-8 flex items-center justify-center text-sm font-bold rounded-lg transition-all",
                        currentPage === pageToShow 
                          ? "bg-indigo-600 dark:bg-indigo-500 text-white shadow-md shadow-indigo-500/20" 
                          : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-indigo-600 dark:hover:text-indigo-400"
                      )}
                    >
                      {pageToShow}
                    </button>
                  );
                })}
              </div>

              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="flex items-center gap-1 px-3 py-1.5 text-sm font-semibold rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/10 hover:text-indigo-600 dark:hover:text-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Next
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ReportRow({ 
  report, 
  currentUserRole, 
  currentUserId 
}: { 
  report: EODReport,
  currentUserRole?: string,
  currentUserId?: string
}) {
  const [expanded, setExpanded] = useState(false);
  const [adjustedHours, setAdjustedHours] = useState(report.adjusted_hours?.toString() || (report.hours_spent ?? 0).toString());
  const [adminNote, setAdminNote] = useState(report.admin_note || "");
  const [isUpdating, setIsUpdating] = useState(false);

  React.useEffect(() => {
    setAdjustedHours(report.adjusted_hours?.toString() || (report.hours_spent ?? 0).toString());
    setAdminNote(report.admin_note || "");
  }, [report.adjusted_hours, report.hours_spent, report.admin_note]);

  const tasksCount = (report.tasks_completed || '').split('\n').filter((t: any) => t.trim().length > 0).length;

  const handleApprove = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIsUpdating(true);
    
    const parsedHours = parseFloat(adjustedHours);

    if (!/^\d+(\.\d{1,2})?$/.test(adjustedHours.toString())) {
      toast.error('Office hours can have at most 2 decimal places');
      setIsUpdating(false);
      return;
    }

    if (parsedHours > 12) {
      toast.error('Office hours cannot exceed 12');
      setIsUpdating(false);
      return;
    }
    
    const result = await updateEODReportAction(report.id, {
      status: 'approved',
      adjusted_hours: isNaN(parsedHours) ? report.hours_spent : parsedHours,
      admin_note: adminNote
    });
    
    if (result.success) {
      toast.success('Report approved successfully');
      setExpanded(false);
    } else {
      toast.error(result.error || 'Failed to approve report');
    }
    setIsUpdating(false);
  };

  const handleUpdate = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setIsUpdating(true);
    
    const parsedHours = parseFloat(adjustedHours);

    if (!/^\d+(\.\d{1,2})?$/.test(adjustedHours.toString())) {
      toast.error('Office hours can have at most 2 decimal places');
      setIsUpdating(false);
      return;
    }

    if (parsedHours > 12) {
      toast.error('Office hours cannot exceed 12');
      setIsUpdating(false);
      return;
    }
    
    const result = await updateEODReportAction(report.id, {
      adjusted_hours: isNaN(parsedHours) ? report.hours_spent : parsedHours,
      admin_note: adminNote
    });
    
    if (result.success) {
      toast.success('Hours updated successfully');
    } else {
      toast.error(result.error || 'Failed to update hours');
    }
    setIsUpdating(false);
  };

  return (
    <div className="border bg-white dark:bg-[#0f1117] border-slate-200 dark:border-white/10 hover:border-indigo-500/30 dark:hover:border-white/20 hover:shadow-md dark:hover:bg-[#161821] transition-all overflow-hidden group rounded-xl">
      <div 
        className="flex flex-col md:flex-row items-start md:items-center justify-between p-4 cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Left Side: Avatar & Info */}
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-indigo-50 dark:bg-gradient-to-br dark:from-indigo-500/20 dark:to-purple-500/20 flex items-center justify-center border border-indigo-100 dark:border-indigo-500/30 text-indigo-600 dark:text-indigo-300 font-bold dark:shadow-inner">
            {report.employee_name.charAt(0)}
          </div>
          <div>
            <h4 className="font-medium text-slate-800 dark:text-[#f8fafc] text-sm">
              {report.employee_name}
            </h4>
            <div className="text-[10px] text-slate-500 dark:text-slate-400 font-semibold tracking-widest uppercase mt-0.5">
              {report.department}
            </div>
          </div>
        </div>

        {/* Right Side: Stats & Status — fixed-width columns */}
        <div className="flex items-center gap-4 mt-4 md:mt-0">
          <div className="w-28 flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400/90 text-sm font-medium">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{tasksCount} completed</span>
          </div>
          <div className="w-28 flex items-center gap-1.5 text-slate-600 dark:text-slate-300/90 text-sm font-medium">
            <Clock className="w-4 h-4 shrink-0" />
            <span>{report.adjusted_hours || report.hours_spent || 0}h logged</span>
          </div>

          <div className="w-28 flex justify-center">
            {report.status === 'approved' ? (
              <button className="w-full px-3 py-1.5 rounded-full border border-emerald-200 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px] tracking-widest font-bold flex items-center justify-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                APPROVED
              </button>
            ) : (
              <button className="w-full px-3 py-1.5 rounded-full border border-indigo-200 dark:border-indigo-500/20 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 text-[10px] tracking-widest font-bold flex items-center justify-center gap-1.5">
                <Smile className="w-3.5 h-3.5" />
                GOOD
              </button>
            )}
          </div>

          <ChevronDown className={cn("w-4 h-4 text-slate-400 dark:text-slate-500 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition-transform", expanded && "rotate-180")} />
        </div>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-[#0a0c10] overflow-hidden relative"
          >
            <div className="p-6 space-y-6 relative z-10">
              {/* Report Contents */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div>
                  <h5 className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400/80 mb-3">TASKS COMPLETED</h5>
                  <div className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                    {(report.tasks_completed || '').split(/!\[.*?\]\((.*?)\)/).map((part: string, index: number) => {
                      if (index % 2 === 1) {
                        return (
                          <div key={index} className="my-4">
                            <a href={part} target="_blank" rel="noopener noreferrer">
                              <img src={part} alt="Field Photo Attachment" className="max-w-full h-auto rounded-xl border border-slate-200 dark:border-white/10 shadow-sm object-cover max-h-64 hover:opacity-90 transition-opacity" />
                            </a>
                          </div>
                        );
                      }
                      return <span key={index}>{part}</span>;
                    })}
                  </div>
                </div>

                <div>
                  <h5 className="text-[10px] font-black uppercase tracking-widest text-rose-600 dark:text-rose-400/80 mb-3">BLOCKERS</h5>
                  {report.blockers ? (
                    <div className="p-4 rounded-xl bg-rose-50 dark:bg-rose-500/5 border border-rose-100 dark:border-rose-500/10">
                      <p className="text-sm text-rose-700 dark:text-rose-400/90 leading-relaxed">
                        {report.blockers}
                      </p>
                    </div>
                  ) : (
                    <div className="p-4 rounded-xl border border-slate-200 dark:border-white/5 bg-white dark:bg-white/[0.02]">
                      <p className="text-sm text-slate-500 dark:text-slate-500 leading-relaxed italic">
                        No blockers reported.
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Admin Actions */}
              <div className="bg-white dark:bg-[#13151c] border border-slate-200 dark:border-white/5 rounded-xl p-3 md:p-4 mt-3 relative overflow-hidden shadow-sm dark:shadow-none">
                <div className="absolute inset-0 bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-500/5 dark:to-purple-500/5 pointer-events-none" />
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end relative z-10">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Adjusted Hours</label>
                    <input 
                      type="number" 
                      value={adjustedHours}
                      onChange={(e) => setAdjustedHours(e.target.value)}
                      className="w-full h-9 bg-white dark:bg-[#0f1117] border border-slate-200 dark:border-white/10 rounded-lg px-2.5 text-sm text-slate-900 dark:text-slate-200 focus:border-indigo-500 dark:focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500 dark:focus:ring-indigo-500/50 outline-none transition-all dark:shadow-inner"
                    />
                  </div>
                  
                  <div className="space-y-1.5 md:col-span-2">
                    <label className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Admin Note</label>
                    <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
                      <input 
                        type="text"
                        value={adminNote}
                        onChange={(e) => setAdminNote(e.target.value)}
                        placeholder="Add note..."
                        className="flex-1 h-9 bg-white dark:bg-[#0f1117] border border-slate-200 dark:border-white/10 rounded-lg px-2.5 text-sm text-slate-900 dark:text-slate-200 focus:border-indigo-500 dark:focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500 dark:focus:ring-indigo-500/50 outline-none transition-all placeholder:text-slate-400 dark:placeholder:text-slate-600 dark:shadow-inner"
                      />
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={handleApprove}
                          disabled={isUpdating || report.status === 'approved' || (currentUserRole === 'hr' && report.user_id === currentUserId)}
                          title={currentUserRole === 'hr' && report.user_id === currentUserId ? "You cannot approve your own EOD" : ""}
                          className="h-9 px-4 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold border border-emerald-200 dark:border-emerald-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap">
                          {isUpdating ? 'Saving...' : report.status === 'approved' ? 'Approved' : 'Approve'}
                        </button>
                        <button 
                          onClick={handleUpdate}
                          disabled={isUpdating || currentUserRole === 'hr'}
                          title={currentUserRole === 'hr' ? "Only Admins can edit EOD hours" : ""}
                          className="h-9 px-4 rounded-lg bg-indigo-600 dark:bg-gradient-to-r dark:from-indigo-600 dark:to-violet-600 hover:bg-indigo-700 dark:hover:from-indigo-500 dark:hover:to-violet-500 text-white text-xs font-bold shadow-md dark:shadow-[0_0_15px_rgba(79,70,229,0.3)] dark:hover:shadow-[0_0_20px_rgba(79,70,229,0.4)] transition-all disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap">
                          {isUpdating ? 'Updating...' : 'Update Hours'}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

