"use client";

import React, { useState, useEffect, useCallback } from "react";
import { 
  Users, UserPlus, X, Trash2, Package, CheckCircle2, 
  Clock, Plus, AlertCircle, Wrench, Check
} from "lucide-react";
import { assignUserToProjectAction, removeUserFromProjectAction } from "@/actions/assignment.actions";
import { 
  assignMaterialToProjectAction, 
  getProjectMaterialsAction, 
  submitMaterialToCompanyAction, 
  submitAllProjectMaterialsAction, 
  deleteProjectMaterialAction 
} from "@/actions/field.actions";
import { Select, SelectItem } from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface StaffMember {
  id: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
}

interface ProjectTeamSectionProps {
  projectId: string;
  assignments: any[];
  staff: StaffMember[];
  canAssign: boolean;
}

const ASSIGNMENT_ROLES = [
  { id: 'engineer', label: 'Engineer' },
  { id: 'lidar_specialist', label: 'Lidar Specialist' },
  { id: 'field', label: 'Field Crew' },
];

const COMMON_MATERIALS = [
  "Total Station",
  "DGPS Rover Unit",
  "DGPS Base Station",
  "Survey Drone / UAV",
  "Tripod & Tribrach",
  "Auto Level",
  "Prism Pole & Target",
  "Measuring Tape / Rangefinder"
];

const ROLE_COLORS: Record<string, string> = {
  engineer: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400',
  field: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  lidar_specialist: 'bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400',
};

function staffMatchesRole(s: { role?: string; designation?: string }, selectedRole: string): boolean {
  const role = (s.role || '').toLowerCase();
  const desig = (s.designation || '').toLowerCase();
  const want = selectedRole.toLowerCase();

  if (role === want || desig === want) return true;

  if (want === 'field') {
    return role === 'field' || desig.includes('field') || desig.includes('survey');
  }
  if (want === 'lidar_specialist') {
    return desig.includes('lidar') || role === 'lidar_specialist';
  }
  if (want === 'engineer') {
    return role === 'engineer' || desig.includes('engineer');
  }
  return false;
}

function getInitials(firstName?: string | null, lastName?: string | null) {
  const f = (firstName || '').trim();
  const l = (lastName || '').trim();
  if (!f && !l) return 'U';
  return `${f[0] || ''}${l[0] || ''}`.toUpperCase();
}

