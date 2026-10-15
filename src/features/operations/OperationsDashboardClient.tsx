'use client';

import React from 'react';
import Link from 'next/link';
import { 
  Activity, MapPin, PenTool, Shield, ChevronRight, Layers, TrendingUp,
  Package, Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';

const STAGE_CONFIG: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  project_created:  { label: "Created",        color: "text-slate-400",   bg: "bg-slate-500/10",   dot: "bg-slate-400" },
  data_collection:  { label: "Data Collection", color: "text-sky-500",     bg: "bg-sky-500/10",     dot: "bg-sky-500" },
  field_work:       { label: "Field Survey",    color: "text-emerald-500", bg: "bg-emerald-500/10", dot: "bg-emerald-500" },
  data_sync:        { label: "Data Sync",       color: "text-cyan-500",    bg: "bg-cyan-500/10",    dot: "bg-cyan-500" },
  review:           { label: "QC Review",       color: "text-purple-500",  bg: "bg-purple-500/10",  dot: "bg-purple-500" },
  completed:        { label: "Delivered",       color: "text-emerald-500", bg: "bg-emerald-500/10", dot: "bg-emerald-500" },
  delivered:        { label: "Delivered",       color: "text-emerald-500", bg: "bg-emerald-500/10", dot: "bg-emerald-500" },
};

const ROLE_COLOR: Record<string, string> = {
  engineer: "bg-amber-500",
  field:    "bg-emerald-500",
  employee: "bg-slate-500",
};

function ProjectQueueCard({ project }: { project: any }) {
  const stageCfg = STAGE_CONFIG[project.status] || STAGE_CONFIG["project_created"];
  const isOverdue = project.target_completion_date
    ? new Date(project.target_completion_date) < new Date()
    : false;

  return (
    <Link
      href={`/projects/${project.id}`}
      className="group flex items-center gap-4 p-4 rounded-2xl bg-white/50 dark:bg-white/3 border border-white/8 hover:border-indigo-500/30 hover:bg-white dark:hover:bg-white/8 transition-all"
    >
      <div className={cn("w-2.5 h-2.5 rounded-full flex-shrink-0", stageCfg.dot)} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-base font-semibold text-slate-900 dark:text-white truncate">
            {project.name}
          </p>
          {isOverdue && (
            <span className="flex-shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-500 border border-rose-500/15">
              OVERDUE
            </span>
          )}
        </div>
        <p className="text-sm text-slate-500 font-medium truncate">{project.client_name}</p>
      </div>

      <span className={cn(
        "hidden sm:flex text-xs font-semibold px-3 py-1 rounded-full flex-shrink-0",
        stageCfg.bg, stageCfg.color
      )}>
        {stageCfg.label}
      </span>

      {project.team?.length > 0 && (
        <div className="flex -space-x-2 flex-shrink-0">
          {project.team.slice(0, 3).map((member: any, i: number) => (
            <div
              key={member.id}
              className={cn(
                "w-6 h-6 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center text-white text-[8px] font-black",
                ROLE_COLOR[member.role] || "bg-slate-500"
              )}
              title={`${member.user_profile?.first_name} (${member.role})`}
            >
              {(member.user_profile?.first_name?.[0] || "?")}
            </div>
          ))}
          {project.team.length > 3 && (
            <div className="w-6 h-6 rounded-full border-2 border-white dark:border-slate-900 bg-slate-500 flex items-center justify-center text-white text-[8px] font-black">
              +{project.team.length - 3}
            </div>
          )}
        </div>
      )}

      <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
    </Link>
  );
}

function QueueSection({
  title,
  icon: Icon,
  color,
  bg,
  projects,
  emptyText,
}: {
  title: string;
  icon: any;
  color: string;
  bg: string;
  projects: any[];
  emptyText: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center", bg)}>
            <Icon className={cn("w-4 h-4", color)} />
          </div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            {title}
          </h2>
        </div>
        <span className={cn("text-xs font-semibold px-3 py-1 rounded-full", bg, color)}>
          {projects.length}
        </span>
      </div>

      {projects.length === 0 ? (
        <div className="flex items-center justify-center py-8 border border-dashed border-white/10 rounded-2xl">
          <p className="text-xs text-slate-500 font-bold">{emptyText}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {projects.map((p) => (
            <ProjectQueueCard key={p.id} project={p} />
          ))}
        </div>
      )}
    </div>
  );
}

