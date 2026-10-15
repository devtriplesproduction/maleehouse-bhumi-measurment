'use client';

import React, { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2,
  Clock,
  Pause,
  ArrowRight,
  Target,
  DollarSign
} from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { cn } from '@/lib/utils';
import Link from 'next/link';

export interface Milestone {
  id: string;
  project_id: string;
  title: string;
  description?: string;
  amount: number;
  due_date: string | null;
  linked_stage?: string | null;
  is_activation_gate: boolean;
  status: 'pending' | 'paid' | 'hold' | 'payment_verification_pending';
  updated_at: string;
  projects?: {
    name: string;
    client_name: string;
    status: string;
    is_frozen: boolean;
  } | null;
}

interface UpcomingMilestonesWidgetProps {
  milestones: Milestone[];
}

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
};

export function UpcomingMilestonesWidget({ milestones }: UpcomingMilestonesWidgetProps) {
  const router = useRouter();

  // Filter for unpaid milestones and sort by due date ascending
  const upcomingMilestones = useMemo(() => {
    return milestones
      .filter((m) => m.status !== 'paid')
      .sort((a: any, b: any) => {
        if (a.due_date && !b.due_date) return -1;
        if (!a.due_date && b.due_date) return 1;
        if (a.due_date && b.due_date) {
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
        }
        return 0;
      });
  }, [milestones]);

  const getDueStatus = (dueDateStr: string | null) => {
    if (!dueDateStr) return { text: 'No Due Date', className: 'text-slate-400 dark:text-slate-500' };
    const date = new Date(dueDateStr);
    const days = differenceInDays(date, new Date());
    
    if (days < 0) {
      return { 
        text: `Overdue by ${Math.abs(days)}d`, 
        className: 'text-rose-600 dark:text-rose-400 font-bold' 
      };
    }
    if (days === 0) {
      return { 
        text: 'Due Today', 
        className: 'text-amber-600 dark:text-amber-400 font-bold' 
      };
    }
    if (days <= 3) {
      return { 
        text: `Due in ${days}d`, 
        className: 'text-amber-500 dark:text-amber-400 font-semibold' 
      };
    }
    return { 
      text: format(date, 'MMM d, yyyy'), 
      className: 'text-slate-500 dark:text-slate-400' 
    };
  };

  return (
    <div className="space-y-4">
      {/* Widget Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Target className="w-5 h-5 text-indigo-500" />
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Upcoming Milestones</h2>
        </div>
        <Link 
          href="/accounts/billing" 
          className="text-xs text-indigo-600 dark:text-indigo-400 font-bold hover:underline flex items-center gap-1 group"
        >
          Manage Collections
          <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
        </Link>
      </div>

      {upcomingMilestones.length === 0 ? (
        <div className="py-12 border border-dashed border-slate-200 dark:border-white/10 rounded-2xl bg-white/50 dark:bg-white/[0.01] text-center">
          <Clock className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
          <p className="text-xs text-slate-500 dark:text-slate-400">
            No upcoming milestones pending payment.
          </p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1 custom-scrollbar">
          {upcomingMilestones.map((m) => {
            const dueStatus = getDueStatus(m.due_date);
            const isProjectFrozen = m.projects?.is_frozen || m.projects?.status === 'on_hold';
            const isOverdue = m.due_date && differenceInDays(new Date(m.due_date), new Date()) < 0;

            const cardClasses = cn(
              'bg-white dark:bg-[#0f121b] border rounded-2xl p-4 transition-all duration-300 flex items-center justify-between group hover:shadow-md hover:border-slate-300 dark:hover:border-white/10 cursor-pointer',
              isProjectFrozen 
                ? 'border-rose-200 dark:border-rose-500/20 bg-rose-500/[0.01]' 
                : isOverdue
                ? 'border-rose-100 dark:border-rose-500/10'
                : 'border-slate-200/60 dark:border-white/5'
            );

            return (
              <div
                key={m.id}
                onClick={() => router.push('/accounts/billing')}
                className={cardClasses}
              >
                {/* Left: Icon + Info */}
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <div className={cn(
                    'w-9 h-9 rounded-xl flex items-center justify-center border flex-shrink-0 mt-0.5 shadow-sm transition-transform duration-300 group-hover:scale-105',
                    isProjectFrozen
                      ? 'bg-rose-500/10 border-rose-500/20 text-rose-500'
                      : isOverdue
                      ? 'bg-rose-500/5 border-rose-500/10 text-rose-500 dark:text-rose-400'
                      : 'bg-indigo-500/5 border-indigo-500/15 text-indigo-500 dark:text-indigo-400'
                  )}>
                    {isProjectFrozen ? (
                      <Pause className="w-4 h-4" />
                    ) : (
                      <DollarSign className="w-4 h-4" />
                    )}
                  </div>
                  
                  <div className="min-w-0 space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-slate-900 dark:text-white truncate">
                        {m.projects?.name || 'Standalone Assignment'}
                      </span>
                      {m.is_activation_gate && (
                        <span className="text-[9px] font-bold bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-100/50 dark:border-indigo-500/20 px-1.5 py-0.5 rounded uppercase tracking-wider">
                          Activation gate
                        </span>
                      )}
                      {m.status === 'hold' && (
                        <span className="text-[9px] font-bold bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-100/50 dark:border-rose-500/20 px-1.5 py-0.5 rounded uppercase tracking-wider">
                          On Hold
                        </span>
                      )}
                      {m.status === 'payment_verification_pending' && (
                        <span className="text-[9px] font-bold bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-100/50 dark:border-amber-500/20 px-1.5 py-0.5 rounded uppercase tracking-wider">
                          Verification Pending
                        </span>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400 font-medium flex-wrap">
                      <span className="flex items-center gap-1">
                        <Building2 className="w-3 h-3 text-slate-400" />
                        {m.projects?.client_name || 'Direct Client'}
                      </span>
                      <span className="text-slate-300 dark:text-slate-700">•</span>
                      <span className="text-slate-600 dark:text-slate-300 font-semibold truncate max-w-[200px]" title={m.title}>
                        {m.title}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Right: Amount + Due Date Status + Actions */}
                <div className="flex items-center gap-4 flex-shrink-0 pl-4">
                  <div className="text-right">
                    <p className="text-sm font-bold text-slate-900 dark:text-white nums flex items-center justify-end gap-1.5">
                      {formatCurrency(m.amount)}
                      <span className="text-[8px] leading-none py-0.5 px-1 bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400 rounded-sm uppercase tracking-widest font-bold">
                        {m.status === 'payment_verification_pending' ? 'VERIFY' : 'PAYMENT DUE'}
                      </span>
                    </p>
                    <p className={cn('text-[10px] mt-0.5', dueStatus.className)}>
                      {dueStatus.text}
                    </p>
                  </div>
                  
                  <div
                    className="p-1.5 rounded-lg border border-slate-200 dark:border-white/10 text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 group-hover:bg-slate-50 dark:group-hover:bg-white/5 transition-all"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
