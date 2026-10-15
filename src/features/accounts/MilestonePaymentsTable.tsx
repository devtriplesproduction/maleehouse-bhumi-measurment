'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  Target,
  Calendar,
  Pause,
  CheckCircle2,
  Clock,
  Lock,
  Unlock,
  Building,
  Bell,
  ChevronLeft,
  ChevronRight,
  FilePlus,
  FileText
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { PremiumDatePicker } from '@/components/ui/PremiumDatePicker';
import { LogPaymentModal } from './LogPaymentModal';
import {
  updateMilestoneStatusAction,
  rescheduleMilestoneAction,
  freezeProjectAction,
  unfreezeProjectAction
} from '@/actions/finance.actions';
import { requestDispatchOverrideAction } from '@/actions/workflow.actions';
import { useUserContext } from '@/providers/UserProvider';

export interface MilestonePayment {
  id: string;
  project_id: string;
  title: string;
  description?: string;
  amount: number;
  due_date: string | null;
  linked_stage?: string | null;
  is_activation_gate: boolean;
  status: 'pending' | 'paid' | 'hold' | 'payment_verification_pending';
  reschedule_reason?: string | null;
  created_at: string;
  projects?: {
    name: string;
    client_name: string;
    status: string;
    is_frozen: boolean;
    dispatch_override_requested: boolean;
    dispatch_override_approved: boolean;
  } | null;
  invoices?: {
    id: string;
    status: string;
    created_at: string;
    amount: number;
    due_date: string | null;
    payments?: { status: string }[];
  }[];
}

const getActiveInvoice = (m: MilestonePayment) => {
  if (!m.invoices || m.invoices.length === 0) return null;
  return m.invoices.find((inv: any) => 
    inv.status !== 'cancelled' && 
    inv.status !== 'rejected'
  ) || null;
};

interface MilestonePaymentsTableProps {
  milestones: MilestonePayment[];
  onRefresh: () => void;
  searchQuery: string;
}