interface OperationsDashboardClientProps {
  queue: any;
  firstName: string;
  role: string;
}

export function OperationsDashboardClient({ queue, firstName, role }: OperationsDashboardClientProps) {

  const totalActive = queue?.all?.length || 0;
  const deliverablesQueue = queue?.active?.filter((p: any) => p.status === "final_review") || [];
  const fieldQueue = queue?.field || [];
  const reviewQueue = queue?.review || [];

  const kpis = [
    {
      label: "Active Projects",
      value: totalActive,
      icon: Layers,
      color: "text-indigo-500",
      bg: "bg-indigo-500/10",
    },
    {
      label: "Deliverables",
      value: deliverablesQueue.length,
      icon: Package,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      label: "Field Surveys",
      value: fieldQueue.length,
      icon: MapPin,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    },
    {
      label: "QC Pending",
      value: reviewQueue.length,
      icon: Shield,
      color: "text-purple-500",
      bg: "bg-purple-500/10",
    },
  ];

  return (
    <div className="space-y-10 animate-in fade-in duration-700">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-4 border-b border-slate-200/60 dark:border-white/5">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-600 dark:from-white dark:to-slate-400">
            Operations <span className="text-indigo-500">Command</span>
          </h1>
          <p className="text-lg text-slate-500 dark:text-slate-400 font-medium">
            Welcome back, {firstName} · {role.charAt(0).toUpperCase() + role.slice(1)} Terminal
          </p>
        </div>

        <div className="flex items-center gap-2">

          <Link
            href="/projects"
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-indigo-500 bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 transition-all ml-2"
          >
            <Activity className="w-3.5 h-3.5" />
            All Projects
          </Link>
        </div>
      </div>

      {/* KPI Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {kpis.map((kpi) => {
              const Icon = kpi.icon;
              return (
                <div 
                  key={kpi.label} 
                  className="glass-card p-6 border-white/10 dark:bg-white/[0.03] group hover:bg-white/[0.08] transition-all duration-500 relative overflow-hidden shadow-sm"
                >
                  <div className="flex items-start justify-between relative z-10">
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">{kpi.label}</p>
                      <h3 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white leading-none">
                        {kpi.value}
                      </h3>
                    </div>
                    <div className={cn("p-3 rounded-2xl transition-transform duration-500", kpi.bg)}>
                      <Icon className={cn("w-5 h-5", kpi.color)} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Main Queue Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-8">
            {/* Active / Engineering Queue */}
            <div className="glass-card border-white/10 p-6">
              <QueueSection
                title="Engineering Queue"
                icon={TrendingUp}
                color="text-indigo-500"
                bg="bg-indigo-500/10"
                projects={queue?.active || []}
                emptyText="No active engineering projects"
              />
            </div>

            {/* Field Queue */}
            <div className="glass-card border-white/10 p-6">
              <QueueSection
                title="Field Survey Queue"
                icon={MapPin}
                color="text-emerald-500"
                bg="bg-emerald-500/10"
                projects={fieldQueue}
                emptyText="No field surveys in progress"
              />
            </div>

            {/* QC Review Queue */}
            <div className="glass-card border-white/10 p-6">
              <QueueSection
                title="QC Review Queue"
                icon={Shield}
                color="text-purple-500"
                bg="bg-purple-500/10"
                projects={reviewQueue}
                emptyText="No projects pending QC"
              />
            </div>
          </div>

          {/* All Operational Projects Table */}
          <div className="glass-card border-white/10 p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-4">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-indigo-500" />
                <h2 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                  Full Operational Pipeline
                </h2>
              </div>
              <span className="text-sm text-slate-500 font-semibold">
                {totalActive} active project{totalActive !== 1 ? "s" : ""}
              </span>
            </div>

            {(queue?.all || []).length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center">
                  <Package className="w-6 h-6 text-slate-500" />
                </div>
                <p className="text-sm font-bold text-slate-500">No operational projects</p>
                <p className="text-xs text-slate-600">
                  Projects appear here once payment is confirmed and operations begin.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {(queue?.all || []).map((p: any) => (
                  <ProjectQueueCard key={p.id} project={p} />
                ))}
              </div>
            )}
          </div>
    </div>
  );
}
