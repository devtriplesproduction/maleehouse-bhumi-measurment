'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { cn } from '@/lib/utils';
import { Clock, ChevronRight, CheckCircle2, Send, Loader2, Calendar, X } from 'lucide-react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { finalizeRequirementsAction, recordFollowUpAction } from '../actions';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

interface Lead {
  id: string;
  name: string;
  client_name: string;
  client_contact?: string;
  client_address?: string;
  site_coordinates?: string;
  services?: string[];
  survey_requirements?: string;
  target_completion_date?: string;
  requirement_checklist?: any;
  status: string;
  created_at: string;
  follow_up_date?: string | null;
}

interface LeadPipelineProps {
  leads: Lead[];
}

const COLUMNS = [
  { id: "lead_created", title: "New Leads", color: "bg-indigo-500", border: "border-indigo-500/20", bgLight: "bg-indigo-500/5", text: "text-indigo-600 dark:text-indigo-400" },
  { id: "requirement_gathering", title: "Follow Up", color: "bg-blue-500", border: "border-blue-500/20", bgLight: "bg-blue-500/5", text: "text-blue-600 dark:text-blue-400" },
  { id: "payment_pending", title: "Send to Account", color: "bg-emerald-500", border: "border-emerald-500/20", bgLight: "bg-emerald-500/5", text: "text-emerald-600 dark:text-emerald-400" },
];