const statusConfig: Record<string, { label: string; className: string; icon: any }> = {
  pending: { label: 'Pending', className: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20', icon: Clock },
  paid: { label: 'Paid & Clear', className: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20', icon: CheckCircle2 },
  hold: { label: 'Payment Hold', className: 'bg-rose-500/10 text-rose-500 border-rose-500/20', icon: Pause },
  reminder: { label: 'Reminder', className: 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20', icon: Bell },
  payment_verification_pending: { label: 'Verification Pending', className: 'bg-blue-500/10 text-blue-500 border-blue-500/20', icon: Clock },
  invoiced: { label: 'Invoiced', className: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20', icon: FileText },
};

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
};

const getFormattedDateWithDays = (dueDateStr: string | null) => {
  if (!dueDateStr) return '';
  const date = new Date(dueDateStr);
  const days = differenceInDays(date, new Date());
  const formatted = format(date, 'MMM d');
  if (days < 0) {
    return `${formatted} (${Math.abs(days)}d ago)`;
  }
  return `${formatted} (${days}d)`;
};

const getDisplayStatus = (m: MilestonePayment) => {
  if (m.status === 'pending' && m.due_date) {
    const days = differenceInDays(new Date(m.due_date), new Date());
    if (days >= 0 && days <= 3) {
      return 'reminder';
    }
  }
  return m.status;
};

export function MilestonePaymentsTable({ milestones, onRefresh, searchQuery }: MilestonePaymentsTableProps) {
  const [mounted, setMounted] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [overriding, setOverriding] = useState<string | null>(null);
  const [overrideRequests, setOverrideRequests] = useState<Record<string, boolean>>({});

  const { role } = useUserContext();

  useEffect(() => {
    setMounted(true);
    setIsAdmin(role === "admin");
  }, [role]);

  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'upcoming' | 'overdue' | 'hold' | 'paid'>('upcoming');

  // Modals state
  const [rescheduleMilestone, setRescheduleMilestone] = useState<MilestonePayment | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<string>('');
  const [rescheduleReason, setRescheduleReason] = useState<string>('');
  const [submittingReschedule, setSubmittingReschedule] = useState(false);

  const [holdProjectTarget, setHoldProjectTarget] = useState<{ id: string; name: string; isFrozen: boolean } | null>(null);
  const [holdReason, setHoldReason] = useState('');
  const [submittingHold, setSubmittingHold] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);


  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [selectedPaymentMilestone, setSelectedPaymentMilestone] = useState<MilestonePayment | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [filterStatus, searchQuery]);

  // Filters and Sorting logic
  const filtered = milestones
    .filter((m: any) => {
      const projName = m.projects?.name || '';
      const clientName = m.projects?.client_name || '';
      const title = m.title || '';

      const matchesSearch =
        projName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        title.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      const days = m.due_date ? differenceInDays(new Date(m.due_date), new Date()) : 999;

      if (filterStatus === 'pending') return m.status === 'pending' || m.status === 'payment_verification_pending' || m.status === 'invoiced';
      if (filterStatus === 'paid') return m.status === 'paid';
      if (filterStatus === 'hold') return m.status === 'hold';
      if (filterStatus === 'overdue') return m.status === 'pending' && m.due_date && days < 0;
      if (filterStatus === 'upcoming') return m.status === 'pending' || m.status === 'payment_verification_pending' || m.status === 'invoiced';

      return true;
    })
    .sort((a: any, b: any) => {
      // 1. Paid milestones go to bottom
      if (a.status === 'paid' && b.status !== 'paid') return 1;
      if (a.status !== 'paid' && b.status === 'paid') return -1;

      // 2. Due date existence
      if (a.due_date && !b.due_date) return -1;
      if (!a.due_date && b.due_date) return 1;

      // 3. Chronological sorting (closest/upcoming first)
      if (a.due_date && b.due_date) {
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      }

      // 4. Fallback to creation date
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });

  const totalItems = filtered.length;
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedItems = filtered.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  // Action handlers
  const handleRequestOverride = async (milestone: MilestonePayment) => {
    if (!milestone.project_id) return;
    setOverriding(milestone.id);
    try {
      const res = await requestDispatchOverrideAction(milestone.project_id);
      if (res.success) {
        toast.success("Admin override requested successfully!");
        setOverrideRequests(prev => ({ ...prev, [milestone.id]: true }));
      } else {
        toast.error(res.error || "Failed to request override.");
      }
    } catch {
      toast.error("Unexpected error occurred.");
    } finally {
      setOverriding(null);
    }
  };



  const handleHoldPayment = async (m: MilestonePayment) => {
    try {
      const newStatus = m.status === 'hold' ? 'pending' : 'hold';
      const comment = newStatus === 'hold' ? 'Payment placed on hold.' : 'Payment hold released.';
      const res = await updateMilestoneStatusAction(m.id, newStatus, comment);
      if (res?.success) {
        toast.success(newStatus === 'hold' ? 'Payment placed on hold.' : 'Payment released to pending.');
        onRefresh();
      } else {
        toast.error(res?.error || 'Failed to update payment status.');
      }
    } catch {
      toast.error('Unexpected error updating payment status.');
    }
  };

  const submitReschedule = async () => {
    if (!rescheduleMilestone) return;
    if (!rescheduleDate) {
      toast.error('Please select a new due date.');
      return;
    }
    if (!rescheduleReason.trim()) {
      toast.error('Please enter a reason for rescheduling.');
      return;
    }

    try {
      setSubmittingReschedule(true);
      const res = await rescheduleMilestoneAction(rescheduleMilestone.id, rescheduleDate, rescheduleReason);
      if (res?.success) {
        toast.success('Milestone rescheduled successfully.');
        setRescheduleMilestone(null);
        setRescheduleDate('');
        setRescheduleReason('');
        onRefresh();
      } else {
        toast.error(res?.error || 'Failed to reschedule.');
      }
    } catch {
      toast.error('Unexpected error rescheduling milestone.');
    } finally {
      setSubmittingReschedule(false);
    }
  };

  const submitHoldProject = async () => {
    if (!holdProjectTarget) return;
    if (!holdReason.trim()) {
      toast.error('Please enter a comment/reason.');
      return;
    }

    try {
      setSubmittingHold(true);
      if (holdProjectTarget.isFrozen) {
        // Resume project
        const res = await unfreezeProjectAction(holdProjectTarget.id, holdReason);
        if (res?.success) {
          toast.success('Project resumed successfully.');
          setHoldProjectTarget(null);
          setHoldReason('');
          onRefresh();
        } else {
          toast.error(res?.error || 'Failed to resume project.');
        }
      } else {
        // Freeze project
        const res = await freezeProjectAction(holdProjectTarget.id, 'financial_hold', holdReason);
        if (res?.success) {
          toast.success('Project put on hold.');
          setHoldProjectTarget(null);
          setHoldReason('');
          onRefresh();
        } else {
          toast.error(res?.error || 'Failed to hold project.');
        }
      }
    } catch {
      toast.error('Unexpected error modifying project hold status.');
    } finally {
      setSubmittingHold(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 items-stretch sm:items-center justify-between border-b border-slate-200/60 dark:border-white/5 pb-4">
        {/* Navigation Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100/80 dark:bg-white/5 rounded-xl border border-slate-200/20 dark:border-white/5 self-start">
          <button
            onClick={() => setFilterStatus('upcoming')}
            className={cn(
              "px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all",
              filterStatus === 'upcoming'
                ? "bg-white dark:bg-white/10 text-indigo-600 dark:text-white shadow-sm"
                : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            )}
          >
            New milestones
          </button>
          <button
            onClick={() => setFilterStatus('all')}
            className={cn(
              "px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all",
              filterStatus === 'all'
                ? "bg-white dark:bg-white/10 text-indigo-600 dark:text-white shadow-sm"
                : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            )}
          >
            All milestones
          </button>
          <button
            onClick={() => setFilterStatus('overdue')}
            className={cn(
              "px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all",
              filterStatus === 'overdue'
                ? "bg-white dark:bg-white/10 text-rose-600 dark:text-white shadow-sm"
                : "text-slate-400 hover:text-rose-600 dark:hover:text-slate-200"
            )}
          >
            Overdue ({milestones.filter((m: any) => m.status === 'pending' && m.due_date && differenceInDays(new Date(m.due_date), new Date()) < 0).length})
          </button>
          <button
            onClick={() => setFilterStatus('hold')}
            className={cn(
              "px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all",
              filterStatus === 'hold'
                ? "bg-white dark:bg-white/10 text-indigo-600 dark:text-white shadow-sm"
                : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            )}
          >
            Hold ({milestones.filter((m: any) => m.status === 'hold').length})
          </button>
          <button
            onClick={() => setFilterStatus('paid')}
            className={cn(
              "px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all",
              filterStatus === 'paid'
                ? "bg-white dark:bg-white/10 text-emerald-600 dark:text-white shadow-sm"
                : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            )}
          >
            Paid ({milestones.filter((m: any) => m.status === 'paid').length})
          </button>
        </div>

      </div>

      {/* Main Content */}
      {filtered.length === 0 ? (
        <div className="glass-card py-16 text-center text-slate-400 italic text-sm font-medium">
          <div className="flex flex-col items-center gap-3 opacity-40">
            <Target className="w-8 h-8" />
            <span>No milestone payments found.</span>
          </div>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {paginatedItems.map((m) => {
              const displayStatus = getDisplayStatus(m);
              const StatusIcon = statusConfig[displayStatus]?.icon || Clock;
              const isProjectFrozen = m.projects?.is_frozen || m.projects?.status === 'on_hold';

              return (
                <div
                  key={m.id}
                  className={cn(
                    "relative rounded-2xl border bg-white dark:bg-[#0f121b] pt-[18px] pb-[18px] pl-3 pr-4 md:py-[15px] md:pl-4 md:pr-6 hover:shadow-md hover:border-slate-300 dark:hover:border-white/10 transition-all duration-300 flex flex-col md:flex-row md:items-center gap-4 md:gap-0 group",
                    isProjectFrozen
                      ? "border-rose-200 dark:border-rose-500/20 shadow-indigo-500/5"
                      : "border-slate-200/60 dark:border-white/5 shadow-sm",
                    activeMenuId === m.id ? "z-50" : "z-10"
                  )}
                >
                  {/* Section 1: Icon + Project, Client, & Title */}
                  <div className="flex items-start gap-3 flex-1 min-w-0 md:pr-4 py-0.5">
                    {/* Tinted Icon Box */}
                    <div className="min-w-0 flex-1 flex flex-col justify-center">
                      <div className="flex flex-col justify-center">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <span className="text-[15px] font-semibold text-slate-900 dark:text-white leading-tight truncate" title={m.projects?.name || 'Standalone Assignment'}>
                            {m.projects?.name || 'Standalone Assignment'}
                          </span>
                          {m.title && (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/20 truncate max-w-[260px]" title={m.title}>
                              <Target className="w-3 h-3 flex-shrink-0" />
                              <span className="truncate">{m.title}</span>
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400 font-medium">
                          <span className="flex items-center gap-1.5">
                            <Building className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 flex-shrink-0" />
                            <span className="truncate max-w-[120px] sm:max-w-[180px]">{m.projects?.client_name || 'Direct Client'}</span>
                          </span>
                          {m.due_date && (
                            <span className="flex items-center gap-1.5 whitespace-nowrap">
                              <Calendar className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 flex-shrink-0" />
                              <span>{getFormattedDateWithDays(m.due_date)}</span>
                            </span>
                          )}
                          {m.is_activation_gate && (
                            <span className="text-[9px] font-semibold bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-500/20 px-1.5 py-0.5 rounded flex-shrink-0 whitespace-nowrap">
                              Activation gate
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Section 2: Price & Status */}
                  <div className="w-full md:w-auto flex-shrink-0 flex items-center gap-6 md:gap-8 md:border-l border-slate-100 dark:border-white/5 md:pl-6 md:pr-6">

                    {/* Price / Amount */}
                    <div className="flex flex-col min-w-[80px]">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-0.5">Amount</span>
                      <span className="text-sm font-semibold text-slate-800 dark:text-slate-200 nums whitespace-nowrap">
                        {formatCurrency(m.amount)}
                      </span>
                    </div>

                    {/* Status */}
                    <div className="flex flex-col min-w-[90px]">
                      <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-0.5">Status</span>
                      <span className={cn(
                        "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium border shadow-sm whitespace-nowrap w-fit",
                        statusConfig[displayStatus]?.className
                      )}>
                        <StatusIcon className="w-3.5 h-3.5 flex-shrink-0" />
                        {statusConfig[displayStatus]?.label}
                      </span>
                    </div>
                  </div>

                  {/* Section 3: Buttons */}
                  <div className="w-full md:w-auto flex-shrink-0 flex items-center gap-2 md:justify-end md:border-l border-slate-100 dark:border-white/5 md:pl-6">
                    {m.status !== 'paid' ? (
                      <>
                        {m.status === 'payment_verification_pending' ? (
                          <span className="h-8 px-3 rounded-lg text-xs font-semibold bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-500 shadow-sm flex items-center justify-center gap-1.5 whitespace-nowrap">
                            <Clock className="w-3.5 h-3.5" />
                            Awaiting Verif.
                          </span>
                        ) : (
                          <>
                            {!isAdmin && (!m.projects?.status || !['ops_active', 'completed', 'archived', 'on_hold', 'cancelled'].includes(m.projects.status)) && (
                              m.projects?.dispatch_override_approved ? (
                                <button
                                  type="button"
                                  disabled
                                  className="h-8 px-3 rounded-lg text-xs font-semibold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-500 cursor-not-allowed flex items-center justify-center gap-1.5 whitespace-nowrap"
                                >
                                  <Lock className="w-3.5 h-3.5" />
                                  Override Approved
                                </button>
                              ) : (m.projects?.dispatch_override_requested || overrideRequests[m.id]) ? (
                                <button
                                  type="button"
                                  disabled
                                  className="h-8 px-3 rounded-lg text-xs font-semibold bg-slate-200 dark:bg-slate-800 text-slate-500 cursor-not-allowed flex items-center justify-center gap-1.5 whitespace-nowrap"
                                >
                                  <Lock className="w-3.5 h-3.5" />
                                  Override Requested
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRequestOverride(m);
                                  }}
                                  disabled={overriding === m.id || isProjectFrozen}
                                  className="h-8 px-3 rounded-lg text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all active:scale-95 flex items-center justify-center gap-1.5 whitespace-nowrap disabled:opacity-60"
                                >
                                  {overriding === m.id ? (
                                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                  ) : (
                                    <Lock className="w-3.5 h-3.5" />
                                  )}
                                  Request Override
                                </button>
                              )
                            )}
                          </>
                        )}

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPaymentMilestone(m);
                            setPaymentModalOpen(true);
                          }}
                          disabled={isProjectFrozen}
                          title={isProjectFrozen ? "Project is frozen. Resume project to log payment." : "Log payment for milestone"}
                          className="h-8 px-3 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm transition-all active:scale-95 flex items-center justify-center gap-1.5 whitespace-nowrap disabled:opacity-50"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Log Payment
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setRescheduleMilestone(m);
                            setRescheduleDate(m.due_date ? m.due_date.split('T')[0] : '');
                          }}
                          className="h-8 px-3 rounded-lg text-xs font-semibold border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 shadow-sm transition-all active:scale-95 flex items-center justify-center gap-1.5 whitespace-nowrap"
                        >
                          <Calendar className="w-3.5 h-3.5" />
                          Reschedule
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setHoldProjectTarget({
                              id: m.project_id,
                              name: m.projects?.name || 'Project',
                              isFrozen: !!isProjectFrozen
                            });
                          }}
                          title={isProjectFrozen ? "Resume Project Operations" : "Hold Project Operations"}
                          className={cn(
                            "h-8 w-8 rounded-lg border shadow-sm transition-all active:scale-95 flex items-center justify-center flex-shrink-0",
                            isProjectFrozen
                              ? "border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20"
                              : "border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/10"
                          )}
                        >
                          {isProjectFrozen ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                        </button>
                      </>
                    ) : (
                      <div className="flex items-center justify-end w-full min-h-[32px]">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setHoldProjectTarget({
                              id: m.project_id,
                              name: m.projects?.name || 'Project',
                              isFrozen: !!isProjectFrozen
                            });
                          }}
                          title={isProjectFrozen ? "Resume Project Operations" : "Hold Project Operations"}
                          className={cn(
                            "h-8 w-8 rounded-lg border shadow-sm transition-all active:scale-95 flex items-center justify-center flex-shrink-0",
                            isProjectFrozen
                              ? "border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20"
                              : "border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/10"
                          )}
                        >
                          {isProjectFrozen ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-200/60 dark:border-white/5 pt-5 mt-4">
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Showing <span className="font-semibold text-slate-700 dark:text-slate-300">{startIndex + 1}</span> to{" "}
                <span className="font-semibold text-slate-700 dark:text-slate-300">
                  {Math.min(startIndex + ITEMS_PER_PAGE, totalItems)}
                </span>{" "}
                of <span className="font-semibold text-slate-700 dark:text-slate-300">{totalItems}</span> milestones
              </p>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="p-2 rounded-lg border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 disabled:opacity-50 disabled:pointer-events-none transition-all active:scale-95"
                  title="Previous Page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                  if (
                    page === 1 ||
                    page === totalPages ||
                    Math.abs(page - currentPage) <= 1
                  ) {
                    return (
                      <button
                        key={page}
                        type="button"
                        onClick={() => setCurrentPage(page)}
                        className={cn(
                          "w-8 h-8 rounded-lg text-xs font-semibold transition-all active:scale-95",
                          currentPage === page
                            ? "bg-indigo-600 text-white shadow-sm"
                            : "border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5"
                        )}
                      >
                        {page}
                      </button>
                    );
                  }

                  if (
                    (page === 2 && currentPage > 3) ||
                    (page === totalPages - 1 && currentPage < totalPages - 2)
                  ) {
                    return (
                      <span
                        key={page}
                        className="w-8 text-center text-xs text-slate-400 dark:text-slate-500 font-medium select-none"
                      >
                        ...
                      </span>
                    );
                  }

                  return null;
                })}

                <button
                  type="button"
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="p-2 rounded-lg border border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 disabled:opacity-50 disabled:pointer-events-none transition-all active:scale-95"
                  title="Next Page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </>
      )
      }

      {/* Reschedule Modal */}
      {mounted && typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {rescheduleMilestone && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setRescheduleMilestone(null)}
                className="fixed inset-0 bg-slate-900/50 dark:bg-black/70 backdrop-blur-md"
              />
              {/* Modal Body */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                className="relative w-full max-w-md bg-white dark:bg-[#0f121b] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl p-6 overflow-hidden z-[151]"
              >
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Reschedule Milestone Payment</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
                  Updating due date for: <span className="font-semibold text-slate-800 dark:text-slate-200">&quot;{rescheduleMilestone.title}&quot;</span>
                </p>

                <div className="space-y-4 mb-6">
                  <div>
                    <label className="text-xs font-semibold text-slate-500 mb-1.5 block">New due date</label>
                    <PremiumDatePicker
                      value={rescheduleDate}
                      onChange={(dateStr) => setRescheduleDate(dateStr)}
                      side="right"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-slate-500 mb-1.5 block">Reason for rescheduling</label>
                    <textarea
                      rows={3}
                      value={rescheduleReason}
                      onChange={(e) => setRescheduleReason(e.target.value)}
                      placeholder="Enter reason (e.g. client requested extension, milestone delay)"
                      className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg p-3 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 outline-none resize-none"
                    />
                  </div>
                </div>

                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => setRescheduleMilestone(null)}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-white/5 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submitReschedule}
                    disabled={submittingReschedule}
                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1.5"
                  >
                    {submittingReschedule ? (
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : 'Confirm Reschedule'}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* Hold/Resume Project Confirmation Modal */}
      {mounted && typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {holdProjectTarget && (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setHoldProjectTarget(null)}
                className="fixed inset-0 bg-slate-900/50 dark:bg-black/70 backdrop-blur-md"
              />
              {/* Modal Body */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 15 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 15 }}
                className="relative w-full max-w-md bg-white dark:bg-[#0f121b] border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl p-6 overflow-hidden z-[151]"
              >
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">
                  {holdProjectTarget.isFrozen ? 'Resume Project Operations' : 'Hold Project Operations'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-6">
                  Are you sure you want to {holdProjectTarget.isFrozen ? 'resume' : 'hold'} operations for the project:{' '}
                  <span className="font-semibold text-slate-800 dark:text-slate-200">&quot;{holdProjectTarget.name}&quot;</span>?
                </p>

                <div className="mb-6">
                  <label className="text-xs font-semibold text-slate-500 mb-1.5 block">
                    Comment / reason
                  </label>
                  <textarea
                    rows={3}
                    value={holdReason}
                    onChange={(e) => setHoldReason(e.target.value)}
                    placeholder={
                      holdProjectTarget.isFrozen
                        ? "Describe reason for resuming project operations"
                        : "Describe reason for putting the project on hold"
                    }
                    className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg p-3 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 outline-none resize-none"
                  />
                </div>

                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => setHoldProjectTarget(null)}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-white/5 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={submitHoldProject}
                    disabled={submittingHold}
                    className={cn(
                      "px-5 py-2 rounded-xl text-white text-xs font-bold transition-all disabled:opacity-50 flex items-center gap-1.5",
                      holdProjectTarget.isFrozen ? "bg-indigo-600 hover:bg-indigo-500" : "bg-indigo-600 hover:bg-rose-500"
                    )}
                  >
                    {submittingHold ? (
                      <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : holdProjectTarget.isFrozen ? 'Confirm Resume' : 'Confirm Hold'}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}


      <LogPaymentModal
        isOpen={paymentModalOpen}
        onClose={() => {
          setPaymentModalOpen(false);
          setSelectedPaymentMilestone(null);
        }}
        projectId={selectedPaymentMilestone?.project_id || ''}
        milestoneTitle={selectedPaymentMilestone?.title || ''}
        milestoneId={selectedPaymentMilestone?.id}
        amount={selectedPaymentMilestone?.amount || 0}
        onSuccess={() => {
          setPaymentModalOpen(false);
          setSelectedPaymentMilestone(null);
          onRefresh();
        }}
      />
    </div>
  );
}
