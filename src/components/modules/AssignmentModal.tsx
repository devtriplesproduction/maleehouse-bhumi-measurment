"use client";

import React, { useState, useTransition } from "react";
import {
  UserPlus, X, Search, Loader2,
  Shield, MapPin, User
} from "lucide-react";
import { cn } from "@/lib/utils";
// Removed local-db import
import { assignTeamMemberAction, removeTeamMemberAction } from "@/actions/operations.actions";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

const LOCAL_USERS: any[] = [];
const ROLE_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  engineer: { label: "Engineer",    color: "text-amber-500",   bg: "bg-amber-500/10",   icon: Shield },
  field:    { label: "Field",       color: "text-emerald-500", bg: "bg-emerald-500/10", icon: MapPin },
};

const OPERATIONAL_ROLES = ["engineer", "field"];

interface AssignmentModalProps {
  projectId: string;
  currentAssignments: Array<{
    id: string;
    user_id: string;
    role: string;
    user_profile: { first_name: string; last_name: string; email: string; role: string };
  }>;
  onClose: () => void;
}

export function AssignmentModal({ projectId, currentAssignments, onClose }: AssignmentModalProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRole, setSelectedRole] = useState<string>("engineer");
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Filter users who match selected role and search
  const eligibleUsers = LOCAL_USERS.filter((u) => {
    const roleMatch = u.role === selectedRole || u.role === "admin";
    const isAlreadyAssigned = currentAssignments.some(
      (a) => a.user_id === u.id && a.role === selectedRole
    );
    const searchMatch =
      !searchQuery ||
      `${u.first_name} ${u.last_name}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase());
    return roleMatch && !isAlreadyAssigned && searchMatch;
  });

  const handleAssign = (userId: string) => {
    startTransition(async () => {
      const result = await assignTeamMemberAction(projectId, userId, selectedRole);
      if (result?.success) {
        toast.success(`Team member assigned as ${selectedRole}.`);
        router.refresh();
      } else {
        toast.error(result?.error || "Failed to assign.");
      }
    });
  };

  const handleRemove = async (assignmentId: string) => {
    setRemovingId(assignmentId);
    const result = await removeTeamMemberAction(assignmentId, projectId);
    setRemovingId(null);
    if (result?.success) {
      toast.success("Team member removed.");
      router.refresh();
    } else {
      toast.error(result?.error || "Failed to remove.");
    }
  };

  const getInitials = (first: string, last: string, email: string) => {
    if (first || last) return `${(first || "")[0]}${(last || "")[0]}`.toUpperCase();
    return email.slice(0, 2).toUpperCase();
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-2xl glass-card border-white/15 shadow-2xl shadow-black/40 flex flex-col max-h-[90vh] overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 flex items-center justify-center">
              <UserPlus className="w-5 h-5 text-indigo-500" />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
                Team Assignment Engine
              </h2>
              <p className="text-xs text-slate-400 font-medium">
                Assign operational roles to project squad
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center hover:bg-white/10 text-slate-400 hover:text-slate-200 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-1 min-h-0">
          {/* Left: Role Selector */}
          <div className="w-40 border-r border-white/8 p-3 flex flex-col gap-1 flex-shrink-0">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 px-2 pb-2">
              Role Filter
            </p>
            {OPERATIONAL_ROLES.map((role) => {
              const cfg = ROLE_CONFIG[role];
              const Icon = cfg.icon;
              const count = currentAssignments.filter((a) => a.role === role).length;
              return (
                <button
                  key={role}
                  onClick={() => setSelectedRole(role)}
                  className={cn(
                    "flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all",
                    selectedRole === role
                      ? `${cfg.bg} ${cfg.color}`
                      : "text-slate-500 hover:bg-white/5 hover:text-slate-300"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Icon className="w-3.5 h-3.5" />
                    {cfg.label}
                  </div>
                  {count > 0 && (
                    <span className={cn(
                      "text-xs font-black px-1.5 py-0.5 rounded-md",
                      selectedRole === role ? "bg-white/20" : "bg-white/5 text-slate-400"
                    )}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Right: User List + Current Assignments */}
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">

            {/* Search Bar */}
            <div className="p-4 border-b border-white/5">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder={`Search ${selectedRole} users...`}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 text-xs bg-white/5 border border-white/10 rounded-xl text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/50"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-5 no-scrollbar">

              {/* Current Assignments for this role */}
              {currentAssignments.filter((a) => a.role === selectedRole).length > 0 && (
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 mb-2">
                    Currently Assigned
                  </p>
                  <div className="space-y-2">
                    {currentAssignments
                      .filter((a) => a.role === selectedRole)
                      .map((asg) => (
                        <div
                          key={asg.id}
                          className="flex items-center justify-between p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/15"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white text-xs font-black">
                              {getInitials(
                                asg.user_profile.first_name,
                                asg.user_profile.last_name,
                                asg.user_profile.email
                              )}
                            </div>
                            <div>
                              <p className="text-xs font-bold text-slate-900 dark:text-white">
                                {asg.user_profile.first_name} {asg.user_profile.last_name}
                              </p>
                              <p className="text-xs text-slate-400">{asg.user_profile.email}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => handleRemove(asg.id)}
                            disabled={removingId === asg.id}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-black text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all disabled:opacity-50"
                          >
                            {removingId === asg.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <X className="w-3 h-3" />
                            )}
                            Remove
                          </button>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {/* Available Users to Assign */}
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 mb-2">
                  Available to Assign
                </p>

                {eligibleUsers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
                    <div className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center">
                      <User className="w-5 h-5 text-slate-500" />
                    </div>
                    <p className="text-xs font-bold text-slate-500">No users available</p>
                    <p className="text-xs text-slate-600">
                      All {selectedRole} users are already assigned or none exist.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {eligibleUsers.map((u) => (
                      <div
                        key={u.id}
                        className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/5 hover:border-white/10 transition-all group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-600 flex items-center justify-center text-white text-xs font-black">
                            {getInitials(u.first_name, u.last_name, u.email)}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-slate-900 dark:text-slate-200">
                              {u.first_name} {u.last_name}
                            </p>
                            <p className="text-xs text-slate-400">{u.email}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleAssign(u.id)}
                          disabled={isPending}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-black text-indigo-500 hover:bg-indigo-500/10 rounded-lg transition-all disabled:opacity-50 opacity-0 group-hover:opacity-100"
                        >
                          {isPending ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <UserPlus className="w-3 h-3" />
                          )}
                          Assign
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-white/8 bg-white/2">
          <p className="text-xs text-slate-500 font-bold">
            {currentAssignments.length} member{currentAssignments.length !== 1 ? "s" : ""} assigned total
          </p>
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-xl text-xs font-black text-white bg-indigo-600 hover:bg-indigo-700 transition-all"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
