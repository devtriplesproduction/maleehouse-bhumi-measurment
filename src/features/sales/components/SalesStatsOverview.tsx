'use client';

import React, { useMemo } from 'react';
import { 
  Users, 
  Clock, 
  CalendarDays
} from 'lucide-react';

interface Stat {
  label: string;
  value: string | number;
  change?: string;
  icon: any;
  color: string;
  description: string;
}

interface SalesStatsOverviewProps {
  leads?: any[];
}

export function SalesStatsOverview({ leads = [] }: SalesStatsOverviewProps) {
  const stats: Stat[] = useMemo(() => {
    const newLeadsCount = leads.filter(l => l.status === 'lead_created').length;
    
    const todayStr = new Date().toDateString();
    const followUpsToday = leads.filter(l => {
      if (!l.follow_up_date) return false;
      return new Date(l.follow_up_date).toDateString() === todayStr;
    }).length;

    const pendingPayments = leads.filter(l => 
      l.status === 'payment_pending'
    ).length;

    return [
      { 
        label: 'New Leads', 
        value: newLeadsCount, 
        change: newLeadsCount > 0 ? 'Active' : '', 
        icon: Users, 
        color: 'text-indigo-500',
        description: 'Incoming enquiries'
      },
      { 
        label: 'Follow-ups Today', 
        value: followUpsToday, 
        change: followUpsToday > 0 ? 'High Priority' : 'All clear', 
        icon: CalendarDays, 
        color: 'text-amber-500',
        description: 'Scheduled reminders'
      },
      { 
        label: 'Payment Pending', 
        value: pendingPayments, 
        change: pendingPayments > 0 ? 'Action Needed' : '', 
        icon: Clock, 
        color: 'text-emerald-500',
        description: 'Awaiting advance milestone'
      }
    ];
  }, [leads]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-top-4 duration-700">
      {stats.map((stat, i) => {
        const Icon = stat.icon;
        return (
          <div 
            key={i} 
            className="glass-card p-6 border-white/10 dark:bg-white/[0.03] group hover:bg-white/[0.08] transition-all duration-500 relative overflow-hidden shadow-xl shadow-black/[0.02]"
          >
            {/* Background Decorative Element */}
            <div className="absolute top-0 right-0 -mr-8 -mt-8 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl group-hover:bg-indigo-500/15 transition-all duration-500" />
            
            <div className="flex items-start justify-between relative z-10">
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{stat.label}</p>
                <h3 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white leading-none">
                  {stat.value}
                </h3>
              </div>
              <div className="p-3 bg-white/10 dark:bg-white/5 rounded-2xl border border-white/10 shadow-inner group-hover:scale-110 transition-transform duration-500">
                <Icon className={`w-5 h-5 ${stat.color}`} />
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between relative z-10">
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">{stat.description}</p>
              {stat.change && (
                <span className={`text-[9px] font-bold px-2 py-1 rounded-md uppercase tracking-widest border transition-colors ${
                  stat.change.includes('Urgent') || stat.change.includes('High') 
                  ? 'bg-red-500/10 text-red-500 border-red-500/20' 
                  : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                }`}>
                  {stat.change}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
