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
  Sparkles,
  Layers,
  Plus,
  Check,
  Wrench
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
import { DEFAULT_EQUIPMENT_CATALOG } from "@/types/equipment.types";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function parseMaterialNotes(notes?: string | null) {
  if (!notes) return { remarks: "", subparts: [] };
  const subpartsIndex = notes.indexOf("Subparts:");
  if (subpartsIndex === -1) {
    return { remarks: notes, subparts: [] };
  }
  const before = notes.substring(0, subpartsIndex).replace(/\|\s*$/, "").trim();
  const subpartsStr = notes.substring(subpartsIndex + "Subparts:".length).trim();
  const subparts = subpartsStr
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return { remarks: before, subparts };
}

export function parseLostReason(lostReason?: string | null) {
  if (!lostReason) return { lostScopeText: null, reasonText: "" };
  const match = lostReason.match(/^\[Lost:\s*([^\]]+)\]\s*(.*)$/);
  if (match) {
    return {
      lostScopeText: match[1].trim(),
      reasonText: match[2].trim()
    };
  }
  return { lostScopeText: null, reasonText: lostReason };
}

export function getKnownSubpartsForMaterial(mat: any): string[] {
  const { subparts } = parseMaterialNotes(mat?.notes);
  if (subparts && subparts.length > 0) return subparts;

  const itemName = (mat?.item || mat?.item_name || "").toLowerCase().trim();
  const found = DEFAULT_EQUIPMENT_CATALOG.find(
    (c) => c.name.toLowerCase().trim() === itemName
  );
  if (found && found.subparts && found.subparts.length > 0) {
    return found.subparts.map((s) => `${s.defaultQuantity > 1 ? `${s.defaultQuantity}x ` : ""}${s.name}`);
  }
  return [];
}