export function ProjectTeamSection({ projectId, assignments, staff, canAssign }: ProjectTeamSectionProps) {
  const [activeTab, setActiveTab] = useState<'team' | 'materials'>('team');

  // Team Assignment State
  const [isAssigning, setIsAssigning] = useState(false);
  const [selectedRole, setSelectedRole] = useState(ASSIGNMENT_ROLES[0].id);
  const [selectedUser, setSelectedUser] = useState("");
  const [loading, setLoading] = useState(false);

  // Material Assignment State
  const [materials, setMaterials] = useState<any[]>([]);
  const [loadingMaterials, setLoadingMaterials] = useState(false);
  const [isAssigningMaterial, setIsAssigningMaterial] = useState(false);
  const [materialItemName, setMaterialItemName] = useState("");
  const [materialQty, setMaterialQty] = useState("1");
  const [materialNotes, setMaterialNotes] = useState("");
  const [materialAssignedTo, setMaterialAssignedTo] = useState("");
  const [submittingMaterial, setSubmittingMaterial] = useState(false);

  const fetchMaterials = useCallback(async () => {
    setLoadingMaterials(true);
    try {
      const res = await getProjectMaterialsAction(projectId);
      if (res.success && res.data) {
        setMaterials(res.data);
      }
    } catch (e) {
      console.error("Failed to load materials", e);
    } finally {
      setLoadingMaterials(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchMaterials();
  }, [fetchMaterials]);

  const handleAssign = async () => {
    if (!selectedUser) {
      toast.error("Please select a staff member");
      return;
    }
    setLoading(true);
    try {
      const result = await assignUserToProjectAction(projectId, selectedUser, selectedRole);
      if (result?.success) {
        toast.success("Team member assigned");
        setSelectedUser("");
      } else {
        toast.error(result?.error || "Assignment failed");
      }
    } catch (err: any) {
      toast.error(err.message || "Assignment failed");
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (userId: string, roleKey: string) => {
    if (!confirm(`Are you sure you want to remove this ${roleKey}?`)) return;
    setLoading(true);
    try {
      const result = await removeUserFromProjectAction(userId, projectId);
      if (result?.success !== false) {
        toast.success("Team member removed");
      } else {
        toast.error(result?.error || "Failed to remove member");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to remove member");
    } finally {
      setLoading(false);
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
        fetchMaterials();
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
    setLoading(true);
    try {
      const res = await submitMaterialToCompanyAction(materialId);
      if (res.success) {
        toast.success(`"${itemName}" submitted to company`);
        fetchMaterials();
      } else {
        toast.error(res.error || "Failed to submit material");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to submit material");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitAllToCompany = async () => {
    if (!confirm("Confirm that all assigned materials and equipment have been submitted back to the company?")) return;
    setLoading(true);
    try {
      const res = await submitAllProjectMaterialsAction(projectId);
      if (res.success) {
        toast.success("All materials marked as submitted to company");
        fetchMaterials();
      } else {
        toast.error(res.error || "Failed to submit all materials");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to submit materials");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteMaterial = async (materialId: string) => {
    if (!confirm("Are you sure you want to remove this assigned material?")) return;
    setLoading(true);
    try {
      const res = await deleteProjectMaterialAction(materialId, projectId);
      if (res.success) {
        toast.success("Material removed");
        fetchMaterials();
      } else {
        toast.error(res.error || "Failed to remove material");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to remove material");
    } finally {
      setLoading(false);
    }
  };

  const filteredAssignments = assignments.filter((a: any) => a.role !== 'admin');
  const pendingMaterialsCount = materials.filter(m => m.status === 'assigned' || m.status === 'requested').length;
  const submittedMaterialsCount = materials.filter(m => m.status === 'submitted' || m.status === 'returned').length;

  return (
    <div className="glass-card p-6">
      {/* ── Tabs Navigation ── */}
      <div className="flex items-center justify-between mb-5 border-b border-slate-200/60 dark:border-white/5 pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('team')}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
              activeTab === 'team'
                ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shadow-sm"
                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
            )}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Project Team</span>
            {filteredAssignments.length > 0 && (
              <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-slate-200/70 dark:bg-white/10 text-slate-700 dark:text-slate-300">
                {filteredAssignments.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('materials')}
            className={cn(
              "flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all relative",
              activeTab === 'materials'
                ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 shadow-sm"
                : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-300"
            )}
          >
            <Package className="w-3.5 h-3.5" />
            <span>Assigned Materials</span>
            {materials.length > 0 && (
              <span className={cn(
                "text-[10px] px-1.5 py-0.2 rounded-full font-black",
                pendingMaterialsCount > 0 
                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                  : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
              )}>
                {materials.length}
              </span>
            )}
            {pendingMaterialsCount > 0 && (
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse ml-0.5" title="Materials pending return to company" />
            )}
          </button>
        </div>

        {/* Header Action */}
        {activeTab === 'team' && canAssign && !isAssigning && (
          <button
            onClick={() => setIsAssigning(true)}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors"
            title="Assign Member"
          >
            <UserPlus className="w-3.5 h-3.5" />
            Assign Member
          </button>
        )}

        {activeTab === 'materials' && canAssign && !isAssigningMaterial && (
          <div className="flex items-center gap-2">
            {pendingMaterialsCount > 0 && (
              <button
                disabled={loading}
                onClick={handleSubmitAllToCompany}
                className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors"
                title="Mark all assigned materials submitted to company"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Submit All to Company</span>
              </button>
            )}
            <button
              onClick={() => setIsAssigningMaterial(true)}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors"
              title="Assign Material"
            >
              <Plus className="w-3.5 h-3.5" />
              Assign Material
            </button>
          </div>
        )}
      </div>

      {/* ── TAB 1: TEAM MEMBERS ── */}
      {activeTab === 'team' && (
        <>
          {/* Assign Member Form */}
          {isAssigning && (
            <div className="mb-4 p-4 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 space-y-3 animate-in slide-in-from-top-2 duration-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">New Member Assignment</span>
                <button onClick={() => setIsAssigning(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Role</label>
                  <Select
                    value={selectedRole}
                    onValueChange={(val) => {
                      setSelectedRole(val);
                      setSelectedUser("");
                    }}
                  >
                    {ASSIGNMENT_ROLES.map((r: any) => (
                      <SelectItem key={r.id} value={r.id}>{r.label}</SelectItem>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Staff Member</label>
                  <Select
                    value={selectedUser}
                    onValueChange={setSelectedUser}
                    placeholder={
                      staff.filter((s: any) => staffMatchesRole(s, selectedRole)).length === 0
                        ? "No staff for this role"
                        : "Select..."
                    }
                  >
                    {staff
                      .filter((s: any) => staffMatchesRole(s, selectedRole))
                      .map((s: any) => (
                      <SelectItem key={s.id} value={s.id}>
                        {(s.first_name || s.last_name)
                          ? `${s.first_name || ''} ${s.last_name || ''}`.trim()
                          : s.email || s.id}
                      </SelectItem>
                    ))}
                  </Select>
                </div>
              </div>
              <button
                disabled={loading}
                onClick={handleAssign}
                className="w-full py-2.5 mt-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold tracking-wide transition-all shadow-sm disabled:opacity-50"
              >
                {loading ? "Assigning…" : "Confirm Assignment"}
              </button>
            </div>
          )}

          {/* Member List */}
          {filteredAssignments.length === 0 ? (
            <div className="text-center py-8 text-slate-400 dark:text-slate-600 text-sm">
              No team members assigned yet.
            </div>
          ) : (
            <div className="space-y-2">
              {filteredAssignments.map((a, i) => {
                const firstName = a.firstName ?? a.profiles?.first_name ?? '';
                const lastName  = a.lastName  ?? a.profiles?.last_name  ?? '';
                const roleKey   = (a.role || '').replace('_', ' ');
                const colorClass = ROLE_COLORS[a.role] || 'bg-slate-100 dark:bg-white/5 text-slate-500';

                return (
                  <div
                    key={a.id || a.userId || i}
                    className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors"
                  >
                    <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/10 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-300">
                        {getInitials(firstName, lastName)}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">
                        {firstName || lastName ? `${firstName} ${lastName}`.trim() : 'Unknown'}
                      </p>
                    </div>

                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide shrink-0 ${colorClass}`}>
                      {roleKey}
                    </span>

                    {canAssign && (
                      <button
                        disabled={loading}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemove(a.userId || a.id, roleKey);
                        }}
                        className="ml-2 w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition disabled:opacity-50 shrink-0"
                        title="Remove Member"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ── TAB 2: ASSIGNED MATERIALS & EQUIPMENT ── */}
      {activeTab === 'materials' && (
        <div className="space-y-4">
          {/* Status summary banner */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50/80 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/5 text-xs">
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4 text-indigo-500" />
              <span className="font-semibold text-slate-700 dark:text-slate-300">
                {materials.length} {materials.length === 1 ? 'Material' : 'Materials'} Assigned
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] font-bold">
              {pendingMaterialsCount > 0 ? (
                <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {pendingMaterialsCount} In Field (Pending Return)
                </span>
              ) : materials.length > 0 ? (
                <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  All Materials Submitted in Company
                </span>
              ) : null}
            </div>
          </div>

          {/* Assign Material Form */}
          {isAssigningMaterial && (
            <form onSubmit={handleAssignMaterial} className="p-4 rounded-xl bg-slate-50 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 space-y-3 animate-in slide-in-from-top-2 duration-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  Assign Equipment / Material
                </span>
                <button type="button" onClick={() => setIsAssigningMaterial(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Quick Presets */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Quick Select Equipment</label>
                <div className="flex flex-wrap gap-1.5">
                  {COMMON_MATERIALS.map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setMaterialItemName(preset)}
                      className={cn(
                        "text-[10px] px-2.5 py-1 rounded-lg border font-medium transition-all",
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
                    className="w-full text-xs p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 focus:outline-none focus:border-indigo-500 font-medium"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Qty</label>
                  <input
                    type="number"
                    min="1"
                    required
                    value={materialQty}
                    onChange={(e) => setMaterialQty(e.target.value)}
                    className="w-full text-xs p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 focus:outline-none focus:border-indigo-500 font-medium"
                  />
                </div>
              </div>

              {/* Assign To (Team member) */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Assign To (Handed Over To)</label>
                <select
                  value={materialAssignedTo}
                  onChange={(e) => setMaterialAssignedTo(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 focus:outline-none focus:border-indigo-500 font-medium text-slate-800 dark:text-white"
                >
                  <option value="">General Project Allocation (Unassigned)</option>
                  {filteredAssignments.map((a: any) => {
                    const name = a.firstName || a.lastName ? `${a.firstName || ''} ${a.lastName || ''}`.trim() : a.profiles?.first_name ? `${a.profiles?.first_name} ${a.profiles?.last_name || ''}`.trim() : a.userId || a.id;
                    const role = (a.role || '').replace('_', ' ');
                    return (
                      <option key={a.userId || a.id} value={a.userId || a.id}>
                        {name} ({role})
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Notes / Serial No */}
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Serial No. / Remarks</label>
                <input
                  type="text"
                  placeholder="e.g. S/N: 77894, 2 Batteries, Charger & Case"
                  value={materialNotes}
                  onChange={(e) => setMaterialNotes(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 focus:outline-none focus:border-indigo-500 font-medium"
                />
              </div>

              <button
                type="submit"
                disabled={submittingMaterial}
                className="w-full py-2.5 mt-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold tracking-wide transition-all shadow-sm disabled:opacity-50"
              >
                {submittingMaterial ? "Assigning Material..." : "Confirm Material Assignment"}
              </button>
            </form>
          )}

          {/* Material Items List */}
          {loadingMaterials ? (
            <div className="text-center py-8 text-slate-400 text-xs">Loading assigned materials…</div>
          ) : materials.length === 0 ? (
            <div className="text-center py-8 text-slate-400 dark:text-slate-600 text-sm">
              <Package className="w-8 h-8 mx-auto mb-2 opacity-40 text-slate-400" />
              <p className="font-semibold text-xs text-slate-600 dark:text-slate-400">No materials assigned to this project yet.</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Use &quot;Assign Material&quot; above to allocate equipment to the field crew.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {materials.map((mat) => {
                const isSubmitted = mat.status === 'submitted' || mat.status === 'returned';
                return (
                  <div
                    key={mat.id}
                    className="p-3 rounded-xl bg-slate-50/70 dark:bg-white/[0.02] border border-slate-200/70 dark:border-white/5 hover:border-indigo-500/30 transition-all flex items-center justify-between gap-3 group"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className={cn(
                        "w-9 h-9 rounded-xl flex items-center justify-center shrink-0 border",
                        isSubmitted
                          ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400"
                          : "bg-indigo-500/10 border-indigo-500/20 text-indigo-600 dark:text-indigo-400"
                      )}>
                        {isSubmitted ? <CheckCircle2 className="w-4 h-4" /> : <Package className="w-4 h-4" />}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="text-xs font-bold text-slate-900 dark:text-white truncate">
                            {mat.item}
                          </p>
                          <span className="text-[10px] font-black px-1.5 py-0.2 rounded bg-slate-200/80 dark:bg-white/10 text-slate-700 dark:text-slate-300">
                            x{mat.quantity}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-slate-400 truncate">
                          {mat.assigned_to_name ? (
                            <span>Assigned to: <strong className="text-slate-600 dark:text-slate-300">{mat.assigned_to_name}</strong></span>
                          ) : (
                            <span>Project Equipment</span>
                          )}
                          {mat.notes && (
                            <>
                              <span>&bull;</span>
                              <span className="truncate italic">{mat.notes}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Status Pill & Action */}
                    <div className="flex items-center gap-2 shrink-0">
                      {isSubmitted ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                          <Check className="w-3 h-3" />
                          Submitted in Company
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            In Field
                          </span>

                          {canAssign && (
                            <button
                              disabled={loading}
                              onClick={() => handleSubmitToCompany(mat.id, mat.item)}
                              className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition shadow-sm flex items-center gap-1"
                              title="Mark material submitted in company"
                            >
                              <CheckCircle2 className="w-3 h-3" />
                              Submit to Company
                            </button>
                          )}
                        </div>
                      )}

                      {canAssign && (
                        <button
                          disabled={loading}
                          onClick={() => handleDeleteMaterial(mat.id)}
                          className="w-7 h-7 rounded-full flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition disabled:opacity-50"
                          title="Remove Material"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
