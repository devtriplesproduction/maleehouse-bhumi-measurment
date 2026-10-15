"use client";

import React, { useState, useEffect } from 'react';
import { 
  getGlobalStatsAction, 
  getSalesStatsAction,
  getAccountantStatsAction,
  getOperationsStatsAction,
  type StatItem 
} from '@/actions/stats.actions';
import { TrendingUp, Activity, AlertCircle, CheckCircle } from 'lucide-react';

interface RealtimeStatsGridProps {
  type: 'admin' | 'sales' | 'engineer' | 'accountant' | 'field' | 'operations' | 'hr';
}

export function RealtimeStatsGrid({ type }: RealtimeStatsGridProps) {
  const [stats, setStats] = useState<StatItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchStats = async () => {
      setLoading(true);
      setError(null);
      try {
        let result: StatItem[] = [];
        if (type === 'admin') {
          result = await getGlobalStatsAction();
        } else if (type === 'sales') {
          result = await getSalesStatsAction();
        } else if (type === 'accountant') {
          result = await getAccountantStatsAction();
        } else if (type === 'operations') {
          result = await getOperationsStatsAction();
        } else {
          // For roles needing ID, we might need to handle them differently or pass ID as prop
          // For now, let's just return empty or handle common roles
          result = [];
        }
        setStats(result || []);
      } catch (err) {
        console.error('Failed to fetch stats:', err);
        setError('Failed to sync real-time analytics.');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [type]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 animate-pulse">
        {[1, 2, 3, 4].map((i: any) => (
          <div key={i} className="h-32 bg-white/5 rounded-2xl border border-white/10" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 border border-red-500/20 bg-red-500/10 rounded-2xl text-red-500 text-sm">
        {error}
      </div>
    );
  }

  const getIcon = (label: string) => {
    if (label.includes('Pending') || label.includes('Overdue')) return <AlertCircle className="w-5 h-5 text-amber-500" />;
    if (label.includes('Live') || label.includes('Inbound')) return <Activity className="w-5 h-5 text-blue-500" />;
    if (label.includes('Total')) return <TrendingUp className="w-5 h-5 text-indigo-500" />;
    return <CheckCircle className="w-5 h-5 text-emerald-500" />;
  };

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 animate-in fade-in slide-in-from-top-4 duration-700">
      {(stats || []).map((stat, i) => (
        <div 
          key={i} 
          className="glass-card p-6 border-white/10 dark:bg-white/[0.03] group hover:bg-white/[0.08] transition-all duration-500 relative overflow-hidden shadow-xl shadow-black/[0.02]"
        >
          {/* Background Decorative Element */}
          <div className="absolute top-0 right-0 -mr-8 -mt-8 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl group-hover:bg-indigo-500/15 transition-all duration-500" />
          
          <div className="flex items-start justify-between relative z-10">
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">{stat.label}</p>
              <h3 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white leading-none">
                {stat.value}
              </h3>
            </div>
            <div className="p-3 bg-white/10 dark:bg-white/5 rounded-2xl border border-white/10 shadow-inner group-hover:scale-110 transition-transform duration-500">
              {getIcon(stat.label)}
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between relative z-10">
            <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">{stat.description}</p>
            {stat.trend && (
              <span className={`text-xs font-bold px-2 py-1 rounded-md uppercase tracking-widest border transition-colors ${
                stat.trend === 'Urgent' || stat.trend === 'Action Required' 
                ? 'bg-red-500/10 text-red-500 border-red-500/20' 
                : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
              }`}>
                {stat.trend}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
