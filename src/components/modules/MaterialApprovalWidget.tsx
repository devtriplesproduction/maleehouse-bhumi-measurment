"use client";

import React, { useState } from "react";
import { Package, CheckCircle2, XCircle, Clock, User, FolderKanban, MessageSquare, Truck, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { updateMaterialRequestStatusAction, submitMaterialToCompanyAction } from "@/actions/field.actions";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

export function MaterialApprovalWidget({ requests = [] }: { requests: any[] }) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<"in_field" | "submitted" | "all">("in_field");

  const handleUpdate = async (id: string, status: "approved" | "delivered" | "rejected" | "submitted" | "assigned") => {
    setLoadingId(id);
    const res = await updateMaterialRequestStatusAction(id, status);
    setLoadingId(null);
    if (res.success) {
      router.refresh();
    } else {
      alert("Failed to update status: " + res.error);
    }
  };

  const handleSubmitToCompany = async (id: string) => {
    setLoadingId(id);
    const res = await submitMaterialToCompanyAction(id);
    setLoadingId(null);
    if (res.success) {
      router.refresh();
    } else {
      alert("Failed to submit material: " + res.error);
    }
  };

  const inFieldCount = requests.filter(r => r.status === "assigned" || r.status === "requested" || r.status === "delivered").length;
  const submittedCount = requests.filter(r => r.status === "submitted" || r.status === "returned").length;

  const filteredRequests = requests.filter(r => {
    if (activeFilter === "in_field") return r.status === "assigned" || r.status === "requested" || r.status === "delivered";
    if (activeFilter === "submitted") return r.status === "submitted" || r.status === "returned";
    return true;
  });

  return (
    <div className="glass-card border-slate-200/60 dark:border-white/10 p-5 space-y-4 rounded-3xl shadow-sm">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
            <Package className="w-4.5 h-4.5" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900 dark:text-white tracking-tight">
              Materials & Equipment
            </h3>
            <p className="text-[10px] font-semibold text-slate-400">Assigned & Company Return Tracker</p>
          </div>
        </div>

        {inFieldCount > 0 && (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-[10px] font-extrabold">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
            <span>{inFieldCount} In Field</span>
          </div>
        )}
      </div>

      {/* ── Filter Tabs ── */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-white/[0.04] rounded-2xl border border-slate-200/50 dark:border-white/5">
        <button
          type="button"
          onClick={() => setActiveFilter("in_field")}
          className={cn(
            "flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5",
            activeFilter === "in_field"
              ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200/60 dark:border-white/10"
              : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
          )}
        >
          <span>In Field</span>
          {inFieldCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 text-[9px] font-black">
              {inFieldCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveFilter("submitted")}
          className={cn(
            "flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5",
            activeFilter === "submitted"
              ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200/60 dark:border-white/10"
              : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
          )}
        >
          <span>Submitted</span>
          {submittedCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[9px] font-black">
              {submittedCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveFilter("all")}
          className={cn(
            "flex-1 py-1.5 px-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5",
            activeFilter === "all"
              ? "bg-white dark:bg-slate-900 text-indigo-600 dark:text-indigo-400 shadow-sm border border-slate-200/60 dark:border-white/10"
              : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
          )}
        >
          <span>All</span>
          <span className="px-1.5 py-0.2 rounded-md bg-slate-200/80 dark:bg-white/10 text-slate-600 dark:text-slate-400 text-[9px] font-black">
            {requests.length}
          </span>
        </button>
      </div>

      {/* ── Request List Container ── */}
      <div className="space-y-3 max-h-[380px] overflow-y-auto pr-1 custom-scrollbar">
        {filteredRequests.length === 0 ? (
          <div className="py-10 px-4 text-center rounded-2xl border border-dashed border-slate-200 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.01]">
            <div className="w-10 h-10 rounded-2xl bg-slate-100 dark:bg-white/5 flex items-center justify-center mx-auto mb-2 text-slate-400">
              <Package className="w-5 h-5 opacity-60" />
            </div>
            <p className="text-xs font-bold text-slate-700 dark:text-slate-300">
              {activeFilter === "in_field" ? "No materials currently out on field" : "No materials found"}
            </p>
            <p className="text-[10px] text-slate-400 mt-0.5">
              {activeFilter === "in_field" ? "All assigned equipment has been submitted to company." : "No entries matching this filter."}
            </p>
          </div>
        ) : (
          filteredRequests.map((mat, idx) => {
            const isInField = mat.status === "assigned" || mat.status === "requested" || mat.status === "delivered";
            const isSubmitted = mat.status === "submitted" || mat.status === "returned";

            return (
              <div
                key={mat.id || idx}
                className="p-3.5 rounded-2xl bg-white dark:bg-slate-900/50 border border-slate-200/70 dark:border-white/5 hover:border-indigo-500/30 hover:shadow-md hover:shadow-indigo-500/5 transition-all duration-300 space-y-3 group"
              >
                {/* Top Row: Item Title + Qty Pill + Status Badge */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={cn(
                      "w-8 h-8 rounded-xl border flex items-center justify-center shrink-0",
                      isSubmitted
                        ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                        : "bg-indigo-500/10 border-indigo-500/20 text-indigo-600 dark:text-indigo-400"
                    )}>
                      {isSubmitted ? <CheckCircle2 className="w-4 h-4" /> : <Package className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-sm font-black text-slate-900 dark:text-white capitalize truncate leading-tight group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                        {mat.item}
                      </h4>
                      <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 mt-0.5 block">
                        Quantity: <span className="font-black text-slate-900 dark:text-white">{mat.quantity}</span>
                      </span>
                    </div>
                  </div>

                  <div className="shrink-0">
                    {isSubmitted && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold uppercase tracking-wider">
                        <CheckCircle2 className="w-3 h-3" />
                        In Company
                      </span>
                    )}
                    {isInField && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-[10px] font-bold uppercase tracking-wider">
                        <Clock className="w-3 h-3" />
                        In Field
                      </span>
                    )}
                  </div>
                </div>

                {/* Middle Row: Project & Assignment Info */}
                <div className="bg-slate-50/70 dark:bg-white/[0.02] p-2.5 rounded-xl border border-slate-150 dark:border-white/5 space-y-1.5">
                  <div className="flex items-center justify-between text-xs gap-2">
                    <div className="flex items-center gap-1.5 min-w-0 text-slate-700 dark:text-slate-300 font-semibold">
                      <FolderKanban className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                      <span className="truncate" title={mat.project_name}>{mat.project_name}</span>
                    </div>
                    {mat.created_at && (
                      <span className="text-[10px] font-medium text-slate-400 shrink-0 whitespace-nowrap">
                        {formatDistanceToNow(new Date(mat.created_at), { addSuffix: true })}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                    <User className="w-3 h-3 text-slate-400 shrink-0" />
                    <span className="truncate">
                      Assigned To: <span className="font-bold text-slate-700 dark:text-slate-300">{mat.assigned_to_name || mat.requested_by_name || "Project Crew"}</span>
                    </span>
                  </div>

                  {mat.notes && (
                    <div className="mt-1 pt-1.5 border-t border-slate-200/50 dark:border-white/5 flex items-start gap-1.5 text-[11px] text-slate-600 dark:text-slate-400 italic">
                      <MessageSquare className="w-3 h-3 text-amber-500 shrink-0 mt-0.5" />
                      <span className="line-clamp-2">&ldquo;{mat.notes}&rdquo;</span>
                    </div>
                  )}
                </div>

                {/* Action Button: Mark Submitted in Company */}
                {isInField && (
                  <button
                    type="button"
                    onClick={() => handleSubmitToCompany(mat.id)}
                    disabled={loadingId === mat.id}
                    className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold rounded-xl text-xs transition-all shadow-sm shadow-emerald-600/20 disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {loadingId === mat.id ? "Submitting..." : "Mark Submitted in Company"}
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
