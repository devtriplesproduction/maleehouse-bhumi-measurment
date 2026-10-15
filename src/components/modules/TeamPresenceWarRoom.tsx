"use client";

import React, { useEffect, useState, useMemo } from "react";
import { 
  Users, 
  Activity, 
  Zap, 
  Monitor, 
  Eye, 
  LayoutDashboard
} from "lucide-react";
import { usePresence, type PresenceUser } from "@/hooks/usePresence";
import { getTeamPresenceSummaryAction, type TeamMemberSummary } from "@/actions/presence.actions";
import { cn } from "@/lib/utils";
import Link from "next/link";

const ROLE_COLORS: Record<string, { border: string, bg: string, text: string, dot: string }> = {
  admin:      { border: "border-indigo-500", bg: "bg-indigo-500/10", text: "text-indigo-600", dot: "bg-indigo-500" },
  sales:      { border: "border-blue-500",   bg: "bg-blue-500/10",   text: "text-blue-600",   dot: "bg-blue-500" },
  engineer:   { border: "border-amber-500",  bg: "bg-amber-500/10",  text: "text-amber-600",  dot: "bg-amber-500" },
  field:      { border: "border-emerald-500", bg: "bg-emerald-500/10", text: "text-emerald-600", dot: "bg-emerald-500" },
  accountant: { border: "border-slate-500",  bg: "bg-slate-500/10",  text: "text-slate-600",  dot: "bg-slate-500" },
};

