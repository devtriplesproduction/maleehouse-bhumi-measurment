"use client";

import React, { useState, useTransition, useEffect } from "react";
import {
  PenTool, CheckCircle2, XCircle, Clock, ChevronDown,
  ChevronUp, AlertTriangle, Loader2, FileText, RotateCcw, Hash
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import {
  approveCADRevisionAction,
  rejectCADRevisionAction,
  bypassCADEscalationAction,
  type CADRevision,
} from "@/actions/operations.actions";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

const STATUS_CONFIG = {
  pending_review: {
    label: "Pending Review",
    color: "text-amber-500",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
    icon: Clock,
  },
  approved: {
    label: "Approved",
    color: "text-emerald-500",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
    icon: CheckCircle2,
  },
  rejected: {
    label: "Rejected",
    color: "text-rose-500",
    bg: "bg-rose-500/10",
    border: "border-rose-500/20",
    icon: XCircle,
  },
  rework_requested: {
    label: "Rework Requested",
    color: "text-orange-500",
    bg: "bg-orange-500/10",
    border: "border-orange-500/20",
    icon: RotateCcw,
  },
};

interface CADRevisionPanelProps {
  projectId: string;
  revisions: CADRevision[];
  userRole: string;
  currentUserId: string;
  isFrozen?: boolean;
  bypassActive?: boolean;
}

export function CADRevisionPanel({
  projectId,
  revisions,
  userRole,
  currentUserId,
  isFrozen = false,
  bypassActive = false,
}: CADRevisionPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isBypassing, setIsBypassing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(
    revisions[0]?.id || null
  );
  const [activeAction, setActiveAction] = useState<{
    revisionId: string;
    type: "approve" | "reject";
  } | null>(null);
  const [reviewNote, setReviewNote] = useState("");

  const [localRevisions, setLocalRevisions] = useState(revisions);
  const [localBypass, setLocalBypass] = useState(bypassActive);

  useEffect(() => {
    setLocalRevisions(revisions);
    setLocalBypass(bypassActive);
  }, [revisions, bypassActive]);

  const isEngineer = ["engineer", "admin"].includes(userRole);
  const isCAD = ["cad", "admin", "engineer", "field"].includes(userRole);
  const latestRevision = localRevisions[0];
  
  const rejectedCount = localRevisions.filter((r: any) => r.status === "rejected" || r.status === "rework_requested").length;
  const isEscalationHold = rejectedCount >= 10 && !localBypass;
  const hasEscalatedRevisions = localRevisions.length >= 10 && localRevisions.some((r: any) => r.status === "pending_review");

  const handleApprove = () => {
    if (!activeAction) return;
    startTransition(async () => {
      const result = await approveCADRevisionAction(
        activeAction.revisionId,
        projectId,
        reviewNote
      );
      if (result?.success) {
        const data: any = (result as any).data;
        if (data) {
          setLocalRevisions(prev => prev.map((r: any) => r.id === data.id ? { ...r, ...data } : r));
        }
        toast.success("Revision approved.");
        setActiveAction(null);
        setReviewNote("");
      } else {
        toast.error(result?.error || "Approval failed.");
      }
    });
  };

  const handleReject = () => {
    if (!activeAction || !reviewNote.trim()) return;
    startTransition(async () => {
      const result = await rejectCADRevisionAction(
        activeAction.revisionId,
        projectId,
        reviewNote
      );
      if (result?.success) {
        const data: any = (result as any).data;
        if (data) {
          setLocalRevisions(prev => prev.map((r: any) => r.id === data.id ? { ...r, ...data } : r));
        }
        toast.success("Revision rework requested. Team notified.");
        setActiveAction(null);
        setReviewNote("");
      } else {
        toast.error(result?.error || "Rejection failed.");
      }
    });
  };

  const handleBypassEscalation = () => {
    setIsBypassing(true);
    startTransition(async () => {
      try {
        const result = await bypassCADEscalationAction(projectId);
        if (result?.success) {
          if (result.data?.bypass_active) {
            setLocalBypass(result.data.bypass_active);
          }
          toast.success("Escalation hold bypassed successfully.");
        } else {
          toast.error(result?.error || "Bypass failed.");
        }
      } catch (err: any) {
        toast.error(err.message || "An unexpected error occurred.");
      } finally {
        setIsBypassing(false);
      }
    });
  };

  return (
    <div className="glass-card p-6">
      {/* Header Row */}
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-white tracking-tight flex items-center gap-2">
          <PenTool className="w-4 h-4 text-indigo-500" />
          Revision History
        </h3>
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 uppercase tracking-wider">
          {localRevisions.length} version{localRevisions.length !== 1 ? "s" : ""}
        </span>
      </div>
      <div className="space-y-4">

      {/* Escalation Hold warning banner */}
      {isEscalationHold && (
        <div className="p-5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-200 flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-xs font-black text-white uppercase tracking-widest">REVISION LIMIT REACHED (Escalation Hold Active)</p>
              <p className="text-sm text-slate-400 leading-normal">
                This project has reached 10 rejections and is currently locked under Escalation Hold.
                Further uploads are disabled. An Admin or Lead Engineer must verify alignment parameters first.
              </p>
            </div>
          </div>
          {isEngineer && (
            <button
              onClick={handleBypassEscalation}
              disabled={isBypassing}
              className="px-4 py-2 text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-700 rounded-xl transition-all uppercase tracking-widest shrink-0"
            >
              {isBypassing ? "Authorizing..." : "Authorize Bypass"}
            </button>
          )}
        </div>
      )}

      {/* Escalated Review warning banner */}
      {hasEscalatedRevisions && (
        <div className="p-4 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-200 flex items-start gap-3">
          <AlertTriangle className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <p className="text-xs font-bold text-white uppercase tracking-wider">REVISION LIMIT REACHED (Escalated Review Active)</p>
            <p className="text-sm text-slate-400 leading-normal">
              This project has reached drafting limits. Escalated review has been triggered for Admins and Lead Engineers.
            </p>
          </div>
        </div>
      )}

      {/* Revision List */}
      {localRevisions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
          <div className="w-12 h-12 rounded-full bg-blue-500/5 flex items-center justify-center border border-blue-500/10">
            <FileText className="w-5 h-5 text-blue-500/30" />
          </div>
          <p className="text-sm font-bold text-slate-500">No revisions yet</p>
          <p className="text-xs text-slate-600">
            No revisions or rework records logged yet.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {localRevisions.map((rev: any) => {
            const cfg = STATUS_CONFIG[rev.status as keyof typeof STATUS_CONFIG];
            const StatusIcon = cfg.icon;
            const isExpanded = expandedId === rev.id;

            return (
              <div
                key={rev.id}
                className={cn(
                  "rounded-2xl border transition-all",
                  "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800",
                  isExpanded ? "shadow-lg" : "hover:shadow-md cursor-pointer"
                )}
              >
                {/* Revision Card Header */}
                <div
                  className="flex items-center justify-between p-4 cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : rev.id)}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs",
                      cfg.bg, cfg.color
                    )}>
                      <Hash className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black text-slate-900 dark:text-white">
                          Rev V{rev.revision_number}
                        </span>
                        <span className={cn(
                          "text-xs font-black uppercase tracking-widest px-2 py-0.5 rounded-md flex items-center gap-1",
                          cfg.bg, cfg.color
                        )}>
                          <StatusIcon className="w-2.5 h-2.5" />
                          {rev.status === "approved" ? "Final Approved" : cfg.label}
                        </span>
                      </div>
                      <p className="text-sm text-slate-400 mt-0.5">{rev.title || rev.files?.[0]?.name || (rev.revision_type === 'survey' ? 'Field Survey Data' : 'Deliverable Document')}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-xs text-slate-500 hidden sm:block">
                      {formatDistanceToNow(new Date(rev.submitted_at || rev.updated_at || new Date()), { addSuffix: true })}
                    </span>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="px-4 pb-4 space-y-4 animate-in slide-in-from-top-1 duration-200">
                    <div className="h-px bg-white/8" />

                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-1">
                          Submitted By
                        </p>
                        <p className="font-bold text-slate-800 dark:text-slate-200">
                          {rev.submitted_by_profile?.first_name} {rev.submitted_by_profile?.last_name}
                        </p>
                      </div>
                      {rev.reviewed_by_profile && (
                        <div>
                          <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-1">
                            Reviewed By
                          </p>
                          <p className="font-bold text-slate-800 dark:text-slate-200">
                            {rev.reviewed_by_profile.first_name} {rev.reviewed_by_profile.last_name}
                          </p>
                        </div>
                      )}
                    </div>

                    <div>
                      <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-1">
                        Revision Notes
                      </p>
                      <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed bg-slate-50 dark:bg-white/5 p-3 rounded-xl border border-slate-100 dark:border-white/5">
                        {rev.description || 'No notes provided.'}
                      </p>
                    </div>

                    {rev.review_notes && (
                      <div>
                        <p className="text-xs font-black uppercase tracking-widest text-slate-500 mb-1">
                          Engineer Feedback
                        </p>
                        <p className="text-xs leading-relaxed bg-slate-50 dark:bg-white/5 p-3 rounded-xl border border-slate-100 dark:border-white/5 text-slate-600 dark:text-slate-300">
                          {rev.review_notes}
                        </p>
                      </div>
                    )}

                    {/* Engineer Action Panel */}
                    {isEngineer && rev.status === "pending_review" && (
                      <div className="space-y-3 pt-1">
                        {activeAction && activeAction.revisionId === rev.id ? (
                          <div className="space-y-3 p-4 rounded-xl bg-slate-100/50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
                            <p className="text-xs font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                              {activeAction.type === "approve" ? "Approval Note" : "Rejection Reason *"}
                            </p>
                            <textarea
                              value={reviewNote}
                              onChange={(e) => setReviewNote(e.target.value)}
                              placeholder={
                                activeAction.type === "approve"
                                  ? "Optional approval note..."
                                  : "Explain what needs to be corrected..."
                              }
                              rows={3}
                              className="w-full px-3.5 py-2.5 text-xs bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl text-slate-800 dark:text-slate-200 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
                            />
                            <div className="flex gap-2 justify-end">
                              <button
                                onClick={() => { setActiveAction(null); setReviewNote(""); }}
                                className="px-4 py-2 text-sm font-black text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-all"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={activeAction.type === "approve" ? handleApprove : handleReject}
                                disabled={isPending || (activeAction.type === "reject" && !reviewNote.trim())}
                                className={cn(
                                  "flex items-center gap-2 px-5 py-2 text-sm font-black text-white rounded-xl transition-all disabled:opacity-50",
                                  activeAction.type === "approve"
                                    ? "bg-indigo-600 hover:bg-indigo-700"
                                    : "bg-indigo-600 hover:bg-indigo-700"
                                )}
                              >
                                {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                {activeAction.type === "approve" ? "Confirm Approve" : "Confirm Reject"}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            <button
                              disabled={isFrozen}
                              onClick={() => setActiveAction({ revisionId: rev.id, type: "approve" })}
                              className={cn(
                                "flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-black text-white rounded-xl transition-all shadow-lg",
                                isFrozen 
                                  ? "bg-slate-400 dark:bg-white/10 opacity-50 cursor-not-allowed shadow-none" 
                                  : "bg-indigo-600 hover:bg-indigo-700 shadow-emerald-600/20"
                              )}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              {isFrozen ? "Locked" : "Approve"}
                            </button>
                            <button
                              disabled={isFrozen}
                              onClick={() => setActiveAction({ revisionId: rev.id, type: "reject" })}
                              className={cn(
                                "flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-black text-white rounded-xl transition-all shadow-lg",
                                isFrozen 
                                  ? "bg-slate-400 dark:bg-white/10 opacity-50 cursor-not-allowed shadow-none" 
                                  : "bg-indigo-600 hover:bg-indigo-700 shadow-rose-600/20"
                              )}
                            >
                              <XCircle className="w-3.5 h-3.5" />
                              {isFrozen ? "Locked" : "Reject"}
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      </div>
    </div>
  );
}
