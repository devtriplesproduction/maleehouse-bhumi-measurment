"use client";

import React, { useState, useEffect, useCallback } from "react";
import { 
  Package, CheckCircle2, Clock, Plus, AlertCircle, 
  Trash2, RotateCcw, PackageX, X, Check, User, Wrench
} from "lucide-react";
import { 
  assignMaterialToProjectAction, 
  getProjectMaterialsAction, 
  submitMaterialToCompanyAction, 
  deleteProjectMaterialAction 
} from "@/actions/field.actions";
import { SubmitMaterialsModal } from "@/components/modules/SubmitMaterialsModal";
import { Select, SelectItem } from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface StaffMember {
  id: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
}

interface ProjectMaterialsSectionProps {
  projectId: string;
  assignments: any[];
  staff: StaffMember[];
  canAssign: boolean;
  initialMaterials?: any[];
}

const COMMON_MATERIALS = [
  "Total Station",
  "DGPS Rover Unit",
  "DGPS Base Station",
  "Survey Drone / UAV",
  "Tripod & Tribrach",
  "Auto Level",
  "Prism Pole & Target",
  "Measuring Tape"
];

export function ProjectMaterialsSection({ projectId, assignments, staff, canAssign, initialMaterials }: ProjectMaterialsSectionProps) {
  const [materials, setMaterials] = useState<any[]>(initialMaterials || []);
  const [loadingMaterials, setLoadingMaterials] = useState(!initialMaterials || initialMaterials.length === 0);
  const [loading, setLoading] = useState(false);
  const [isAssigningMaterial, setIsAssigningMaterial] = useState(false);
  const [materialItemName, setMaterialItemName] = useState("");
  const [materialQty, setMaterialQty] = useState("1");
  const [materialNotes, setMaterialNotes] = useState("");
  const [materialAssignedTo, setMaterialAssignedTo] = useState("");
  const [submittingMaterial, setSubmittingMaterial] = useState(false);

  // Submit / Lost Modal State
  const [isSubmitModalOpen, setIsSubmitModalOpen] = useState(false);
  const [modalSingleMaterial, setModalSingleMaterial] = useState<any | null>(null);

  const fetchMaterials = useCallback(async (silent = false) => {
    if (!silent) setLoadingMaterials(true);
    try {
      const res = await getProjectMaterialsAction(projectId);
      if (res.success && res.data) {
        setMaterials(res.data);
      }
    } catch (e) {
      console.error("Failed to load materials", e);
    } finally {
      if (!silent) setLoadingMaterials(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (initialMaterials && initialMaterials.length > 0) {
      setMaterials(initialMaterials);
      setLoadingMaterials(false);
    } else {
      fetchMaterials();
    }
  }, [projectId, initialMaterials, fetchMaterials]);

  const handleAssignMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!materialItemName.trim()) {
      toast.error("Please enter or select a material name");
      return;
    }
    setSubmittingMaterial(true);
    try {
      const res = await assignMaterialToProjectAction(
        projectId,
        materialItemName.trim(),
        Number(materialQty) || 1,
        materialNotes.trim() || undefined,
        materialAssignedTo || undefined
      );

      if (res.success) {
        toast.success("Material / Equipment assigned to project");
        setMaterialItemName("");
        setMaterialQty("1");
        setMaterialNotes("");
        setMaterialAssignedTo("");
        setIsAssigningMaterial(false);
        fetchMaterials(true);
      } else {
        toast.error(res.error || "Failed to assign material");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to assign material");
    } finally {
      setSubmittingMaterial(false);
    }
  };

  const handleSubmitToCompany = async (materialId: string, itemName: string) => {
    // Optimistic UI: update immediately with 0ms delay
    const prev = [...materials];
    setMaterials(prevList => prevList.map(m =>
      m.id === materialId
        ? { ...m, status: 'submitted', submitted_at: new Date().toISOString() }
        : m
    ));
    toast.success(`"${itemName}" submitted to company`);

    try {
      const res = await submitMaterialToCompanyAction(materialId);
      if (!res.success) {
        setMaterials(prev);
        toast.error(res.error || "Failed to submit material");
      } else {
        fetchMaterials(true);
      }
    } catch (err: any) {
      setMaterials(prev);
      toast.error(err.message || "Failed to submit material");
    }
  };

  const handleDeleteMaterial = async (materialId: string) => {
    if (!confirm("Are you sure you want to remove this assigned material?")) return;
    const prev = [...materials];
    setMaterials(prevList => prevList.filter(m => m.id !== materialId));
    toast.success("Material removed");

    try {
      const res = await deleteProjectMaterialAction(materialId, projectId);
      if (!res.success) {
        setMaterials(prev);
        toast.error(res.error || "Failed to remove material");
      } else {
        fetchMaterials(true);
      }
    } catch (err: any) {
      setMaterials(prev);
      toast.error(err.message || "Failed to remove material");
    }
  };

  const handleOptimisticBulkSubmit = (missingInputs: any[]) => {
    const missingMap = new Map(missingInputs.map((m: any) => [m.materialId, m]));
    setMaterials(prev => prev.map(m => {
      if (m.status !== 'assigned' && m.status !== 'requested') return m;
      if (missingMap.has(m.id)) {
        const info = missingMap.get(m.id);
        return {
          ...m,
          status: 'lost',
          responsible_person_name: info.responsiblePersonName,
          lost_reason: info.reason,
          lost_reported_at: new Date().toISOString()
        };
      }
      return {
        ...m,
        status: 'submitted',
        submitted_at: new Date().toISOString()
      };
    }));
  };

  const handleOptimisticLostSubmit = (materialId: string, info: { responsiblePersonName: string; reason: string }) => {
    setMaterials(prev => prev.map(m =>
      m.id === materialId
        ? {
            ...m,
            status: 'lost',
            responsible_person_name: info.responsiblePersonName,
            lost_reason: info.reason,
            lost_reported_at: new Date().toISOString()
          }
        : m
    ));
  };

  const handleOpenSubmitAll = () => {
    setModalSingleMaterial(null);
    setIsSubmitModalOpen(true);
  };

  const handleOpenReportLost = (mat: any) => {
    setModalSingleMaterial(mat);
    setIsSubmitModalOpen(true);
  };

  const filteredAssignments = assignments.filter((a: any) => a.role !== 'admin');
  const pendingMaterials = materials.filter(m => m.status === 'assigned' || m.status === 'requested');
  const pendingMaterialsCount = pendingMaterials.length;
  const lostMaterialsCount = materials.filter(m => m.status === 'lost' || m.status === 'missing').length;

  // Total unit quantities (summing actual item quantities)
  const totalUnits = materials.reduce((sum, m) => sum + (Number(m.quantity) || 1), 0);
  const pendingUnits = pendingMaterials.reduce((sum, m) => sum + (Number(m.quantity) || 1), 0);
  const lostUnits = materials
    .filter(m => m.status === 'lost' || m.status === 'missing')
    .reduce((sum, m) => sum + (Number(m.quantity) || 1), 0);

  return (
    <div className="glass-card p-6 transition-all duration-300">
      {/* ── Card Header ── */}
      <div className="flex items-center justify-between gap-3 mb-5 pb-4 border-b border-slate-200/60 dark:border-white/5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500/15 to-purple-500/15 border border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-sm shrink-0">
            <Package className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight whitespace-nowrap">
              Assigned Materials
            </h3>
            {materials.length > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-white/10 shrink-0">
                {totalUnits} {totalUnits === 1 ? 'Unit' : 'Units'} ({materials.length})
              </span>
            )}
          </div>
        </div>

        {canAssign && (
          <div className="flex items-center gap-2 shrink-0">
            {!isAssigningMaterial && (
              <button
                type="button"
                onClick={() => setIsAssigningMaterial(true)}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-sm shadow-indigo-500/20 active:scale-95"
                title="Assign Material"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Assign Material</span>
              </button>
            )}
          </div>
        )}
      </div>

      <div className="space-y-4">
        {/* ── Status Summary Banner with Total Units & Submit All ── */}
        <div className="p-2.5 sm:p-3 rounded-xl bg-slate-50/70 dark:bg-white/[0.02] border border-slate-200/70 dark:border-white/5 transition-all">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className={cn(
                "w-7.5 h-7.5 rounded-lg flex items-center justify-center shrink-0 border",
                pendingUnits > 0
                  ? "bg-amber-500/10 border-amber-500/25 text-amber-600 dark:text-amber-400"
                  : materials.length > 0
                    ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-600 dark:text-emerald-400"
                    : "bg-slate-100 dark:bg-white/10 border-slate-200 dark:border-white/10 text-slate-400"
              )}>
                {pendingUnits > 0 ? (
                  <AlertCircle className="w-3.5 h-3.5" />
                ) : materials.length > 0 ? (
                  <CheckCircle2 className="w-3.5 h-3.5" />
                ) : (
                  <Package className="w-3.5 h-3.5" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-slate-800 dark:text-white">
                  {materials.length === 0 
                    ? "No Equipment Assigned" 
                    : `${totalUnits} Total ${totalUnits === 1 ? 'Unit' : 'Units'} Allocated (${materials.length} ${materials.length === 1 ? 'Equipment Type' : 'Equipment Types'})`}
                </p>
                <div className="flex items-center gap-2 text-[10.5px] font-medium mt-0.5 flex-wrap">
                  {pendingUnits > 0 ? (
                    <span className="text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                      <Clock className="w-3 h-3 inline" />
                      {pendingUnits} {pendingUnits === 1 ? 'Unit' : 'Units'} in Field
                    </span>
                  ) : materials.length > 0 ? (
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                      <Check className="w-3 h-3 inline" />
                      All {totalUnits} {totalUnits === 1 ? 'unit' : 'units'} submitted to company
                    </span>
                  ) : (
                    <span className="text-slate-400">Allocate tools and equipment to field team</span>
                  )}
                  {lostUnits > 0 && (
                    <span className="text-rose-600 dark:text-rose-400 font-semibold flex items-center gap-1 pl-2 border-l border-slate-200 dark:border-white/10">
                      <PackageX className="w-3 h-3 inline" />
                      {lostUnits} {lostUnits === 1 ? 'Unit' : 'Units'} Reported Lost
                    </span>
                  )}
                </div>
              </div>
            </div>

            {canAssign && pendingUnits > 0 && (
              <button
                type="button"
                disabled={loading}
                onClick={handleOpenSubmitAll}
                className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-sm shadow-emerald-500/20 active:scale-95 shrink-0 ml-auto"
                title="Mark all assigned materials submitted to company or report missing items"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Submit All ({pendingUnits} Units)</span>
              </button>
            )}
          </div>
        </div>

        {/* ── Assign Material Form ── */}
        {isAssigningMaterial && (
          <form onSubmit={handleAssignMaterial} className="p-4 rounded-2xl bg-slate-50/90 dark:bg-white/[0.03] border border-indigo-500/20 shadow-sm space-y-3.5 animate-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 dark:border-white/5">
              <span className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5 text-indigo-500" />
                Assign New Equipment
              </span>
              <button 
                type="button" 
                onClick={() => setIsAssigningMaterial(false)} 
                className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-white/10 transition"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Quick Presets */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Quick Select Equipment</label>
              <div className="flex flex-wrap gap-1.5">
                {COMMON_MATERIALS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setMaterialItemName(preset)}
                    className={cn(
                      "text-[10px] px-2.5 py-1 rounded-lg border font-semibold transition-all",
                      materialItemName === preset
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                        : "bg-white dark:bg-slate-900/60 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:border-indigo-400"
                    )}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Item Name & Qty */}
            <div className="grid grid-cols-3 gap-2.5">
              <div className="col-span-2 space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Item Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Total Station Leica TS07"
                  value={materialItemName}
                  onChange={(e) => setMaterialItemName(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 focus:outline-none focus:border-indigo-500 font-medium"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Quantity (Units)</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={materialQty}
                  onChange={(e) => setMaterialQty(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 focus:outline-none focus:border-indigo-500 font-medium font-bold"
                />
              </div>
            </div>

            {/* Assign To (Team member) */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Handed Over To (Team Member)</label>
              <Select
                value={materialAssignedTo}
                onValueChange={setMaterialAssignedTo}
                placeholder="General Project Allocation (Unassigned)"
                buttonClassName="text-xs py-2 bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10"
              >
                <SelectItem value="" className="text-xs py-2">General Project Allocation (Unassigned)</SelectItem>
                {filteredAssignments.map((a: any) => {
                  const name = a.firstName || a.lastName ? `${a.firstName || ''} ${a.lastName || ''}`.trim() : a.profiles?.first_name ? `${a.profiles?.first_name} ${a.profiles?.last_name || ''}`.trim() : a.userId || a.id;
                  const role = (a.role || '').replace('_', ' ');
                  return (
                    <SelectItem key={a.userId || a.id} value={a.userId || a.id} className="text-xs py-2">
                      {name} ({role})
                    </SelectItem>
                  );
                })}
              </Select>
            </div>

            {/* Notes / Serial No */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Serial No. / Remarks</label>
              <input
                type="text"
                placeholder="e.g. S/N: 77894, 2 Batteries, Charger & Case"
                value={materialNotes}
                onChange={(e) => setMaterialNotes(e.target.value)}
                className="w-full text-xs p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 focus:outline-none focus:border-indigo-500 font-medium"
              />
            </div>

            <button
              type="submit"
              disabled={submittingMaterial}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold tracking-wide transition-all shadow-sm shadow-indigo-500/20 active:scale-[0.99] disabled:opacity-50"
            >
              {submittingMaterial ? "Assigning Material..." : "Confirm Material Assignment"}
            </button>
          </form>
        )}

        {/* ── Material Items List ── */}
        {loadingMaterials ? (
          <div className="text-center py-8 text-slate-400 text-xs">Loading assigned materials…</div>
        ) : materials.length === 0 ? (
          <div className="text-center py-10 px-4 rounded-2xl border border-dashed border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.01]">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500 flex items-center justify-center mx-auto mb-3">
              <Package className="w-6 h-6" />
            </div>
            <p className="font-bold text-xs text-slate-700 dark:text-slate-300">No materials assigned yet</p>
            <p className="text-[11px] text-slate-400 mt-1 max-w-[260px] mx-auto leading-relaxed">
              Click &quot;Assign Material&quot; above to allocate survey equipment to the project and field crew.
            </p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1 custom-scrollbar">
            {materials.map((mat) => {
              const isSubmitted = mat.status === 'submitted' || mat.status === 'returned';
              const isLost = mat.status === 'lost' || mat.status === 'missing';
              const qty = Number(mat.quantity) || 1;

              return (
                <div
                  key={mat.id}
                  className="p-2.5 rounded-xl bg-slate-50/60 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/5 hover:border-indigo-500/30 hover:bg-white dark:hover:bg-white/[0.04] transition-all duration-200 space-y-2 group"
                >
                  {/* Top Row: Icon + Name & Qty Badge + Status Pill + Delete */}
                  <div className="flex items-start justify-between gap-2.5">
                    <div className="flex items-start gap-2.5 min-w-0 flex-1">
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border mt-0.5 transition-transform duration-200 group-hover:scale-105",
                        isLost
                          ? "bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400"
                          : isSubmitted
                            ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                            : "bg-indigo-500/10 border-indigo-500/20 text-indigo-600 dark:text-indigo-400"
                      )}>
                        {isLost ? (
                          <PackageX className="w-3.5 h-3.5" />
                        ) : isSubmitted ? (
                          <CheckCircle2 className="w-3.5 h-3.5" />
                        ) : (
                          <Package className="w-3.5 h-3.5" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        {/* Name + Quantity Badge */}
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <p className="text-xs font-bold text-slate-800 dark:text-white leading-tight">
                            {mat.item}
                          </p>
                          <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-white/10 shrink-0">
                            <span className="text-[8px] font-semibold text-slate-400 uppercase">Qty:</span>
                            <span className="font-bold text-slate-800 dark:text-slate-200">{qty}</span>
                            <span className="text-[9px] font-medium text-slate-400">{qty === 1 ? 'unit' : 'units'}</span>
                          </span>
                        </div>

                        <div className="flex items-center gap-1 mt-0.5 text-[10.5px] text-slate-500 dark:text-slate-400">
                          <User className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                          <span className="truncate">
                            {mat.assigned_to_name ? (
                              <span>Handed to: <strong className="font-semibold text-slate-700 dark:text-slate-300">{mat.assigned_to_name}</strong></span>
                            ) : (
                              <span className="text-slate-400 font-medium">Project Equipment</span>
                            )}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Status Badge & Delete Action */}
                    <div className="flex items-center gap-1 shrink-0">
                      {isLost ? (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                          <PackageX className="w-2.5 h-2.5" />
                          Lost
                        </span>
                      ) : isSubmitted ? (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          <Check className="w-2.5 h-2.5" />
                          Submitted
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                          <Clock className="w-2.5 h-2.5" />
                          In Field
                        </span>
                      )}

                      {canAssign && (
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => handleDeleteMaterial(mat.id)}
                          className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition disabled:opacity-50 shrink-0"
                          title="Remove Material"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Serial Number & Remarks row if present */}
                  {mat.notes && (
                    <div className="text-[10px] px-2 py-1 rounded-lg bg-slate-100/60 dark:bg-white/[0.02] border border-slate-200/50 dark:border-white/5 text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                      <Wrench className="w-2.5 h-2.5 text-slate-400 shrink-0" />
                      <span className="italic truncate">{mat.notes}</span>
                    </div>
                  )}

                  {/* Actions Bar - only shown when item needs actions (not submitted) */}
                  {canAssign && (!isSubmitted || isLost) && (
                    <div className="flex items-center justify-end pt-1.5 border-t border-slate-200/50 dark:border-white/5 gap-1.5">
                      {isLost ? (
                        <button
                          type="button"
                          disabled={loading}
                          onClick={() => handleSubmitToCompany(mat.id, mat.item)}
                          className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-700 text-white transition-all shadow-xs active:scale-95 shrink-0"
                          title="Mark found and returned to company"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Mark Recovered</span>
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            disabled={loading}
                            onClick={() => handleOpenReportLost(mat)}
                            className="flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-lg text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100/80 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 dark:text-rose-400 border border-rose-200/70 dark:border-rose-500/25 transition-all shadow-xs active:scale-95 shrink-0"
                            title="Report material lost or missing with responsible person"
                          >
                            <PackageX className="w-3 h-3 text-rose-500 dark:text-rose-400" />
                            <span>Report Lost</span>
                          </button>
                          <button
                            type="button"
                            disabled={loading}
                            onClick={() => handleSubmitToCompany(mat.id, mat.item)}
                            className="flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-all shadow-xs active:scale-95 shrink-0"
                            title={`Submit ${qty} ${qty === 1 ? 'unit' : 'units'} to company`}
                          >
                            <CheckCircle2 className="w-3 h-3" />
                            <span>Submit {qty > 1 ? `(${qty})` : ''}</span>
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Submit / Lost Materials Modal */}
      <SubmitMaterialsModal
        open={isSubmitModalOpen}
        onOpenChange={setIsSubmitModalOpen}
        projectId={projectId}
        pendingMaterials={pendingMaterials}
        teamMembers={assignments}
        staff={staff}
        singleMaterial={modalSingleMaterial}
        onOptimisticBulkSubmit={handleOptimisticBulkSubmit}
        onOptimisticLostSubmit={handleOptimisticLostSubmit}
        onSuccess={() => {
          fetchMaterials(true);
        }}
      />
    </div>
  );
}