export function TeamPresenceWarRoom() {
  const { onlineUsers, count: onlineCount } = usePresence();
  const [teamBaseline, setTeamBaseline] = useState<TeamMemberSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const data = await getTeamPresenceSummaryAction();
      setTeamBaseline(data);
      setIsLoading(false);
    }
    load();
  }, []);

  // ── 1. Calculate Activity Metrics ──────────────────────────────────────────
  const healthScore = useMemo(() => {
    if (teamBaseline.length === 0) return 0;
    const ratio = (onlineCount / teamBaseline.length) * 100;
    // We'll treat > 30% online as "Active", > 60% as "High Intensity"
    return Math.min(Math.round(ratio), 100);
  }, [onlineCount, teamBaseline]);

  const activeProjectsCount = useMemo(() => {
    const paths = onlineUsers.map((u: any) => u.currentPath).filter((p: any) => p.includes("/projects/"));
    return new Set(paths).size;
  }, [onlineUsers]);

  // ── 2. Group Online Users by Role ──────────────────────────────────────────
  const roleGroups = useMemo(() => {
    const groups: Record<string, PresenceUser[]> = {};
    onlineUsers.forEach((u: any) => {
      const r = u.role.toLowerCase();
      if (!groups[r]) groups[r] = [];
      groups[r].push(u);
    });
    return groups;
  }, [onlineUsers]);

  return (
    <div className="flex flex-col gap-8 animate-in fade-in duration-700">
      
      {/* ── Top Row: Pulse Counters & Health ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Total Presence Card */}
        <div className="glass-card p-6 border-emerald-500/20 bg-emerald-500/[0.02]">
          <div className="flex items-start justify-between mb-4">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600">
              <Users className="w-6 h-6" />
            </div>
            <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-500/10 rounded-lg">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-bold text-emerald-600 uppercase tracking-widest">Live Now</span>
            </div>
          </div>
          <h3 className="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            {onlineCount} <span className="text-lg font-medium text-slate-400">/ {teamBaseline.length}</span>
          </h3>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-2">Active Teammates</p>
        </div>

        {/* Project Load Card */}
        <div className="glass-card p-6 border-indigo-500/20 bg-indigo-500/[0.02]">
          <div className="flex items-start justify-between mb-4">
            <div className="p-2.5 rounded-xl bg-indigo-500/10 text-indigo-600">
              <LayoutDashboard className="w-6 h-6" />
            </div>
          </div>
          <h3 className="text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
            {activeProjectsCount}
          </h3>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-2">Projects under view</p>
        </div>

        {/* Health Meter Card */}
        <div className="glass-card p-6 border-amber-500/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-6 opacity-10">
            <Zap className="w-20 h-20 text-amber-500" />
          </div>
          <div className="relative z-10">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-4">
              <p className="text-xs sm:text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Platform Intensity</p>
              <span className="text-sm font-black text-amber-600 self-start sm:self-auto">{healthScore}%</span>
            </div>
            <div className="h-4 w-full bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden border border-slate-200/50 dark:border-white/5">
              <div 
                className="h-full bg-gradient-to-r from-amber-400 to-orange-500 transition-all duration-1000 ease-out"
                style={{ width: `${healthScore}%` }}
              />
            </div>
            <div className="flex justify-between mt-3">
              <span className="text-xs font-bold text-slate-400 uppercase">Idle</span>
              <span className={cn(
                "text-xs font-black uppercase tracking-tighter",
                healthScore > 50 ? "text-orange-500 animate-pulse" : "text-slate-400"
              )}>
                {healthScore > 75 ? "Peak Operations" : healthScore > 40 ? "Active Load" : "Standby"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Main Content: Role Groups ── */}
      <div className="space-y-6">
        <div className="flex items-center gap-2 px-2">
          <Monitor className="w-5 h-5 text-indigo-500" />
          <h2 className="text-xl font-bold tracking-tight">Active Command Groups</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {Object.entries(ROLE_COLORS).map(([role, theme]) => {
            const users = roleGroups[role] || [];
            if (users.length === 0) return null;

            return (
              <div key={role} className={cn("glass-card p-0 overflow-hidden border-2", theme.border)}>
                {/* Group Header */}
                <div className={cn("px-4 py-3 flex items-center justify-between", theme.bg)}>
                  <div className="flex items-center gap-2">
                    <span className={cn("text-xs font-black uppercase tracking-widest", theme.text)}>
                      {role}s
                    </span>
                    <span className={cn("px-1.5 py-0.5 rounded text-xs font-bold bg-white dark:bg-black/20", theme.text)}>
                      {users.length}
                    </span>
                  </div>
                  <Activity className={cn("w-4 h-4", theme.text)} />
                </div>

                {/* Group Members */}
                <div className="p-4 space-y-4">
                  {users.map((u) => (
                    <div key={u.userId} className="flex items-start gap-3 group/member">
                      <div className="relative">
                        <div className={cn("w-10 h-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/5 flex items-center justify-center font-bold text-slate-700 dark:text-slate-200 text-xs shadow-sm", theme.border)}>
                          {(u.name || "Unknown User").split(" ").map((n: any) => n[0]).join("").toUpperCase().slice(0, 2)}
                        </div>
                        <div className={cn("absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-white dark:border-slate-900", theme.dot)} />
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{u.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Eye className="w-3 h-3 text-slate-400" />
                          <p className="text-xs font-medium text-slate-500 truncate italic">
                            Viewing: {(u.currentPath || "").split("/").pop() || "Dashboard"}
                          </p>
                        </div>
                      </div>

                      <Link 
                        href={u.currentPath}
                        className="opacity-0 group-hover/member:opacity-100 p-1.5 rounded-lg bg-slate-100 dark:bg-white/5 text-slate-400 hover:text-indigo-500 transition-all"
                      >
                        <ExternalLinkIcon className="w-3.5 h-3.5" />
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}

          {onlineCount === 0 && (
            <div className="col-span-full py-20 flex flex-col items-center justify-center text-center gap-4 bg-white/40 dark:bg-slate-900/40 rounded-3xl border-2 border-dashed border-slate-200 dark:border-white/5">
              <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center">
                <Monitor className="w-8 h-8 text-slate-300" />
              </div>
              <div>
                <h3 className="font-bold text-slate-500">System is on Standby</h3>
                <p className="text-xs text-slate-400">No active team members are currently online.</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ExternalLinkIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 3h6v6" />
      <path d="M10 14 21 3" />
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    </svg>
  );
}
