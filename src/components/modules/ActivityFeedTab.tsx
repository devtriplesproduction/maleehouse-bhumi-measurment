'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { formatDistanceToNow, isToday, subDays } from 'date-fns';
import {
  Clock, PenTool, FileText, AlertTriangle, MapPin, CheckCircle2,
  SlidersHorizontal, UserCheck, Banknote
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ActivityItem {
  id: string;
  projectId: string;
  projectName: string;
  summary: string;
  user: string;
  timestamp: string;
}

interface ActivityFeedTabProps {
  activities: ActivityItem[];
}

type FilterType = 'today' | '3days' | '7days' | '30days' | 'all';

// ─── Activity type classification ────────────────────────────────────────────
type ActivityType =
  | 'critical'     // qc returns, rejections — rose
  | 'actionable'   // prototype / blueprint uploads — blue
  | 'financial'    // invoice, payment, billing — amber
  | 'approval'     // approvals, deliverable sign-offs — emerald
  | 'survey'       // field visits, survey completions — sky
  | 'documents'    // document uploads, requirements — violet
  | 'assignment'   // engineer / team assignments — indigo
  | 'default';     // everything else — slate

interface ActivityConfig {
  type: ActivityType;
  Icon: React.ComponentType<{ className?: string }>;
  // icon ring colours
  iconBg: string;
  iconText: string;
  // row background + left border accent
  rowBg: string;
  rowBorder: string;
  // project name link colour
  nameColor: string;
  // optional: label badge shown on important items
  badge?: string;
  badgeColor?: string;
}

const CONFIGS: Record<ActivityType, ActivityConfig> = {
  critical: {
    type: 'critical',
    Icon: AlertTriangle,
    iconBg: 'bg-rose-500/10',
    iconText: 'text-rose-500',
    rowBg: 'bg-rose-500/[0.03] hover:bg-rose-500/[0.06] dark:bg-rose-500/[0.02] dark:hover:bg-rose-500/[0.04]',
    rowBorder: 'border-rose-400/40',
    nameColor: 'text-rose-600 dark:text-rose-400',
    badge: 'Action Needed',
    badgeColor: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20',
  },
  actionable: {
    type: 'actionable',
    Icon: PenTool,
    iconBg: 'bg-blue-500/10',
    iconText: 'text-blue-500',
    rowBg: 'bg-blue-500/[0.03] hover:bg-blue-500/[0.06] dark:bg-blue-500/[0.02] dark:hover:bg-blue-500/[0.04]',
    rowBorder: 'border-blue-400/40',
    nameColor: 'text-blue-600 dark:text-blue-400',
    badge: 'Review Required',
    badgeColor: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20',
  },
  financial: {
    type: 'financial',
    Icon: Banknote,
    iconBg: 'bg-amber-500/10',
    iconText: 'text-amber-500',
    rowBg: 'bg-amber-500/[0.03] hover:bg-amber-500/[0.06] dark:bg-amber-500/[0.02] dark:hover:bg-amber-500/[0.04]',
    rowBorder: 'border-amber-400/40',
    nameColor: 'text-amber-600 dark:text-amber-400',
  },
  approval: {
    type: 'approval',
    Icon: CheckCircle2,
    iconBg: 'bg-emerald-500/10',
    iconText: 'text-emerald-500',
    rowBg: 'bg-emerald-500/[0.02] hover:bg-emerald-500/[0.04] dark:bg-emerald-500/[0.01] dark:hover:bg-emerald-500/[0.03]',
    rowBorder: 'border-emerald-400/30',
    nameColor: 'text-emerald-600 dark:text-emerald-400',
  },
  survey: {
    type: 'survey',
    Icon: MapPin,
    iconBg: 'bg-sky-500/10',
    iconText: 'text-sky-500',
    rowBg: 'bg-sky-500/[0.02] hover:bg-sky-500/[0.04] dark:bg-sky-500/[0.01] dark:hover:bg-sky-500/[0.03]',
    rowBorder: 'border-sky-400/30',
    nameColor: 'text-sky-600 dark:text-sky-400',
  },
  documents: {
    type: 'documents',
    Icon: FileText,
    iconBg: 'bg-violet-500/10',
    iconText: 'text-violet-500',
    rowBg: 'bg-violet-500/[0.02] hover:bg-violet-500/[0.04] dark:bg-violet-500/[0.01] dark:hover:bg-violet-500/[0.03]',
    rowBorder: 'border-violet-400/30',
    nameColor: 'text-violet-600 dark:text-violet-400',
  },
  assignment: {
    type: 'assignment',
    Icon: UserCheck,
    iconBg: 'bg-indigo-500/10',
    iconText: 'text-indigo-500',
    rowBg: 'bg-indigo-500/[0.02] hover:bg-indigo-500/[0.04] dark:bg-indigo-500/[0.01] dark:hover:bg-indigo-500/[0.03]',
    rowBorder: 'border-indigo-400/30',
    nameColor: 'text-indigo-600 dark:text-indigo-400',
  },
  default: {
    type: 'default',
    Icon: Clock,
    iconBg: 'bg-slate-100 dark:bg-white/5',
    iconText: 'text-slate-400',
    rowBg: 'bg-slate-50/60 hover:bg-slate-100/60 dark:bg-white/[0.01] dark:hover:bg-white/[0.03]',
    rowBorder: 'border-slate-200 dark:border-white/5',
    nameColor: 'text-slate-600 dark:text-slate-400',
  },
};

function classify(summary: string): ActivityType {
  const s = summary.toLowerCase();
  if (s.includes('qc returned') || s.includes('rejected') || s.includes('failed'))
    return 'critical';
  if (s.includes('drafting uploaded') || s.includes('blueprint uploaded') || s.includes('deliverable uploaded'))
    return 'actionable';
  if (s.includes('invoice') || s.includes('payment') || s.includes('billing'))
    return 'financial';
  if (s.includes('approved') || s.includes('deliverable') || s.includes('signed off'))
    return 'approval';
  if (s.includes('survey') || s.includes('field visit') || s.includes('site visit') || s.includes('field_visit'))
    return 'survey';
  if (s.includes('document') || s.includes('requirement') || s.includes('uploaded') || s.includes('file'))
    return 'documents';
  if (s.includes('assigned') || s.includes('engineer') || s.includes('team'))
    return 'assignment';
  return 'default';
}

const FILTER_OPTIONS: { id: FilterType; label: string }[] = [
  { id: 'today',  label: 'Today' },
  { id: '3days',  label: 'Last 3 Days' },
  { id: '7days',  label: 'Last 7 Days' },
  { id: '30days', label: 'Last 30 Days' },
  { id: 'all',    label: 'All Activity' },
];

export function ActivityFeedTab({ activities }: ActivityFeedTabProps) {
  const [filter, setFilter] = useState<FilterType>('7days');

  const filtered = activities.filter((a) => {
    const d = new Date(a.timestamp);
    const now = new Date();
    switch (filter) {
      case 'today':  return isToday(d);
      case '3days':  return d >= subDays(now, 3);
      case '7days':  return d >= subDays(now, 7);
      case '30days': return d >= subDays(now, 30);
      default:       return true;
    }
  });

  return (
    <div className="space-y-5">
      {/* ── filter bar ──────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-100 dark:border-white/5">
        <div className="flex items-center gap-2 text-slate-400">
          <SlidersHorizontal className="w-3.5 h-3.5 shrink-0" />
          <span className="text-[11px] font-semibold tracking-wide text-slate-400">
            Filter Timeline
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-1">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              onClick={() => setFilter(opt.id)}
              className={cn(
                'px-3 py-1 rounded-lg text-[11px] font-medium tracking-wide border transition-all',
                filter === opt.id
                  ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-600 dark:text-indigo-400'
                  : 'bg-transparent border-transparent text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-100/80 dark:hover:bg-white/5'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-[10px] font-medium text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
          Action Needed
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
          Review Required
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
          Approved
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
          Financial
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-sky-500 shrink-0" />
          Survey
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-violet-500 shrink-0" />
          Documents
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0" />
          Assignment
        </span>
      </div>

      {/* ── timeline list ──────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="py-12 text-center text-xs font-medium text-slate-400 italic bg-slate-50/50 dark:bg-white/[0.02] rounded-xl border border-dashed border-slate-200 dark:border-white/5">
          no activities match the current filter.
        </div>
      ) : (
        <div className="max-h-[450px] overflow-y-auto pr-2 custom-scrollbar">
          <div className="relative pl-6 border-l border-slate-200 dark:border-white/5 space-y-3">
            {filtered.map((item) => {
              const type = classify(item.summary);
              const cfg  = CONFIGS[type];
              const Icon = cfg.Icon;
              const isImportant = type === 'critical' || type === 'actionable';

              return (
                <div
                  key={item.id}
                  className={cn(
                    'relative group rounded-xl border px-4 py-3 transition-all duration-200',
                    cfg.rowBg,
                    cfg.rowBorder,
                    isImportant && 'shadow-sm'
                  )}
                >
                  {/* timeline icon dot */}
                  <div
                    className={cn(
                      'absolute -left-[33px] top-3.5 w-6 h-6 rounded-lg flex items-center justify-center shrink-0',
                      cfg.iconBg
                    )}
                  >
                    <Icon className={cn('w-3 h-3', cfg.iconText)} />
                  </div>

                  {/* content */}
                  <div className="space-y-0.5">
                    {/* top row: project name + optional badge + timestamp */}
                    <div className="flex flex-wrap items-center justify-between gap-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <Link
                          href={`/projects/${item.projectId}`}
                          className={cn(
                            'text-[10px] font-bold uppercase tracking-widest truncate hover:underline leading-none',
                            cfg.nameColor
                          )}
                        >
                          {item.projectName}
                        </Link>
                        {cfg.badge && (
                          <span className={cn('px-1.5 py-0.5 rounded-md text-[9px] font-semibold tracking-wide leading-none shrink-0', cfg.badgeColor)}>
                            {cfg.badge}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 whitespace-nowrap">
                        {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
                      </span>
                    </div>

                    {/* summary */}
                    <p className={cn(
                      'text-xs leading-snug',
                      isImportant ? 'font-semibold text-slate-800 dark:text-slate-200' : 'font-medium text-slate-700 dark:text-slate-300'
                    )}>
                      {item.summary}
                    </p>

                    {/* by user */}
                    <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500">
                      By {item.user}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
