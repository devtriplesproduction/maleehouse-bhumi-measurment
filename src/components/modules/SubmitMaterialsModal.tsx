"use client";

import React, { useState, useEffect } from "react";
import {
  Package,
  AlertTriangle,
  CheckCircle2,
  PackageX,
  User,
  Info,
  Loader2,
  MapPin,
  ShieldAlert,
  Sparkles
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import {
  submitAllProjectMaterialsAction,
  markMaterialLostAction,
  MissingMaterialInput
} from "@/actions/field.actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface SubmitMaterialsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName?: string;
  pendingMaterials: any[];
  teamMembers?: any[];
  staff?: any[];
  singleMaterial?: any | null;
  onSuccess: () => void;
  onOptimisticBulkSubmit?: (missingInputs: MissingMaterialInput[]) => void;
  onOptimisticLostSubmit?: (materialId: string, info: { responsiblePersonName: string; reason: string }) => void;
}

interface ItemEntryState {
  isLost: boolean;
  responsiblePersonId: string;
  responsiblePersonName: string;
  isCustomName: boolean;
  reason: string;
}

const COMMON_REASONS = [
  "Damaged during field work",
  "Lost during boundary survey",
  "Device dropped / screen broken",
  "Left at field checkpoint",
  "Lost in transit"
];

