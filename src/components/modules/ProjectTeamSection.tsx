"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Users, UserPlus, X, Trash2 } from "lucide-react";
import { assignUserToProjectAction, removeUserFromProjectAction } from "@/actions/assignment.actions";
import { Select, SelectItem } from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export { ProjectMaterialsSection } from "./ProjectMaterialsSection";

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
  onUpdateTeamMembers?: (assignments: any[]) => void;
}

const ASSIGNMENT_ROLES = [
  { id: 'engineer', label: 'Engineer' },
  { id: 'field', label: 'Field Crew' },
];

const ROLE_COLORS: Record<string, string> = {
  engineer: 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20',
  field: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
  lidar_specialist: 'bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20',
};

function staffMatchesRole(s: { role?: string; designation?: string }, selectedRole: string): boolean {
  const role = (s.role || '').toLowerCase();
  const desig = (s.designation || '').toLowerCase();
  const want = selectedRole.toLowerCase();

  if (role === want || desig === want) return true;

  if (want === 'field') {
    return role === 'field' || desig.includes('field') || desig.includes('survey');
  }
  if (want === 'engineer') {
    return role === 'engineer' || desig.includes('engineer') || desig.includes('lidar');
  }
  return false;
}

function getInitials(firstName?: string | null, lastName?: string | null) {
  const f = (firstName || '').trim();
  const l = (lastName || '').trim();
  if (!f && !l) return 'U';
  return `${f[0] || ''}${l[0] || ''}`.toUpperCase();
}

export function ProjectTeamSection({ projectId, assignments, staff, canAssign, onUpdateTeamMembers }: ProjectTeamSectionProps) {
  const router = useRouter();
  const [isAssigning, setIsAssigning] = useState(false);
  const [selectedRole, setSelectedRole] = useState(ASSIGNMENT_ROLES[0].id);
  const [selectedUser, setSelectedUser] = useState("");
  const [loading, setLoading] = useState(false);

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
        setIsAssigning(false);
        if (result.data) {
          onUpdateTeamMembers?.([...assignments, result.data]);
        }
        router.refresh();
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
        onUpdateTeamMembers?.(assignments.filter((a: any) => (a.userId || a.id || a.user_id) !== userId));
        router.refresh();
      } else {
        toast.error(result?.error || "Failed to remove member");
      }
    } catch (err: any) {
      toast.error(err.message || "Failed to remove member");
    } finally {
      setLoading(false);
    }
  };

  const filteredAssignments = assignments.filter((a: any) => a.role !== 'admin');

  return (
    <div className="glass-card p-6 transition-all duration-300">
      {/* ── Card Header ── */}
      <div className="flex items-center justify-between gap-3 mb-5 pb-4 border-b border-slate-200/60 dark:border-white/5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500/15 to-purple-500/15 border border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shadow-sm shrink-0">
            <Users className="w-4 h-4" />
          </div>
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight whitespace-nowrap">
              Project Team
            </h3>
            {filteredAssignments.length > 0 && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300 border border-slate-200/60 dark:border-white/10 shrink-0">
                {filteredAssignments.length}
              </span>
            )}
          </div>
        </div>

        {canAssign && !isAssigning && (
          <button
            type="button"
            onClick={() => setIsAssigning(true)}
            className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-sm shadow-indigo-500/20 active:scale-95 shrink-0"
            title="Assign Member"
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Assign Member</span>
          </button>
        )}
      </div>

      {/* Assign Member Form */}
      {isAssigning && (
        <div className="mb-4 p-4 rounded-2xl bg-slate-50/90 dark:bg-white/[0.03] border border-indigo-500/20 shadow-sm space-y-3.5 animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200/60 dark:border-white/5">
            <span className="text-xs font-bold text-slate-800 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
              <UserPlus className="w-3.5 h-3.5 text-indigo-500" />
              New Member Assignment
            </span>
            <button 
              type="button" 
              onClick={() => setIsAssigning(false)} 
              className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-white/10 transition"
            >
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
            type="button"
            disabled={loading}
            onClick={handleAssign}
            className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold tracking-wide transition-all shadow-sm shadow-indigo-500/20 active:scale-[0.99] disabled:opacity-50"
          >
            {loading ? "Assigning…" : "Confirm Assignment"}
          </button>
        </div>
      )}

      {/* Member List */}
      {filteredAssignments.length === 0 ? (
        <div className="text-center py-10 px-4 rounded-2xl border border-dashed border-slate-200 dark:border-white/10 bg-slate-50/50 dark:bg-white/[0.01]">
          <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500 flex items-center justify-center mx-auto mb-3">
            <Users className="w-6 h-6" />
          </div>
          <p className="font-bold text-xs text-slate-700 dark:text-slate-300">No team members assigned yet</p>
          <p className="text-[11px] text-slate-400 mt-1 max-w-[260px] mx-auto leading-relaxed">
            Assign engineers and field crew to collaborate on this project.
          </p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
          {filteredAssignments.map((a, i) => {
            const firstName = a.firstName ?? a.profiles?.first_name ?? '';
            const lastName  = a.lastName  ?? a.profiles?.last_name  ?? '';
            const roleKey   = (a.role || '').replace('_', ' ');
            const colorClass = ROLE_COLORS[a.role] || 'bg-slate-100 dark:bg-white/5 text-slate-500 border border-slate-200 dark:border-white/10';

            return (
              <div
                key={a.id || a.userId || i}
                className="flex items-center gap-2.5 p-2.5 rounded-xl bg-slate-50/60 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/5 hover:border-indigo-500/30 hover:bg-white dark:hover:bg-white/[0.04] transition-all group"
              >
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-slate-100 to-slate-200 dark:from-white/10 dark:to-white/5 border border-slate-200/80 dark:border-white/10 flex items-center justify-center shrink-0">
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200">
                    {getInitials(firstName, lastName)}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-800 dark:text-white truncate">
                    {firstName || lastName ? `${firstName} ${lastName}`.trim() : 'Unknown'}
                  </p>
                </div>

                <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0 ${colorClass}`}>
                  {roleKey}
                </span>

                {canAssign && (
                  <button
                    type="button"
                    disabled={loading}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemove(a.userId || a.id, roleKey);
                    }}
                    className="w-6 h-6 rounded-md flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition disabled:opacity-50 shrink-0"
                    title="Remove Member"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