export function computeLostSummary(
  itemName: string,
  isMainLost: boolean,
  selectedSubparts: string[],
  allAvailableSubparts: string[]
): { summary: string; isFullLoss: boolean; isSubpartsOnly: boolean; isMainOnly: boolean } {
  const hasAvailableSubparts = allAvailableSubparts.length > 0;

  if (isMainLost && (!hasAvailableSubparts || (selectedSubparts.length === allAvailableSubparts.length && allAvailableSubparts.length > 0))) {
    return {
      summary: hasAvailableSubparts ? "Full Equipment & All Sub-parts" : "Main Equipment Unit",
      isFullLoss: true,
      isSubpartsOnly: false,
      isMainOnly: !hasAvailableSubparts
    };
  }

  if (isMainLost && selectedSubparts.length === 0) {
    return {
      summary: "Main Equipment Unit Only (Sub-parts Safe)",
      isFullLoss: false,
      isSubpartsOnly: false,
      isMainOnly: true
    };
  }

  if (!isMainLost && selectedSubparts.length > 0) {
    return {
      summary: `Sub-equipment Only: ${selectedSubparts.join(", ")} (Main Unit Safe)`,
      isFullLoss: false,
      isSubpartsOnly: true,
      isMainOnly: false
    };
  }

  return {
    summary: `Main Unit + Sub-parts: ${selectedSubparts.join(", ")}`,
    isFullLoss: false,
    isSubpartsOnly: false,
    isMainOnly: false
  };
}

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
  isMainUnitLost: boolean;
  selectedSubparts: string[];
  customSubparts: string[];
  newSubpartInput: string;
  showAddCustomSubpart: boolean;
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
      const knownSubparts = getKnownSubpartsForMaterial(mat);

      initial[mat.id] = {
        isLost: isSingleMode ? true : false,
        responsiblePersonId: defaultPersonId,
        responsiblePersonName: defaultPersonName,
        isCustomName: false,
        reason: mat.lost_reason || "",
        isMainUnitLost: true,
        selectedSubparts: [...knownSubparts],
        customSubparts: [],
        newSubpartInput: "",
        showAddCustomSubpart: false
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
          reason: "",
          isMainUnitLost: true,
          selectedSubparts: [],
          customSubparts: [],
          newSubpartInput: "",
          showAddCustomSubpart: false
        }),
        isLost
      }
    }));
  };

  const handleToggleMainUnit = (matId: string, isChecked: boolean) => {
    setItemsState((prev) => ({
      ...prev,
      [matId]: {
        ...prev[matId],
        isMainUnitLost: isChecked
      }
    }));
  };

  const handleToggleSubpart = (matId: string, subpart: string, isChecked: boolean) => {
    setItemsState((prev) => {
      const cur = prev[matId];
      const currentSelected = cur?.selectedSubparts || [];
      const updated = isChecked
        ? [...currentSelected, subpart]
        : currentSelected.filter((s) => s !== subpart);
      return {
        ...prev,
        [matId]: {
          ...cur,
          selectedSubparts: updated
        }
      };
    });
  };

  const handleSelectPreset = (
    matId: string,
    preset: 'all' | 'main_only' | 'subparts_only',
    allAvailableSubparts: string[]
  ) => {
    setItemsState((prev) => {
      const cur = prev[matId];
      if (preset === 'all') {
        return {
          ...prev,
          [matId]: {
            ...cur,
            isMainUnitLost: true,
            selectedSubparts: [...allAvailableSubparts]
          }
        };
      }
      if (preset === 'main_only') {
        return {
          ...prev,
          [matId]: {
            ...cur,
            isMainUnitLost: true,
            selectedSubparts: []
          }
        };
      }
      if (preset === 'subparts_only') {
        return {
          ...prev,
          [matId]: {
            ...cur,
            isMainUnitLost: false,
            selectedSubparts: allAvailableSubparts.length > 0 ? [...allAvailableSubparts] : []
          }
        };
      }
      return prev;
    });
  };

  const handleAddCustomSubpart = (matId: string) => {
    setItemsState((prev) => {
      const cur = prev[matId];
      const name = (cur?.newSubpartInput || "").trim();
      if (!name) return prev;
      const customList = cur?.customSubparts || [];
      const selected = cur?.selectedSubparts || [];
      if (customList.includes(name)) {
        return {
          ...prev,
          [matId]: {
            ...cur,
            newSubpartInput: "",
            showAddCustomSubpart: false,
            selectedSubparts: selected.includes(name) ? selected : [...selected, name]
          }
        };
      }
      return {
        ...prev,
        [matId]: {
          ...cur,
          customSubparts: [...customList, name],
          selectedSubparts: [...selected, name],
          newSubpartInput: "",
          showAddCustomSubpart: false
        }
      };
    });
  };

  const handleSelectResponsible = (matId: string, val: string) => {
    setItemsState((prev) => {
      const cur = prev[matId] || {
        isLost: true,
        responsiblePersonId: "",
        responsiblePersonName: "",
        isCustomName: false,
        reason: "",
        isMainUnitLost: true,
        selectedSubparts: [],
        customSubparts: [],
        newSubpartInput: "",
        showAddCustomSubpart: false
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

    // Validate that every lost item has a responsible person name, reason, and at least one component selected
    for (const m of displayedMaterials) {
      const state = itemsState[m.id];
      if (state?.isLost) {
        const hasMain = state.isMainUnitLost;
        const hasSubs = (state.selectedSubparts || []).length > 0;
        if (!hasMain && !hasSubs) {
          toast.error(`Please select what is lost for "${m.item || m.item_name}" (main equipment or at least one sub-equipment).`);
          return;
        }
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
        const userReason = state.reason.trim();
        const respId = state.responsiblePersonId || undefined;
        const allSubs = [...getKnownSubpartsForMaterial(singleMaterial), ...(state.customSubparts || [])];
        const { summary } = computeLostSummary(
          singleMaterial.item || singleMaterial.item_name,
          state.isMainUnitLost,
          state.selectedSubparts || [],
          allSubs
        );
        const finalReason = `[Lost: ${summary}] ${userReason}`;

        // Optimistically update UI immediately
        if (onOptimisticLostSubmit) {
          onOptimisticLostSubmit(singleMaterial.id, { responsiblePersonName: respName, reason: finalReason });
        }
        onOpenChange(false);
        toast.success(`Reporting "${singleMaterial.item || singleMaterial.item_name}" as lost...`);

        const res = await markMaterialLostAction(
          singleMaterial.id,
          respId,
          respName,
          finalReason,
          true,
          summary
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
            const allSubs = [...getKnownSubpartsForMaterial(m), ...(state.customSubparts || [])];
            const { summary } = computeLostSummary(
              m.item || m.item_name,
              state.isMainUnitLost,
              state.selectedSubparts || [],
              allSubs
            );
            const finalReason = `[Lost: ${summary}] ${state.reason.trim()}`;
            missingInputs.push({
              materialId: m.id,
              responsiblePersonId: state.responsiblePersonId || undefined,
              responsiblePersonName: state.responsiblePersonName.trim(),
              reason: finalReason,
              lostItemsSummary: summary
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
      <DialogContent className="max-w-2xl sm:max-w-3xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 shadow-2xl rounded-3xl text-slate-900 dark:text-white">
        
        {/* Header */}
        <div className="p-6 pb-5 border-b border-slate-100 dark:border-white/5 bg-gradient-to-r from-slate-50 via-white to-indigo-50/30 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800/80 flex items-start gap-4">
          <div className={cn(
            "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border shadow-xs transition-transform duration-200",
            singleMaterial
              ? "bg-amber-500/10 border-amber-500/25 text-amber-600 dark:text-amber-400"
              : "bg-indigo-500/10 border-indigo-500/25 text-indigo-600 dark:text-indigo-400"
          )}>
            {singleMaterial ? <PackageX className="w-6 h-6" /> : <Package className="w-6 h-6" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <DialogTitle className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                {singleMaterial ? "Report Equipment Lost / Missing" : "Submit Assigned Materials to Company"}
              </DialogTitle>
              {singleMaterial && (
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10">
                  Project Asset
                </span>
              )}
            </div>
            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
              {singleMaterial
                ? "Select whether the primary equipment or specific sub-equipments are missing, and attribute responsibility."
                : "Account for all project equipment. Items reported missing require an attributed responsible member."}
            </DialogDescription>
          </div>
        </div>

        {/* Scrollable list of items */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
            
            {/* Informative notice banner */}
            <div className="flex items-center gap-3.5 p-3.5 rounded-2xl bg-amber-500/[0.06] border border-amber-500/20 text-xs text-amber-900 dark:text-amber-200 shadow-2xs">
              <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center shrink-0">
                <ShieldAlert className="w-4 h-4 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="leading-relaxed text-[11.5px] min-w-0">
                <strong className="font-semibold text-amber-950 dark:text-amber-100">Audit & Accountability Gate:</strong> Attributing a responsible member records an official audit entry for company administration while allowing workflow progression.
              </div>
            </div>

            {displayedMaterials.map((mat) => {
              const state = itemsState[mat.id] || {
                isLost: false,
                responsiblePersonId: "",
                responsiblePersonName: "",
                isCustomName: false,
                reason: "",
                isMainUnitLost: true,
                selectedSubparts: [],
                customSubparts: [],
                newSubpartInput: "",
                showAddCustomSubpart: false
              };
              const qty = Number(mat.quantity) || 1;
              const knownSubs = getKnownSubpartsForMaterial(mat);
              const allAvailableSubparts = [...knownSubs, ...(state.customSubparts || [])];
              const summaryInfo = computeLostSummary(
                mat.item || mat.item_name,
                state.isMainUnitLost,
                state.selectedSubparts || [],
                allAvailableSubparts
              );

              return (
                <div key={mat.id} className="space-y-4">
                  {/* Single Item Overview Card */}
                  <div className={cn(
                    "p-4 rounded-2xl border transition-all duration-200 shadow-xs",
                    state.isLost
                      ? "bg-slate-50/80 dark:bg-slate-800/40 border-slate-300 dark:border-white/15"
                      : "bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10"
                  )}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3.5 min-w-0">
                        <div className={cn(
                          "w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border mt-0.5 shadow-xs",
                          state.isLost
                            ? "bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300"
                            : "bg-indigo-50 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400"
                        )}>
                          {state.isLost ? <PackageX className="w-5 h-5 text-slate-700 dark:text-slate-300" /> : <Package className="w-5 h-5" />}
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
                            {mat.notes && (() => {
                              const { remarks, subparts } = parseMaterialNotes(mat.notes);
                              return (
                                <>
                                  {remarks && (
                                    <>
                                      <span>&bull;</span>
                                      <span className="italic truncate">{remarks}</span>
                                    </>
                                  )}
                                  {subparts.length > 0 && (
                                    <>
                                      <span>&bull;</span>
                                      <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                                        {subparts.length} {subparts.length === 1 ? 'sub-part' : 'sub-parts'} attached
                                      </span>
                                    </>
                                  )}
                                </>
                              );
                            })()}
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
                                ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-sm"
                                : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white"
                            )}
                          >
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                            <span>Lost / Missing</span>
                          </button>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-bold px-3 py-1 rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/25 shrink-0 shadow-2xs">
                          <PackageX className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                          Missing Report
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Form fields directly styled without nested double borders */}
                  {state.isLost && (
                    <div className="space-y-4 pt-1 animate-in fade-in duration-200">
                      {/* Component Breakdown: Main Equipment vs Sub-equipments */}
                      <div className="space-y-3.5 p-4 sm:p-5 rounded-2xl bg-slate-50/70 dark:bg-slate-800/30 border border-slate-200/80 dark:border-white/10 shadow-2xs">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                            <Layers className="w-4 h-4 text-indigo-500" />
                            <span>Select Loss Scope (Main Instrument vs Sub-equipments)</span>
                            <span className="text-amber-500">*</span>
                          </label>
                          
                          <span className={cn(
                            "text-[10px] font-bold px-3 py-1 rounded-full border flex items-center gap-1.5 shrink-0 shadow-2xs transition-all",
                            summaryInfo.isSubpartsOnly
                              ? "bg-indigo-50 dark:bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-500/30"
                              : summaryInfo.isMainOnly
                                ? "bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-500/30"
                                : summaryInfo.isFullLoss
                                  ? "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-white/15"
                                  : "bg-indigo-50/50 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-white/15"
                          )}>
                            {summaryInfo.isSubpartsOnly && "🧩 Sub-parts Only (Main Unit Safe)"}
                            {summaryInfo.isMainOnly && "🎯 Main Instrument Only"}
                            {summaryInfo.isFullLoss && "📦 Entire Kit & All Parts"}
                            {!summaryInfo.isSubpartsOnly && !summaryInfo.isMainOnly && !summaryInfo.isFullLoss && "⚠️ Main Unit + Selected Parts"}
                          </span>
                        </div>

                        <p className="text-[11px] text-slate-500 dark:text-slate-400">
                          Specify whether the entire primary equipment unit was lost, or only specific sub-components / accessories:
                        </p>

                        {/* Quick Presets */}
                        <div className="flex items-center gap-2 flex-wrap pt-0.5">
                          <button
                            type="button"
                            onClick={() => handleSelectPreset(mat.id, 'all', allAvailableSubparts)}
                            className={cn(
                              "text-xs px-3.5 py-1.5 rounded-xl border font-bold transition-all flex items-center gap-1.5 active:scale-95 shadow-2xs",
                              summaryInfo.isFullLoss
                                ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white shadow-xs"
                                : "bg-white dark:bg-slate-800/80 border-slate-200/90 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:border-slate-300 hover:bg-slate-50"
                            )}
                          >
                            <Package className="w-3.5 h-3.5" />
                            <span>Entire Kit (All Parts)</span>
                          </button>

                          {allAvailableSubparts.length > 0 && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleSelectPreset(mat.id, 'main_only', allAvailableSubparts)}
                                className={cn(
                                  "text-xs px-3.5 py-1.5 rounded-xl border font-bold transition-all flex items-center gap-1.5 active:scale-95 shadow-2xs",
                                  summaryInfo.isMainOnly
                                    ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white shadow-xs"
                                    : "bg-white dark:bg-slate-800/80 border-slate-200/90 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:border-slate-300 hover:bg-slate-50"
                                )}
                              >
                                <PackageX className="w-3.5 h-3.5" />
                                <span>Main Unit Only</span>
                              </button>

                              <button
                                type="button"
                                onClick={() => handleSelectPreset(mat.id, 'subparts_only', allAvailableSubparts)}
                                className={cn(
                                  "text-xs px-3.5 py-1.5 rounded-xl border font-bold transition-all flex items-center gap-1.5 active:scale-95 shadow-2xs",
                                  summaryInfo.isSubpartsOnly
                                    ? "bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-600/25"
                                    : "bg-white dark:bg-slate-800/80 border-slate-200/90 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:border-slate-300 hover:bg-slate-50"
                                )}
                              >
                                <Layers className="w-3.5 h-3.5" />
                                <span>Sub-equipment(s) Only</span>
                              </button>
                            </>
                          )}
                        </div>

                        {/* Checklist Box */}
                        <div className="space-y-2.5 pt-1">
                          {/* 1. Main Unit */}
                          <label className={cn(
                            "flex items-center justify-between p-3.5 rounded-xl border text-xs cursor-pointer select-none transition-all duration-200",
                            state.isMainUnitLost
                              ? "bg-white dark:bg-slate-800 border-slate-400 dark:border-white/30 text-slate-900 dark:text-white shadow-xs font-semibold ring-1 ring-slate-400/20"
                              : "bg-white/60 dark:bg-white/[0.02] border-slate-200/70 dark:border-white/5 text-slate-400 opacity-70 hover:opacity-100 hover:border-slate-300"
                          )}>
                            <div className="flex items-center gap-3 min-w-0">
                              <input
                                type="checkbox"
                                checked={state.isMainUnitLost}
                                onChange={(e) => handleToggleMainUnit(mat.id, e.target.checked)}
                                className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 shrink-0 cursor-pointer"
                              />
                              <div className="flex items-center gap-2.5 min-w-0">
                                <Package className={cn("w-4 h-4 shrink-0", state.isMainUnitLost ? "text-indigo-600 dark:text-indigo-400" : "text-slate-400")} />
                                <span className="font-bold truncate text-[13px]">
                                  {mat.item || mat.item_name}
                                </span>
                              </div>
                            </div>
                            <span className={cn(
                              "text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider shrink-0 ml-2 border",
                              state.isMainUnitLost
                                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900 border-transparent shadow-2xs"
                                : "bg-slate-100 dark:bg-white/10 text-slate-400 border-slate-200 dark:border-white/10"
                            )}>
                              {state.isMainUnitLost ? "Primary Unit • Missing" : "Primary Unit • Safe"}
                            </span>
                          </label>

                          {/* 2. Sub-equipments Checklist */}
                          {allAvailableSubparts.length > 0 && (
                            <div className="space-y-2 pt-1">
                              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
                                <span className="flex items-center gap-1">
                                  <Layers className="w-3 h-3 text-indigo-500" />
                                  <span>Sub-parts & Component Accessories ({allAvailableSubparts.length})</span>
                                </span>
                                <span className="text-[10px] text-slate-400 font-medium">
                                  {(state.selectedSubparts || []).length} of {allAvailableSubparts.length} missing
                                </span>
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-56 overflow-y-auto pr-1 custom-scrollbar">
                                {allAvailableSubparts.map((subpart) => {
                                  const isChecked = (state.selectedSubparts || []).includes(subpart);
                                  return (
                                    <label
                                      key={subpart}
                                      className={cn(
                                        "flex items-center justify-between p-3 rounded-xl border text-xs cursor-pointer select-none transition-all duration-200",
                                        isChecked
                                          ? "bg-indigo-50/80 dark:bg-indigo-500/15 border-indigo-300 dark:border-indigo-500/35 text-slate-900 dark:text-white shadow-2xs font-semibold ring-1 ring-indigo-500/15"
                                          : "bg-white/70 dark:bg-white/[0.02] border-slate-200/70 dark:border-white/5 text-slate-400 opacity-75 hover:opacity-100 hover:border-slate-300"
                                      )}
                                    >
                                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                        <input
                                          type="checkbox"
                                          checked={isChecked}
                                          onChange={(e) => handleToggleSubpart(mat.id, subpart, e.target.checked)}
                                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 shrink-0 cursor-pointer"
                                        />
                                        <span className="text-xs truncate font-medium" title={subpart}>
                                          {subpart}
                                        </span>
                                      </div>
                                      {isChecked && (
                                        <span className="text-[9px] font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-100/70 dark:bg-indigo-500/25 px-2 py-0.5 rounded-md ml-1.5 shrink-0 uppercase tracking-wide">
                                          Missing
                                        </span>
                                      )}
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Add unlisted custom sub-part */}
                          <div className="pt-1">
                            {state.showAddCustomSubpart ? (
                              <div className="flex items-center gap-2 pt-1 animate-in fade-in duration-150">
                                <input
                                  type="text"
                                  placeholder="e.g. Battery Charger, Tripod Clamp, Lens Cap..."
                                  value={state.newSubpartInput || ""}
                                  onChange={(e) =>
                                    setItemsState((prev) => ({
                                      ...prev,
                                      [mat.id]: {
                                        ...prev[mat.id],
                                        newSubpartInput: e.target.value
                                      }
                                    }))
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      handleAddCustomSubpart(mat.id);
                                    }
                                  }}
                                  className="flex-1 text-xs p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleAddCustomSubpart(mat.id)}
                                  className="px-4 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-indigo-600 dark:hover:bg-indigo-500 text-white font-bold text-xs transition active:scale-95 shrink-0 shadow-xs"
                                >
                                  Add Part
                                </button>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setItemsState((prev) => ({
                                      ...prev,
                                      [mat.id]: {
                                        ...prev[mat.id],
                                        showAddCustomSubpart: false
                                      }
                                    }))
                                  }
                                  className="px-3 py-2 text-xs text-slate-400 hover:text-slate-600 transition"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                type="button"
                                onClick={() =>
                                  setItemsState((prev) => ({
                                    ...prev,
                                    [mat.id]: {
                                      ...prev[mat.id],
                                      showAddCustomSubpart: true
                                    }
                                  }))
                                }
                                className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 flex items-center gap-1.5 transition py-1"
                              >
                                <Plus className="w-3.5 h-3.5" />
                                <span>+ Add other unlisted accessory / sub-part</span>
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Contextual guidance pill */}
                        {summaryInfo.isSubpartsOnly ? (
                          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-indigo-500/[0.08] border border-indigo-500/20 text-xs text-indigo-900 dark:text-indigo-200">
                            <CheckCircle2 className="w-4 h-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
                            <span className="text-[11.5px] leading-tight">
                              <strong>Sub-parts only missing:</strong> Main instrument ({mat.item || mat.item_name}) remains safe and accounted for. Only missing sub-equipments are recorded under the responsible person.
                            </span>
                          </div>
                        ) : summaryInfo.isMainOnly ? (
                          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-amber-500/[0.08] border border-amber-500/20 text-xs text-amber-900 dark:text-amber-200">
                            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                            <span className="text-[11.5px] leading-tight">
                              <strong>Main Instrument missing:</strong> All accessories and sub-parts are reported safe, but the primary instrument unit is reported missing.
                            </span>
                          </div>
                        ) : null}
                      </div>

                      {/* Field 1: Responsible Member */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-indigo-500" />
                            <span>Responsible Team Member</span>
                            <span className="text-amber-500">*</span>
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
                          className="w-full text-xs p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 font-semibold shadow-2xs transition-all"
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
                              className="w-full text-xs p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-white/20 text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 font-semibold shadow-2xs transition-all"
                            />
                          </div>
                        )}
                      </div>

                      {/* Field 2: Reason & Location */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-indigo-500" />
                          <span>Reason for Loss / Last Known Location</span>
                          <span className="text-amber-500">*</span>
                        </label>

                        {/* Quick Presets */}
                        <div className="flex flex-wrap gap-1.5 pt-0.5 pb-1">
                          {COMMON_REASONS.map((preset) => (
                            <button
                              key={preset}
                              type="button"
                              onClick={() => handleReasonChange(mat.id, preset)}
                              className={cn(
                                "text-[11px] px-3 py-1.5 rounded-lg border font-medium transition-all active:scale-95 shadow-2xs",
                                state.reason === preset
                                  ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white shadow-xs font-semibold"
                                  : "bg-slate-100/80 dark:bg-white/5 border-slate-200/80 dark:border-white/10 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-white/20"
                              )}
                            >
                              {preset}
                            </button>
                          ))}
                        </div>

                        <input
                          type="text"
                          required
                          placeholder="e.g. Lost in dense vegetation near boundary pillar #4 during afternoon survey"
                          value={state.reason}
                          onChange={(e) => handleReasonChange(mat.id, e.target.value)}
                          className="w-full text-xs p-3.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 text-slate-800 dark:text-white focus:outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/15 font-medium placeholder:text-slate-400 shadow-2xs transition-all"
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
                  <strong className={lostCount > 0 ? "text-amber-600 dark:text-amber-400 font-bold" : "text-slate-500"}>
                    {lostCount}
                  </strong>{" "}
                  missing
                </span>
              ) : (
                <span className="text-[11px] text-slate-400">
                  Recorded in project audit history &bull; Admin review gate
                </span>
              )}
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-white/10 transition active:scale-95"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={submitting}
                className={cn(
                  "flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs font-bold text-white transition-all shadow-md active:scale-95 disabled:opacity-50",
                  singleMaterial
                    ? "bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 hover:from-slate-800 hover:to-indigo-900 dark:from-indigo-600 dark:to-indigo-700 shadow-slate-900/20"
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
                    <span>
                      {itemsState[singleMaterial.id]?.isMainUnitLost === false && (itemsState[singleMaterial.id]?.selectedSubparts || []).length > 0
                        ? "Confirm Lost Sub-equipment"
                        : "Confirm Lost Equipment"}
                    </span>
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
