import React, { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { 
  Package, CheckCircle2, Clock, Plus, AlertCircle, 
  Trash2, RotateCcw, PackageX, X, Check, User, Wrench, Layers, ExternalLink
} from "lucide-react";
import { 
  assignMaterialToProjectAction, 
  getProjectMaterialsAction, 
  submitMaterialToCompanyAction, 
  deleteProjectMaterialAction 
} from "@/actions/field.actions";
import { getEquipmentCatalogAction } from "@/actions/equipment.actions";
import { EquipmentItem, DEFAULT_EQUIPMENT_CATALOG } from "@/types/equipment.types";
import { SubmitMaterialsModal } from "@/components/modules/SubmitMaterialsModal";
import { Select, SelectItem } from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

function parseMaterialNotes(notes?: string | null) {
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

  // Equipment catalog & subparts state
  const [catalog, setCatalog] = useState<EquipmentItem[]>(DEFAULT_EQUIPMENT_CATALOG);
  const [selectedSubparts, setSelectedSubparts] = useState<
    Array<{ name: string; quantity: number; included: boolean }>
  >([]);

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

  // Load equipment catalog
  useEffect(() => {
    getEquipmentCatalogAction().then((res) => {
      if (res.success && res.data && res.data.length > 0) {
        setCatalog(res.data);
      }
    });
  }, []);

  const handleSelectEquipmentPreset = (presetItem: EquipmentItem) => {
    setMaterialItemName(presetItem.name);
    const qty = Math.max(1, Number(materialQty) || 1);
    if (presetItem.subparts && presetItem.subparts.length > 0) {
      setSelectedSubparts(
        presetItem.subparts.map((s) => ({
          name: s.name,
          quantity: (s.defaultQuantity || 1) * qty,
          included: true,
        }))
      );
    } else {
      setSelectedSubparts([]);
    }
  };

  const handleAssignMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!materialItemName.trim()) {
      toast.error("Please enter or select a material name");
      return;
    }
    setSubmittingMaterial(true);
    try {
      const includedParts = selectedSubparts
        .filter((s) => s.included)
        .map((s) => `${s.quantity > 1 ? `${s.quantity}x ` : ""}${s.name}`);

      let finalNotes = materialNotes.trim();
      if (includedParts.length > 0) {
        const partsSummary = `Subparts: ${includedParts.join(", ")}`;
        finalNotes = finalNotes ? `${finalNotes} | ${partsSummary}` : partsSummary;
      }

      const res = await assignMaterialToProjectAction(
        projectId,
        materialItemName.trim(),
        Number(materialQty) || 1,
        finalNotes || undefined,
        materialAssignedTo || undefined
      );

      if (res.success) {
        toast.success("Material / Equipment assigned to project");
        setMaterialItemName("");
        setMaterialQty("1");
        setMaterialNotes("");
        setMaterialAssignedTo("");
        setSelectedSubparts([]);
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

  const [filterTab, setFilterTab] = useState<'all' | 'field' | 'submitted' | 'lost'>('all');

  const filteredAssignments = assignments.filter((a: any) => a.role !== 'admin');
  const pendingMaterials = materials.filter(m => m.status === 'assigned' || m.status === 'requested');
  const pendingMaterialsCount = pendingMaterials.length;
  const lostMaterialsCount = materials.filter(m => m.status === 'lost' || m.status === 'missing').length;
  const submittedMaterialsCount = materials.filter(m => m.status === 'submitted' || m.status === 'returned').length;

  // Total unit quantities (summing actual item quantities)
  const totalUnits = materials.reduce((sum, m) => sum + (Number(m.quantity) || 1), 0);
  const pendingUnits = pendingMaterials.reduce((sum, m) => sum + (Number(m.quantity) || 1), 0);
  const returnedUnits = materials
    .filter(m => m.status === 'submitted' || m.status === 'returned')
    .reduce((sum, m) => sum + (Number(m.quantity) || 1), 0);
  const lostUnits = materials
    .filter(m => m.status === 'lost' || m.status === 'missing')
    .reduce((sum, m) => sum + (Number(m.quantity) || 1), 0);

  const displayedMaterials = useMemo(() => {
    return materials.filter(m => {
      if (filterTab === 'field') return m.status === 'assigned' || m.status === 'requested';
      if (filterTab === 'submitted') return m.status === 'submitted' || m.status === 'returned';
      if (filterTab === 'lost') return m.status === 'lost' || m.status === 'missing';
      return true;
    });
  }, [materials, filterTab]);

  return (
    <div className="glass-card p-6 sm:p-7 rounded-3xl border border-slate-200/80 dark:border-white/10 shadow-sm transition-all duration-300 w-full space-y-6">
      {/* ── Card Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-200/60 dark:border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/25 shrink-0">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-tight">
                Assigned Materials & Equipment
              </h3>
              {materials.length > 0 && (
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-500/20 shadow-2xs">
                  {totalUnits} {totalUnits === 1 ? 'Unit' : 'Units'} ({materials.length} Items)
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Manage field instruments, component accessories, and custody status
            </p>
          </div>
        </div>

        {canAssign && (
          <div className="flex items-center gap-2 shrink-0">
            {!isAssigningMaterial && (
              <button
                type="button"
                onClick={() => setIsAssigningMaterial(true)}
                className="inline-flex items-center justify-center gap-2 text-xs font-bold px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-md shadow-indigo-500/25 hover:shadow-indigo-500/35 transition-all duration-200 active:scale-95"
                title="Assign Material"
              >
                <Plus className="w-4 h-4" />
                <span>Assign New Equipment</span>
              </button>
            )}
          </div>
        )}
      </div>

      <div className="space-y-5">
        {/* ── Status KPI Stats Bar & Quick Submit All ── */}
        <div className="p-4 rounded-2xl bg-gradient-to-r from-slate-50 via-slate-50/80 to-indigo-50/30 dark:from-white/[0.03] dark:via-white/[0.02] dark:to-indigo-500/5 border border-slate-200/70 dark:border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4 sm:gap-6 flex-wrap">
            {/* KPI 1: Total Units */}
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-200/60 dark:border-indigo-500/20">
                <Package className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Total Allocated</div>
                <div className="text-sm font-bold text-slate-800 dark:text-white">
                  {totalUnits} <span className="text-xs font-medium text-slate-400">({materials.length} {materials.length === 1 ? 'type' : 'types'})</span>
                </div>
              </div>
            </div>

            {/* KPI 2: In Field */}
            <div className="flex items-center gap-2.5">
              <div className={cn(
                "w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border",
                pendingUnits > 0
                  ? "bg-amber-500/10 border-amber-500/25 text-amber-600 dark:text-amber-400"
                  : "bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-400"
              )}>
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Active in Field</div>
                <div className="text-sm font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                  {pendingUnits} {pendingUnits === 1 ? 'Unit' : 'Units'}
                  {pendingUnits > 0 && (
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* KPI 3: Returned / Submitted */}
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Returned</div>
                <div className="text-sm font-bold text-slate-800 dark:text-white">
                  {returnedUnits} {returnedUnits === 1 ? 'Unit' : 'Units'}
                </div>
              </div>
            </div>

            {/* KPI 4: Lost / Missing (if any) */}
            {lostUnits > 0 && (
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-rose-500/10 border border-rose-500/25 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0">
                  <PackageX className="w-4 h-4" />
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-wider text-rose-500">Reported Lost</div>
                  <div className="text-sm font-bold text-rose-600 dark:text-rose-400">
                    {lostUnits} {lostUnits === 1 ? 'Unit' : 'Units'}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action: Submit All Units Button */}
          {canAssign && pendingUnits > 0 && (
            <button
              type="button"
              disabled={loading}
              onClick={handleOpenSubmitAll}
              className="inline-flex items-center justify-center gap-2 text-xs font-bold px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-md shadow-emerald-500/20 hover:shadow-emerald-500/30 transition-all duration-200 active:scale-95 shrink-0"
              title="Mark all assigned materials submitted to company or report missing items"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Submit All ({pendingUnits} Units)</span>
            </button>
          )}
        </div>

        {/* ── Assign Material Form ── */}
        {isAssigningMaterial && (
          <form onSubmit={handleAssignMaterial} className="p-5 rounded-2xl bg-slate-50/90 dark:bg-white/[0.03] border border-indigo-500/25 shadow-sm space-y-4 animate-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/60 dark:border-white/5">
              <span className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-500" />
                Assign New Equipment
              </span>
              <button 
                type="button" 
                onClick={() => {
                  setIsAssigningMaterial(false);
                  setSelectedSubparts([]);
                }} 
                className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-white/10 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Presets */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Quick Select Equipment</label>
                <Link
                  href="/equipments"
                  target="_blank"
                  className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                  title="Configure equipment & subparts catalog"
                >
                  <Wrench className="w-3 h-3" />
                  <span>Configure Catalog</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {catalog.map((preset) => (
                  <button
                    key={preset.id || preset.name}
                    type="button"
                    onClick={() => handleSelectEquipmentPreset(preset)}
                    className={cn(
                      "text-xs px-3 py-1.5 rounded-xl border font-semibold transition-all",
                      materialItemName.toLowerCase() === preset.name.toLowerCase()
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                        : "bg-white dark:bg-slate-900/60 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:border-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-500/10"
                    )}
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Item Name & Qty */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Item Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Total Station Leica TS07"
                  value={materialItemName}
                  onChange={(e) => {
                    const val = e.target.value;
                    setMaterialItemName(val);
                    const match = catalog.find(x => x.name.toLowerCase() === val.trim().toLowerCase());
                    if (match && match.subparts?.length) {
                      const qty = Math.max(1, Number(materialQty) || 1);
                      setSelectedSubparts(match.subparts.map(s => ({
                        name: s.name,
                        quantity: (s.defaultQuantity || 1) * qty,
                        included: true
                      })));
                    }
                  }}
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
                  onChange={(e) => {
                    const newQty = e.target.value;
                    setMaterialQty(newQty);
                    const num = Math.max(1, Number(newQty) || 1);
                    setSelectedSubparts(prev => prev.map(s => ({
                      ...s,
                      quantity: Math.max(1, Math.round(s.quantity * (num / (Number(materialQty) || 1))))
                    })));
                  }}
                  className="w-full text-xs p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 focus:outline-none focus:border-indigo-500 font-bold"
                />
              </div>
            </div>

            {/* Subparts & Accessories Selection */}
            {selectedSubparts.length > 0 && (
              <div className="p-4 rounded-xl bg-white dark:bg-slate-900 border border-indigo-500/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-800 dark:text-slate-100 flex items-center gap-2">
                      <Layers className="w-4 h-4 text-indigo-500" />
                      Select Included Sub-parts & Accessories
                    </label>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Check components to include with this equipment (e.g. Battery, Charger):
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const name = window.prompt("Enter extra accessory name (e.g. Spare Battery, 64GB SD Card):");
                      if (name && name.trim()) {
                        setSelectedSubparts((prev) => [
                          ...prev,
                          { name: name.trim(), quantity: 1, included: true },
                        ]);
                      }
                    }}
                    className="text-xs font-bold px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 transition flex items-center gap-1.5 shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Part
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 max-h-72 overflow-y-auto pr-1 custom-scrollbar">
                  {selectedSubparts.map((sub, idx) => (
                    <div
                      key={idx}
                      title={sub.name}
                      onClick={() => {
                        setSelectedSubparts((prev) => {
                          const copy = [...prev];
                          copy[idx] = { ...copy[idx], included: !copy[idx].included };
                          return copy;
                        });
                      }}
                      className={cn(
                        "flex items-center justify-between p-2.5 px-3 rounded-xl border text-sm cursor-pointer select-none transition-all min-h-[44px]",
                        sub.included
                          ? "bg-indigo-50/80 dark:bg-indigo-500/10 border-indigo-300 dark:border-indigo-500/40 text-slate-800 dark:text-slate-100 shadow-xs"
                          : "bg-slate-50/50 dark:bg-white/[0.02] border-slate-200/60 dark:border-white/5 text-slate-400 opacity-60"
                      )}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1">
                        <input
                          type="checkbox"
                          checked={sub.included}
                          onChange={() => {}}
                          className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 pointer-events-none shrink-0"
                        />
                        <span className="text-xs sm:text-[13px] font-semibold leading-normal truncate">{sub.name}</span>
                      </div>

                      {sub.included && (
                        <div
                          className="flex items-center gap-1 shrink-0 ml-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSubparts((prev) => {
                                const copy = [...prev];
                                copy[idx] = {
                                  ...copy[idx],
                                  quantity: Math.max(1, copy[idx].quantity - 1),
                                };
                                return copy;
                              });
                            }}
                            className="w-5 h-5 rounded bg-slate-200/80 dark:bg-white/10 text-slate-700 dark:text-slate-200 font-bold flex items-center justify-center text-xs hover:bg-slate-300 transition-colors"
                          >
                            -
                          </button>
                          <span className="text-xs font-bold px-1.5 min-w-[20px] text-center">
                            {sub.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSubparts((prev) => {
                                const copy = [...prev];
                                copy[idx] = { ...copy[idx], quantity: copy[idx].quantity + 1 };
                                return copy;
                              });
                            }}
                            className="w-5 h-5 rounded bg-slate-200/80 dark:bg-white/10 text-slate-700 dark:text-slate-200 font-bold flex items-center justify-center text-xs hover:bg-slate-300 transition-colors"
                          >
                            +
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                  placeholder="e.g. S/N: 77894, Batteries & Charger Tested OK"
                  value={materialNotes}
                  onChange={(e) => setMaterialNotes(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 focus:outline-none focus:border-indigo-500 font-medium"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={submittingMaterial}
              className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold tracking-wide transition-all shadow-md shadow-indigo-500/20 active:scale-[0.99] disabled:opacity-50"
            >
              {submittingMaterial ? "Assigning Material..." : "Confirm Material Assignment"}
            </button>
          </form>
        )}

        {/* ── Filter Tabs Bar ── */}
        {materials.length > 0 && (
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-100/70 dark:bg-white/[0.04] border border-slate-200/50 dark:border-white/5 w-fit">
            <button
              type="button"
              onClick={() => setFilterTab('all')}
              className={cn(
                "px-3 py-1 rounded-lg text-xs font-bold transition-all",
                filterTab === 'all'
                  ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-xs"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-white"
              )}
            >
              All Items ({materials.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('field')}
              className={cn(
                "px-3 py-1 rounded-lg text-xs font-bold transition-all",
                filterTab === 'field'
                  ? "bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 shadow-xs"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-white"
              )}
            >
              In Field ({pendingMaterialsCount})
            </button>
            <button
              type="button"
              onClick={() => setFilterTab('submitted')}
              className={cn(
                "px-3 py-1 rounded-lg text-xs font-bold transition-all",
                filterTab === 'submitted'
                  ? "bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 shadow-xs"
                  : "text-slate-500 hover:text-slate-800 dark:hover:text-white"
              )}
            >
              Returned ({submittedMaterialsCount})
            </button>
            {lostMaterialsCount > 0 && (
              <button
                type="button"
                onClick={() => setFilterTab('lost')}
                className={cn(
                  "px-3 py-1 rounded-lg text-xs font-bold transition-all",
                  filterTab === 'lost'
                    ? "bg-white dark:bg-slate-800 text-rose-600 dark:text-rose-400 shadow-xs"
                    : "text-slate-500 hover:text-slate-800 dark:hover:text-white"
                )}
              >
                Lost ({lostMaterialsCount})
              </button>
            )}
          </div>
        )}

        {/* ── Material Items Cards Grid ── */}
        {loadingMaterials ? (
          <div className="text-center py-12 text-slate-400 text-xs">Loading assigned materials…</div>
        ) : materials.length === 0 ? (
          <div className="text-center py-12 px-4 rounded-3xl border border-dashed border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.01]">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500 flex items-center justify-center mx-auto mb-3 shadow-sm">
              <Package className="w-7 h-7" />
            </div>
            <p className="font-bold text-sm text-slate-800 dark:text-slate-200">No equipment assigned yet</p>
            <p className="text-xs text-slate-400 mt-1 max-w-[280px] mx-auto leading-relaxed">
              Click &quot;Assign New Equipment&quot; above to allocate instruments and accessories to field crews.
            </p>
          </div>
        ) : displayedMaterials.length === 0 ? (
          <div className="text-center py-10 px-4 rounded-2xl border border-dashed border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.01]">
            <p className="font-semibold text-xs text-slate-500">No equipment matching this filter</p>
            <button
              onClick={() => setFilterTab('all')}
              className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline mt-1.5"
            >
              Show all equipment
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 pt-1 max-h-[640px] overflow-y-auto pr-1 custom-scrollbar">
            {displayedMaterials.map((mat) => {
              const isSubmitted = mat.status === 'submitted' || mat.status === 'returned';
              const isLost = mat.status === 'lost' || mat.status === 'missing';
              const qty = Number(mat.quantity) || 1;

              return (
                <div
                  key={mat.id}
                  className={cn(
                    "relative flex flex-col justify-between rounded-2xl bg-white dark:bg-slate-900 border transition-all duration-300 p-5 shadow-xs hover:shadow-md group",
                    isLost
                      ? "border-rose-200 dark:border-rose-500/25 bg-rose-50/15 dark:bg-rose-500/5"
                      : isSubmitted
                        ? "border-emerald-200 dark:border-emerald-500/25 bg-emerald-50/15 dark:bg-emerald-500/5"
                        : "border-slate-200/80 dark:border-white/10 hover:border-indigo-400/50"
                  )}
                >
                  <div className="space-y-3.5">
                    {/* Top Row: Icon + Name & Qty Badge + Status Pill + Delete */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border mt-0.5 shadow-xs transition-transform duration-200 group-hover:scale-105",
                          isLost
                            ? "bg-rose-500/10 border-rose-500/20 text-rose-600 dark:text-rose-400"
                            : isSubmitted
                              ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                              : "bg-indigo-500/10 border-indigo-500/20 text-indigo-600 dark:text-indigo-400"
                        )}>
                          {isLost ? (
                            <PackageX className="w-5 h-5" />
                          ) : isSubmitted ? (
                            <CheckCircle2 className="w-5 h-5" />
                          ) : (
                            <Package className="w-5 h-5" />
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          {/* Name + Quantity Badge */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm font-bold text-slate-900 dark:text-white leading-tight">
                              {mat.item}
                            </h4>
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-white/10 shrink-0">
                              <span className="text-[9px] font-semibold text-slate-400 uppercase">Qty:</span>
                              <span className="font-bold text-slate-800 dark:text-slate-200">{qty}</span>
                              <span className="text-[9px] font-medium text-slate-400">{qty === 1 ? 'unit' : 'units'}</span>
                            </span>
                          </div>

                          {/* Custody Pill */}
                          <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-500 dark:text-slate-400">
                            <User className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span className="truncate">
                              {mat.assigned_to_name ? (
                                <span>Custody: <strong className="font-semibold text-slate-800 dark:text-slate-200 capitalize">{mat.assigned_to_name}</strong></span>
                              ) : (
                                <span className="text-slate-400 italic">General Project Equipment</span>
                              )}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Status Badge & Delete Action */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isLost ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                            <PackageX className="w-3 h-3" />
                            Lost
                          </span>
                        ) : isSubmitted ? (
                          <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                            <Check className="w-3 h-3" />
                            Submitted
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-200/80 dark:border-amber-500/20">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                            In Field
                          </span>
                        )}

                        {canAssign && (
                          <button
                            type="button"
                            disabled={loading}
                            onClick={() => handleDeleteMaterial(mat.id)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition disabled:opacity-50 shrink-0"
                            title="Remove Material"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Serial Number & Remarks & Subparts row if present */}
                    {mat.notes && (() => {
                      const { remarks, subparts } = parseMaterialNotes(mat.notes);
                      return (
                        <div className="space-y-2 pt-1">
                          {remarks && (
                            <div className="text-xs px-2.5 py-1.5 rounded-xl bg-slate-50 dark:bg-white/[0.02] border border-slate-200/50 dark:border-white/5 text-slate-600 dark:text-slate-400 flex items-center gap-2">
                              <Wrench className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="italic truncate">{remarks}</span>
                            </div>
                          )}
                          {subparts.length > 0 && (
                            <div className="p-2.5 rounded-xl bg-slate-50/70 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/5 space-y-1.5">
                              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                                <Layers className="w-3 h-3 text-indigo-500" />
                                <span>Included Accessories ({subparts.length})</span>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {subparts.map((part, pIdx) => (
                                  <span
                                    key={pIdx}
                                    className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200/70 dark:border-white/10 shadow-2xs"
                                  >
                                    {part}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Actions Bar - Bottom of Card */}
                  {canAssign && (!isSubmitted || isLost) ? (
                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/5 flex items-center justify-between gap-2">
                      <span className="text-[11px] text-slate-400 font-medium">
                        {isLost ? "Status: Reported Missing" : "Field custody active"}
                      </span>
                      <div className="flex items-center gap-2">
                        {isLost ? (
                          <button
                            type="button"
                            disabled={loading}
                            onClick={() => handleSubmitToCompany(mat.id, mat.item)}
                            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white transition-all shadow-xs active:scale-95"
                            title="Mark found and returned to company"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            <span>Mark Recovered</span>
                          </button>
                        ) : (
                          <>
                            <button
                              type="button"
                              disabled={loading}
                              onClick={() => handleOpenReportLost(mat)}
                              className="flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-xl text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100/80 dark:bg-rose-500/10 dark:hover:bg-rose-500/20 dark:text-rose-400 border border-rose-200 dark:border-rose-500/30 transition-all shadow-2xs active:scale-95"
                              title="Report material lost or missing with responsible person"
                            >
                              <PackageX className="w-3.5 h-3.5 text-rose-500" />
                              <span>Report Lost</span>
                            </button>
                            <button
                              type="button"
                              disabled={loading}
                              onClick={() => handleSubmitToCompany(mat.id, mat.item)}
                              className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white transition-all shadow-sm shadow-emerald-500/20 active:scale-95"
                              title={`Submit ${qty} ${qty === 1 ? 'unit' : 'units'} to company`}
                            >
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Submit {qty > 1 ? `(${qty})` : ''}</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ) : isSubmitted ? (
                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-xs text-emerald-600 dark:text-emerald-400">
                      <span className="flex items-center gap-1.5 font-semibold">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Returned & Verified to Company
                      </span>
                      {mat.submitted_at && (
                        <span className="text-[10px] text-slate-400">
                          {new Date(mat.submitted_at).toLocaleDateString()}
                        </span>
                      )}
                    </div>
                  ) : null}
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