export function LeadPipeline({ leads }: LeadPipelineProps) {
  const router = useRouter();
  const [sendingLeadId, setSendingLeadId] = useState<string | null>(null);
  const [followUpLoadingId, setFollowUpLoadingId] = useState<string | null>(null);

  const [localLeads, setLocalLeads] = useState(leads);
  useEffect(() => setLocalLeads(leads), [leads]);

  // Follow Up Custom Calendar States
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [currentYear, setCurrentYear] = useState<number>(new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(new Date().getMonth());
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow;
  });
  const [selectedHour, setSelectedHour] = useState<string>('10');
  const [selectedMinute, setSelectedMinute] = useState<string>('00');
  const [selectedAmpm, setSelectedAmpm] = useState<string>('AM');
  const [followUpStatus, setFollowUpStatus] = useState<string>('Call Back');
  const [outcome, setOutcome] = useState<string>('');
  const [isSavingFollowUp, setIsSavingFollowUp] = useState<boolean>(false);

  const [visibleLimits, setVisibleLimits] = useState<Record<string, number>>({
    lead_created: 10,
    requirement_gathering: 10,
    payment_pending: 10
  });

  const handleLoadMore = (columnId: string) => {
    setVisibleLimits(prev => ({
      ...prev,
      [columnId]: prev[columnId] + 10
    }));
  };

  const MONTH_NAMES = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  };

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  };

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (year: number, month: number) => {
    return new Date(year, month, 1).getDay();
  };

  const getDaysAgo = (date: string) => {
    const diff = Math.floor((Date.now() - new Date(date).getTime()) / (1000 * 60 * 60 * 24));
    return diff === 0 ? "Today" : `${diff}d ago`;
  };

  const formatFollowUpDateTime = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch(e) {
      return dateStr;
    }
  };

  const handleSendToAccounts = async (leadId: string) => {
    setSendingLeadId(leadId);
    try {
      const result = await finalizeRequirementsAction(leadId);
      if (result.success) {
        toast.success("Sent to Accounts", {
          description: "Lead successfully pushed to the Accounts queue for payment milestones."
        });
        setLocalLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: 'payment_pending' } : l));
      } else {
        toast.error("Handover Failed", {
          description: result.error
        });
      }
    } catch (error: any) {
      toast.error("Error", {
        description: error.message || "An unexpected error occurred."
      });
    } finally {
      setSendingLeadId(null);
    }
  };

  const handleOpenFollowUpModal = (leadId: string) => {
    setSelectedLeadId(leadId);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);

    setCurrentYear(tomorrow.getFullYear());
    setCurrentMonth(tomorrow.getMonth());
    setSelectedDate(tomorrow);
    setSelectedHour('10');
    setSelectedMinute('00');
    setSelectedAmpm('AM');
    setFollowUpStatus('Call Back');
    setOutcome('');
  };

  const handleSaveFollowUp = async () => {
    if (!selectedLeadId) return;

    let hour = parseInt(selectedHour);
    if (selectedAmpm === 'PM' && hour < 12) hour += 12;
    if (selectedAmpm === 'AM' && hour === 12) hour = 0;

    const finalDate = new Date(
      selectedDate.getFullYear(),
      selectedDate.getMonth(),
      selectedDate.getDate(),
      hour,
      parseInt(selectedMinute)
    );

    const selectedLead = localLeads.find((l: any) => l.id === selectedLeadId);
    const isReschedule = !!selectedLead?.follow_up_date;

    setIsSavingFollowUp(true);
    try {
      const result = await recordFollowUpAction(selectedLeadId, finalDate.toISOString(), followUpStatus, outcome);
      if (result.success) {
        toast.success(isReschedule ? "Follow-up Rescheduled" : "Follow-up Scheduled", {
          description: isReschedule 
            ? "Follow-up task has been successfully rescheduled." 
            : "Project moved to Follow Up tab and task scheduled successfully."
        });
        setSelectedLeadId(null);
        setLocalLeads(prev => prev.map(l => l.id === selectedLeadId ? { ...l, follow_up_date: finalDate.toISOString(), status: 'requirement_gathering' } : l));
      } else {
        toast.error("Failed to save follow-up", { description: result.error });
      }
    } catch (err: any) {
      toast.error("Error", { description: err.message || "An unexpected error occurred." });
    } finally {
      setIsSavingFollowUp(false);
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {COLUMNS.map((col) => {
          const colLeads = localLeads.filter((l: any) => {
            if (col.id === 'lead_created') return l.status === 'lead_created';
            if (col.id === 'requirement_gathering') return l.status === 'requirement_gathering';
            if (col.id === 'payment_pending') return l.status === 'payment_pending';
            return false;
          });

          if (col.id === 'requirement_gathering') {
            colLeads.sort((a: any, b: any) => {
              const hasA = !!a.follow_up_date;
              const hasB = !!b.follow_up_date;
              if (hasA && !hasB) return -1;
              if (!hasA && hasB) return 1;
              if (!hasA && !hasB) return 0;
              return new Date(a.follow_up_date!).getTime() - new Date(b.follow_up_date!).getTime();
            });
          }
          return (
            <div key={col.id} className="flex flex-col space-y-6">
              <div className="flex items-center justify-between px-2">
                <div className="flex items-center gap-3">
                  <div className={cn("w-1.5 h-6 rounded-full", col.color)} />
                  <h3 className="font-bold text-slate-800 dark:text-slate-200 tracking-tight">{col.title}</h3>
                </div>
                <Badge variant="outline" className={cn("border-none font-semibold", col.bgLight, col.text)}>
                  {colLeads.length}
                </Badge>
              </div>

              <div
                onScroll={(e) => {
                  const target = e.currentTarget;
                  if (target.scrollHeight - target.scrollTop <= target.clientHeight + 80) {
                    handleLoadMore(col.id);
                  }
                }}
                className={cn(
                  "flex-1 max-h-[700px] overflow-y-auto pr-1 custom-scrollbar rounded-[2rem] p-4 space-y-4 transition-all duration-500 border",
                  col.bgLight, col.border
                )}
              >
                {colLeads.slice(0, visibleLimits[col.id]).map((lead) => {
                  const isLead = ['lead_created', 'requirement_gathering'].includes(lead.status);

                  const CardWrapper = ({ children, className }: { children: React.ReactNode; className: string }) => {
                    if (isLead) {
                      return (
                        <Link href={`/projects/${lead.id}`} className={className}>
                          {children}
                        </Link>
                      );
                    }
                    return <div className={className}>{children}</div>;
                  };

                  return (
                    <CardWrapper
                      key={lead.id}
                      className={cn(
                        "group block premium-glass p-5 rounded-2xl border-white/20 transition-all duration-300 relative overflow-hidden",
                        isLead ? "hover:border-indigo-500/30 cursor-pointer" : "cursor-default"
                      )}
                    >


                      <div className="space-y-3">
                        <div className="flex items-center justify-between gap-2">
                          {col.id === 'requirement_gathering' && lead.follow_up_date ? (
                            <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-lg tracking-wide flex items-center gap-1">
                              <Calendar className="w-3.5 h-3.5" />
                              {formatFollowUpDateTime(lead.follow_up_date)}
                            </span>
                          ) : (
                            <span className="text-[9px] font-semibold nums text-indigo-500 bg-indigo-500/10 px-1.5 py-0.5 rounded tracking-tighter uppercase">
                              {lead.id}
                            </span>
                          )}
                          <span className="text-[10px] font-medium text-slate-450 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {getDaysAgo(lead.created_at)}
                          </span>
                        </div>

                        <div>
                          <h4 className="font-bold text-slate-900 dark:text-white leading-tight group-hover:text-indigo-500 transition-colors">
                            {lead.client_name}
                          </h4>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">{lead.name}</p>
                        </div>

                        <div className="pt-2">
                          {(() => {
                            if (lead.status === 'lead_created') {
                              const isComplete = (
                                !!lead.client_name && !!lead.client_contact &&
                                (!!lead.client_address || !!lead.site_coordinates) &&
                                lead.services && lead.services.length > 0 && !!lead.survey_requirements &&
                                !!lead.target_completion_date && lead.requirement_checklist?.timeline_confirmed &&
                                lead.requirement_checklist?.budget_discussed &&
                                lead.requirement_checklist?.site_images_received &&
                                lead.requirement_checklist?.client_requirements_verified &&
                                lead.requirement_checklist?.measurements_confirmed &&
                                lead.requirement_checklist?.satbara_uploaded
                              );
                              return isComplete ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold uppercase tracking-wider border border-emerald-500/20">
                                  <CheckCircle2 className="w-3.5 h-3.5" /> Ready for Accounts
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-semibold uppercase tracking-wider border border-amber-500/20">
                                  <Clock className="w-3.5 h-3.5" /> Verification Pending
                                </span>
                              );
                            }
                            if (lead.status === 'requirement_gathering') {
                              return (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-semibold uppercase tracking-wider border border-blue-500/20">
                                  <Clock className="w-3.5 h-3.5" /> In Follow Up
                                </span>
                              );
                            }
                            return (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold border bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                                <span className="text-[10px] font-semibold mr-0.5 text-emerald-500">✓</span>
                                Payment Pending
                              </span>
                            );
                          })()}
                        </div>

                        {isLead && (
                          <div className="flex gap-2 pt-3.5 border-t border-slate-200/50 dark:border-white/5">
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleOpenFollowUpModal(lead.id);
                              }}
                              disabled={followUpLoadingId === lead.id || sendingLeadId === lead.id}
                              className="flex-1 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-800 dark:text-slate-200 font-bold text-[9.5px] uppercase tracking-wider flex items-center justify-center gap-1 transition-all active:scale-95 disabled:opacity-50 px-1"
                            >
                              {followUpLoadingId === lead.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <>
                                  <Clock className="w-3.5 h-3.5 text-indigo-500" />
                                  {lead.follow_up_date ? "Reschedule" : "Follow Up"}
                                </>
                              )}
                            </button>

                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleSendToAccounts(lead.id);
                              }}
                              disabled={sendingLeadId === lead.id || followUpLoadingId === lead.id}
                              className="flex-1 h-9 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-[9.5px] uppercase tracking-wider flex items-center justify-center gap-1 transition-all shadow-md shadow-indigo-500/10 active:scale-95 disabled:opacity-50 px-1"
                            >
                              {sendingLeadId === lead.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <>
                                  <Send className="w-3 h-3" />
                                  To Accounts
                                </>
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    </CardWrapper>
                  )
                })}

                {colLeads.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-40 border-2 border-dashed border-slate-200/50 dark:border-white/5 rounded-3xl text-slate-400 text-sm italic">
                    <p>No active items</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {selectedLeadId && (() => {
        const selectedLead = localLeads.find(l => l.id === selectedLeadId);
        const isReschedule = !!selectedLead?.follow_up_date;

        const totalDays = getDaysInMonth(currentYear, currentMonth);
        const firstDayIndex = getFirstDayOfMonth(currentYear, currentMonth);

        const daysArray: (Date | null)[] = [];
        for (let i = 0; i < firstDayIndex; i++) {
          daysArray.push(null);
        }
        for (let i = 1; i <= totalDays; i++) {
          daysArray.push(new Date(currentYear, currentMonth, i));
        }

        const isDateSelected = (date: Date | null) => {
          if (!date) return false;
          return date.getDate() === selectedDate.getDate() &&
            date.getMonth() === selectedDate.getMonth() &&
            date.getFullYear() === selectedDate.getFullYear();
        };

        const isDateToday = (date: Date | null) => {
          if (!date) return false;
          const today = new Date();
          return date.getDate() === today.getDate() &&
            date.getMonth() === today.getMonth() &&
            date.getFullYear() === today.getFullYear();
        };

        return createPortal(
          <div className="fixed inset-0 z-[9999] bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
            <div className="w-full max-w-3xl bg-white dark:bg-slate-950 rounded-[2rem] shadow-2xl border border-slate-200/60 dark:border-white/[0.08] flex flex-col max-h-[90vh] overflow-y-auto animate-in zoom-in-95 slide-in-from-bottom-6 duration-300">

              {/* Modal Header */}
              <div className="flex items-center justify-between px-7 py-5 bg-indigo-600 dark:bg-indigo-700 text-white rounded-t-[2rem] border-b border-indigo-500/20 shrink-0">
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-2xl bg-white/10 text-white flex items-center justify-center shrink-0">
                    <Calendar className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold tracking-tight text-white">{isReschedule ? 'Reschedule Follow Up' : 'Schedule Follow Up'}</h3>
                    <p className="text-sm text-indigo-100 font-medium mt-0.5">Record outcome & set your next check-in</p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedLeadId(null)}
                  className="w-9 h-9 rounded-xl bg-white/10 text-white hover:bg-white/20 flex items-center justify-center transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-7">

                {/* Left Column: Calendar */}
                <div className="space-y-3">
                  {/* Month Navigation */}
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={prevMonth}
                      className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 flex items-center justify-center text-slate-600 dark:text-slate-300 transition-all"
                    >
                      <ChevronRight className="w-4 h-4 rotate-180" />
                    </button>
                    <span className="text-sm font-semibold text-slate-800 dark:text-white">
                      {MONTH_NAMES[currentMonth]} {currentYear}
                    </span>
                    <button
                      type="button"
                      onClick={nextMonth}
                      className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-white/5 hover:bg-slate-200 dark:hover:bg-white/10 flex items-center justify-center text-slate-600 dark:text-slate-300 transition-all"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Calendar Grid */}
                  <div className="rounded-2xl border border-slate-100 dark:border-white/[0.06] overflow-hidden">
                    {/* Day headers */}
                    <div className="grid grid-cols-7 text-center bg-slate-50 dark:bg-white/[0.03] border-b border-slate-100 dark:border-white/[0.05] py-2">
                      {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((d: any) => (
                        <span key={d} className="text-xs font-medium text-slate-400 dark:text-slate-500">{d}</span>
                      ))}
                    </div>
                    {/* Day cells */}
                    <div className="grid grid-cols-7 gap-0 p-3 bg-white dark:bg-slate-900/30">
                      {daysArray.map((date, idx) => {
                        if (!date) return <div key={`empty-${idx}`} />;
                        const selected = isDateSelected(date);
                        const today = isDateToday(date);
                        return (
                          <button
                            key={`day-${idx}`}
                            type="button"
                            onClick={() => setSelectedDate(date)}
                            className={cn(
                              "h-9 w-full rounded-xl flex items-center justify-center text-sm font-medium transition-all duration-150 active:scale-90",
                              selected
                                ? "bg-indigo-600 text-white shadow-sm shadow-indigo-500/20"
                                : today
                                  ? "text-indigo-600 dark:text-indigo-400 font-semibold border border-indigo-200 dark:border-indigo-500/30 bg-indigo-50/60 dark:bg-indigo-500/10"
                                  : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
                            )}
                          >
                            {date.getDate()}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Right Column: Time, Status, Notes, Actions */}
                <div className="flex flex-col gap-4">

                  {/* Time Selector */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-500 dark:text-slate-400 block">Time</label>
                    <div className="flex gap-2 items-center">
                      <select
                        value={selectedHour}
                        onChange={(e) => setSelectedHour(e.target.value)}
                        className="glass-input flex-1 py-2.5 appearance-none cursor-pointer"
                      >
                        {Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0')).map((h: any) => (
                          <option key={h} value={h}>{h} Hr</option>
                        ))}
                      </select>
                      <span className="text-slate-400 font-semibold shrink-0">:</span>
                      <select
                        value={selectedMinute}
                        onChange={(e) => setSelectedMinute(e.target.value)}
                        className="glass-input flex-1 py-2.5 appearance-none cursor-pointer"
                      >
                        {Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0')).map((m: any) => (
                          <option key={m} value={m}>{m} Min</option>
                        ))}
                      </select>
                      {/* AM/PM */}
                      <div className="flex border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden shrink-0">
                        {['AM', 'PM'].map((period: any) => (
                          <button
                            key={period}
                            type="button"
                            onClick={() => setSelectedAmpm(period as 'AM' | 'PM')}
                            className={cn(
                              "px-3 h-10 text-xs font-semibold transition-all",
                              selectedAmpm === period
                                ? "bg-indigo-600 text-white"
                                : "bg-white dark:bg-slate-900/50 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5"
                            )}
                          >
                            {period}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Follow-up Status */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-500 dark:text-slate-400 block">Follow-up Status</label>
                    <select
                      value={followUpStatus}
                      onChange={(e) => setFollowUpStatus(e.target.value)}
                      className="glass-input py-2.5 appearance-none cursor-pointer"
                    >
                      <option value="Call Back">Call Back</option>
                      <option value="Interested">Interested</option>
                      <option value="Not Reachable">Not Reachable</option>
                      <option value="Waiting for Documents">Waiting for Documents</option>
                    </select>
                  </div>

                  {/* Outcome Notes */}
                  <div className="space-y-1.5 flex-1">
                    <label className="text-xs font-medium text-slate-500 dark:text-slate-400 block">Outcome / Notes</label>
                    <textarea
                      value={outcome}
                      onChange={(e) => setOutcome(e.target.value)}
                      placeholder="Summarise what was discussed..."
                      className="glass-input min-h-[100px] resize-none py-3"
                    />
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => setSelectedLeadId(null)}
                      className="flex-1 h-11 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-700 dark:text-slate-200 font-semibold text-sm transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveFollowUp}
                      disabled={isSavingFollowUp}
                      className="flex-1 h-11 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-sm transition-all shadow-md shadow-indigo-500/20 disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {isSavingFollowUp ? <Loader2 className="w-4 h-4 animate-spin" /> : (isReschedule ? "Reschedule" : "Save Follow Up")}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>,
          document.body
        );
      })()}
    </>
  );
}