export function SubmitMaterialsModal({
  open,
  onOpenChange,
  projectId,
  projectName,
  pendingMaterials,
  teamMembers = [],
  staff = [],
  singleMaterial = null,
  onSuccess,
  onOptimisticBulkSubmit,
  onOptimisticLostSubmit
}: SubmitMaterialsModalProps) {
  const [itemsState, setItemsState] = useState<Record<string, ItemEntryState>>({});
  const [submitting, setSubmitting] = useState(false);

  // Normalise candidates for responsible person
  const memberCandidates = React.useMemo(() => {
    const list: { id: string; name: string; role: string; label: string }[] = [];
    const seen = new Set<string>();

    // 1. Assigned project team members
    for (const t of teamMembers) {
      const uid = t.userId || t.user_id || t.id;
      if (!uid || seen.has(uid)) continue;
      seen.add(uid);
      const name = (t.firstName || t.lastName)
        ? `${t.firstName || ''} ${t.lastName || ''}`.trim()
        : t.profiles?.first_name || t.profiles?.last_name
          ? `${t.profiles?.first_name || ''} ${t.profiles?.last_name || ''}`.trim()
          : t.email || uid;
      const role = (t.role || 'Team Member').replace('_', ' ');
      list.push({ id: uid, name, role, label: `${name} (${role})` });
    }

    // 2. Staff members
    for (const s of staff) {
      if (!s.id || seen.has(s.id)) continue;
      seen.add(s.id);
      const name = (s.first_name || s.last_name)
        ? `${s.first_name || ''} ${s.last_name || ''}`.trim()
        : s.email || s.id;
      const role = (s.role || 'Staff').replace('_', ' ');
      list.push({ id: s.id, name, role, label: `${name} (${role})` });
    }

    return list;
  }, [teamMembers, staff]);

  // Initialise states when opening
  useEffect(() => {
    if (!open) return;

    const initial: Record<string, ItemEntryState> = {};
    const itemsToProcess = singleMaterial ? [singleMaterial] : pendingMaterials;

    for (const mat of itemsToProcess) {
      const isSingleMode = !!singleMaterial;
      const defaultPersonId = mat.assigned_to || mat.responsible_person_id || "";
      const defaultPersonName = mat.assigned_to_name || mat.responsible_person_name || "";

      initial[mat.id] = {
        isLost: isSingleMode ? true : false,
        responsiblePersonId: defaultPersonId,
        responsiblePersonName: defaultPersonName,
        isCustomName: false,
        reason: mat.lost_reason || ""
      };
    }

    setItemsState(initial);
  }, [open, singleMaterial, pendingMaterials]);

  const displayedMaterials = singleMaterial ? [singleMaterial] : pendingMaterials;

  const handleToggleLost = (matId: string, isLost: boolean) => {
    setItemsState((prev) => ({
      ...prev,
      [matId]: {
        ...(prev[matId] || {
          isLost: false,
          responsiblePersonId: "",
          responsiblePersonName: "",
          isCustomName: false,
          reason: ""
        }),
        isLost
      }
    }));
  };

  const handleSelectResponsible = (matId: string, val: string) => {
    setItemsState((prev) => {
      const cur = prev[matId] || {
        isLost: true,
        responsiblePersonId: "",
        responsiblePersonName: "",
        isCustomName: false,
        reason: ""
      };

      if (val === "__custom__") {
        return {
          ...prev,
          [matId]: {
            ...cur,
            isCustomName: true,
            responsiblePersonId: "",
            responsiblePersonName: ""
          }
        };
      }

      const found = memberCandidates.find((c) => c.id === val);
      return {
        ...prev,
        [matId]: {
          ...cur,
          isCustomName: false,
          responsiblePersonId: val,
          responsiblePersonName: found?.name || val
        }
      };
    });
  };

  const handleCustomNameChange = (matId: string, name: string) => {
    setItemsState((prev) => ({
      ...prev,
      [matId]: {
        ...prev[matId],
        responsiblePersonName: name
      }
    }));
  };

  const handleReasonChange = (matId: string, reason: string) => {
    setItemsState((prev) => ({
      ...prev,
      [matId]: {
        ...prev[matId],
        reason
      }
    }));
  };

  const lostCount = displayedMaterials.filter((m) => itemsState[m.id]?.isLost).length;
  const returnedCount = displayedMaterials.length - lostCount;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate that every lost item has a responsible person name & reason
    for (const m of displayedMaterials) {
      const state = itemsState[m.id];
      if (state?.isLost) {
        if (!state.responsiblePersonName.trim()) {
          toast.error(`Please select or specify the responsible team member for "${m.item || m.item_name}".`);
          return;
        }
        if (!state.reason.trim()) {
          toast.error(`Please provide a brief reason or location note for lost item "${m.item || m.item_name}".`);
          return;
        }
      }
    }

    setSubmitting(true);

    try {
      if (singleMaterial) {
        // Single material marked as lost
        const state = itemsState[singleMaterial.id];
        const respName = state.responsiblePersonName.trim();
        const reason = state.reason.trim();
        const respId = state.responsiblePersonId || undefined;

        // Optimistically update UI immediately
        if (onOptimisticLostSubmit) {
          onOptimisticLostSubmit(singleMaterial.id, { responsiblePersonName: respName, reason });
        }
        onOpenChange(false);
        toast.success(`Reporting "${singleMaterial.item || singleMaterial.item_name}" as lost...`);

        const res = await markMaterialLostAction(
          singleMaterial.id,
          respId,
          respName,
          reason
        );

        if (res.success) {
          toast.success(res.message || "Material reported as lost.");
          onSuccess();
        } else {
          toast.error(res.error || "Failed to mark material as lost.");
          onSuccess();
        }
      } else {
        // Bulk submission
        const missingInputs: MissingMaterialInput[] = [];

        for (const m of displayedMaterials) {
          const state = itemsState[m.id];
          if (state?.isLost) {
            missingInputs.push({
              materialId: m.id,
              responsiblePersonId: state.responsiblePersonId || undefined,
              responsiblePersonName: state.responsiblePersonName.trim(),
              reason: state.reason.trim()
            });
          }
        }

        // Optimistically update UI immediately
        if (onOptimisticBulkSubmit) {
          onOptimisticBulkSubmit(missingInputs);
        }
        onOpenChange(false);
        toast.success("Submitting materials to company...");

        const res = await submitAllProjectMaterialsAction(projectId, missingInputs);
        if (res.success) {
          toast.success(res.message || "Materials submitted to company.");
          onSuccess();
        } else {
          toast.error(res.error || "Failed to submit materials.");
          onSuccess();
        }
      }
    } catch (err: any) {
      toast.error(err.message || "An unexpected error occurred.");
      onSuccess();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 shadow-2xl rounded-3xl text-slate-900 dark:text-white">
        
        {/* Header */}
        <div className="p-6 pb-5 border-b border-slate-100 dark:border-white/5 bg-gradient-to-b from-slate-50/80 to-white dark:from-slate-900/90 dark:to-slate-900 flex items-start gap-4">
          <div className={cn(
            "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border shadow-sm transition-transform duration-200",
            singleMaterial
              ? "bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400"
              : "bg-indigo-500/10 border-indigo-500/20 text-indigo-600 dark:text-indigo-400"
          )}>
            {singleMaterial ? <PackageX className="w-6 h-6" /> : <Package className="w-6 h-6" />}
          </div>
          <div className="min-w-0 flex-1">
            <DialogTitle className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
              {singleMaterial ? "Report Equipment Lost / Missing" : "Submit Assigned Materials to Company"}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              {singleMaterial
                ? "Record missing equipment and attribute responsibility to continue the deliverable workflow."
                : "Account for all project equipment. Items reported missing require an attributed responsible member."}
            </DialogDescription>
          </div>
        </div>

        {/* Scrollable list of items */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
            
            {/* Informative notice banner */}
            <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-amber-500/[0.08] border border-amber-500/20 text-xs text-amber-900 dark:text-amber-200">
              <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <strong className="font-semibold text-amber-950 dark:text-amber-100">Audit & Review Gate:</strong> Attributing a responsible member allows the final deliverable to proceed without delay while logging an audit record for Admin reconciliation.
              </div>
            </div>

            {displayedMaterials.map((mat) => {
              const state = itemsState[mat.id] || {
                isLost: false,
                responsiblePersonId: "",
                responsiblePersonName: "",
                isCustomName: false,
                reason: ""
              };
              const qty = Number(mat.quantity) || 1;

              return (
                <div key={mat.id} className="space-y-4">
                  {/* Single Item Overview Card */}
                  <div className={cn(
                    "p-4 rounded-2xl border transition-all duration-200 shadow-xs",
                    state.isLost
                      ? "bg-gradient-to-r from-rose-50/90 via-slate-50/50 to-white dark:from-rose-950/20 dark:via-slate-900/60 dark:to-slate-900 border-rose-200/80 dark:border-rose-500/30"
                      : "bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10"
                  )}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border mt-0.5 shadow-xs",
                          state.isLost
                            ? "bg-white dark:bg-slate-800 border-rose-200/80 dark:border-rose-500/30 text-rose-600 dark:text-rose-400"
                            : "bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400"
                        )}>
                          {state.isLost ? <PackageX className="w-5 h-5" /> : <Package className="w-5 h-5" />}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                              {mat.item || mat.item_name}
                            </h4>
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-lg bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-500/30 shrink-0">
                              <span className="text-[9px] uppercase font-semibold text-indigo-500/80">Qty:</span>
                              <span className="font-black text-xs">{qty}</span>
                              <span className="text-[10px] text-indigo-500/80 font-medium">{qty === 1 ? 'unit' : 'units'}</span>
                            </span>
                          </div>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5 flex-wrap">
                            <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>Originally allocated: <strong className="font-semibold text-slate-700 dark:text-slate-300">{mat.assigned_to_name || "General Allocation"}</strong></span>
                            {mat.notes && (
                              <>
                                <span>&bull;</span>
                                <span className="italic truncate">{mat.notes}</span>
                              </>
                            )}
                          </p>
                        </div>
                      </div>

                      {/* Mode Badge or Toggle */}
                      {!singleMaterial ? (
                        <div className="flex items-center bg-slate-100 dark:bg-slate-800 p-1 rounded-xl border border-slate-200 dark:border-white/10 shrink-0 text-xs">
                          <button
                            type="button"
                            onClick={() => handleToggleLost(mat.id, false)}
                            className={cn(
                              "flex items-center gap-1.5 px-3 py-1 rounded-lg font-bold text-xs transition-all",
                              !state.isLost
                                ? "bg-indigo-600 text-white shadow-sm shadow-indigo-500/20"
                                : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
                            )}
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Returned</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleLost(mat.id, true)}
                            className={cn(
                              "flex items-center gap-1.5 px-3 py-1 rounded-lg font-bold text-xs transition-all",
                              state.isLost
                                ? "bg-rose-600 text-white shadow-sm"
                                : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
                            )}
                          >
                            <AlertTriangle className="w-3.5 h-3.5" />
                            <span>Lost / Missing</span>
                          </button>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/25 shrink-0">
                          <PackageX className="w-3.5 h-3.5" />
                          Missing
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Form fields directly styled without nested double borders */}
                  {state.isLost && (
                    <div className="space-y-4 pt-1 animate-in fade-in duration-200">
                      {/* Field 1: Responsible Member */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-rose-500" />
                            <span>Responsible Team Member</span>
                            <span className="text-rose-500">*</span>
                          </label>
                          {state.responsiblePersonName && !state.isCustomName && (
                            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Attributed: {state.responsiblePersonName}</span>
                            </span>
                          )}
                        </div>

                        <select
                          value={state.isCustomName ? "__custom__" : state.responsiblePersonId || (state.responsiblePersonName ? state.responsiblePersonId : "")}
                          onChange={(e) => handleSelectResponsible(mat.id, e.target.value)}
                          className="w-full text-xs p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white focus:outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/15 font-semibold shadow-xs transition-all"
                        >
                          <option value="">-- Select Responsible Member --</option>
                          <optgroup label="Project Team Members">
                            {memberCandidates.map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.label}
                              </option>
                            ))}
                          </optgroup>
                          <option value="__custom__">➕ Other / Write-in Name...</option>
                        </select>

                        {/* Custom Name field only if selected */}
                        {state.isCustomName && (
                          <div className="pt-2 animate-in fade-in duration-200">
                            <input
                              type="text"
                              required
                              autoFocus
                              placeholder="Enter full name of responsible person"
                              value={state.responsiblePersonName}
                              onChange={(e) => handleCustomNameChange(mat.id, e.target.value)}
                              className="w-full text-xs p-3 rounded-xl bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-500/40 text-slate-800 dark:text-white focus:outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 font-semibold shadow-xs transition-all"
                            />
                          </div>
                        )}
                      </div>

                      {/* Field 2: Reason & Location */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-rose-500" />
                          <span>Reason for Loss / Last Known Location</span>
                          <span className="text-rose-500">*</span>
                        </label>

                        {/* Quick Presets */}
                        <div className="flex flex-wrap gap-1.5 pt-0.5 pb-1">
                          {COMMON_REASONS.map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => handleReasonChange(mat.id, preset)}
                              className={cn(
                                "text-[10px] px-2.5 py-1 rounded-lg border font-medium transition-all active:scale-95",
                                state.reason === preset
                                  ? "bg-rose-50 dark:bg-rose-500/20 text-rose-700 dark:text-rose-300 border-rose-300 dark:border-rose-500/40 shadow-xs font-semibold"
                                  : "bg-slate-100/70 dark:bg-white/5 border-slate-200/80 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-white/20"
                              )}
                            >
                              {preset}
                            </button>
                          ))}
                        </div>

                        <input
                          type="text"
                          required
                          placeholder="e.g. Lost in dense forest during boundary survey near Ch. 12+400"
                          value={state.reason}
                          onChange={(e) => handleReasonChange(mat.id, e.target.value)}
                          className="w-full text-xs p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white focus:outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-500/15 font-medium placeholder:text-slate-400 shadow-xs transition-all"
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="p-4 px-6 border-t border-slate-100 dark:border-white/5 bg-slate-50/70 dark:bg-slate-900/90 flex items-center justify-between">
            <div className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              {!singleMaterial ? (
                <span>
                  <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{returnedCount}</strong> to return &bull;{" "}
                  <strong className={lostCount > 0 ? "text-rose-600 dark:text-rose-400 font-bold" : "text-slate-500"}>
                    {lostCount}
                  </strong>{" "}
                  missing
                </span>
              ) : (
                <span className="text-[11px] text-slate-400">
                  Recorded in project audit history
                </span>
              )}
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-white/10 transition active:scale-95"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={submitting}
                className={cn(
                  "flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white transition-all shadow-md active:scale-95 disabled:opacity-50",
                  singleMaterial
                    ? "bg-rose-600 hover:bg-rose-700 shadow-rose-600/25"
                    : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20"
                )}
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Processing…</span>
                  </>
                ) : singleMaterial ? (
                  <>
                    <PackageX className="w-3.5 h-3.5" />
                    <span>Confirm Lost Equipment</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>
                      {lostCount > 0
                        ? `Submit All (${lostCount} Lost)`
                        : "Submit All to Company"}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
