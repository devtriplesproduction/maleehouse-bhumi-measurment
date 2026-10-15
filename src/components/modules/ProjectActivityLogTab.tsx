'use client';

import React from 'react';
import { 
  Zap, 
  UserPlus, 
  DollarSign, 
  Lock, 
  Unlock, 
  FileText, 
  CheckCircle,
  Activity,
  ShieldCheck,
  Calendar
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';

interface ActivityLogItem {
  id: string;
  project_id: string;
  user_id: string;
  action: string;
  details?: any;
  created_at: string;
  actor_profile?: {
    first_name: string;
    last_name: string;
    email: string;
    role: string;
  };
}

interface WorkflowHistoryItem {
  id: string;
  project_id: string;
  from_stage: string | null;
  to_stage: string;
  changed_by: string;
  comment: string;
  created_at: string;
  changed_by_profile?: {
    first_name: string;
    last_name: string;
    email: string;
    role: string;
  };
}

interface ProjectActivityLogTabProps {
  activityLogs: ActivityLogItem[];
  workflowHistory: WorkflowHistoryItem[];
}

interface MergedTimelineItem {
  id: string;
  title: string;
  description: string;
  type: 'workflow' | 'system' | 'finance' | 'admin';
  icon: any;
  iconColor: string;
  iconBg: string;
  created_at: string;
  actorName: string;
  actorRole: string;
}

export default function ProjectActivityLogTab({
  activityLogs = [],
  workflowHistory = []
}: ProjectActivityLogTabProps) {
  
  // Format history from stage transitions
  const mappedWorkflowHistory: MergedTimelineItem[] = workflowHistory.map((w: any) => {
    const actorName = `${w.changed_by_profile?.first_name || ''} ${w.changed_by_profile?.last_name || ''}`.trim() || 'System';
    const actorRole = w.changed_by_profile?.role || 'system';
    
    const fromStage = w.from_stage ? w.from_stage.replace('_', ' ') : 'initial state';
    const toStage = w.to_stage.replace('_', ' ');

    let title = 'Project Stage Updated';
    let icon = Zap;
    let iconColor = 'text-indigo-500';
    let iconBg = 'bg-indigo-500/10';

    if (w.to_stage === 'completed') {
      title = 'Project Delivered Successfully';
      icon = ShieldCheck;
      iconColor = 'text-emerald-500';
      iconBg = 'bg-emerald-500/10';
    } else if (w.to_stage === 'frozen') {
      title = 'Project Frozen';
      icon = Lock;
      iconColor = 'text-rose-500';
      iconBg = 'bg-rose-500/10';
    }

    return {
      id: w.id,
      title,
      description: `Workflow stage changed from "${fromStage}" to "${toStage}". Notes: "${w.comment}"`,
      type: 'workflow',
      icon,
      iconColor,
      iconBg,
      created_at: w.created_at,
      actorName,
      actorRole
    };
  });

  // Format system logs
  const mappedActivityLogs: MergedTimelineItem[] = activityLogs.map((a: any) => {
    const actorName = `${a.actor_profile?.first_name || ''} ${a.actor_profile?.last_name || ''}`.trim() || 'System';
    const actorRole = a.actor_profile?.role || 'system';
    
    let title = a.action.replace('_', ' ').replace(/\b\w/g, (c: string) => c.toUpperCase());
    let description = '';
    let icon = Activity;
    let iconColor = 'text-slate-500';
    let iconBg = 'bg-slate-500/10';
    let type: MergedTimelineItem['type'] = 'system';

    const details = a.details || {};

    switch (a.action) {
      case 'PROJECT_CREATED':
        title = 'Project Created';
        description = 'Survey project container initialized in Malee House ERP database.';
        icon = CheckCircle;
        iconColor = 'text-emerald-500';
        iconBg = 'bg-emerald-500/10';
        break;
      case 'ACCOUNTANT_ASSIGNED':
        title = 'Accountant Owner Assigned';
        description = `Dedicated finance owner set up for project billing.`;
        icon = UserPlus;
        iconColor = 'text-blue-500';
        iconBg = 'bg-blue-500/10';
        type = 'admin';
        break;
      case 'MILESTONES_CREATED':
        title = 'Payment Milestones Structured';
        description = `Indian GST billing schedule formulated (Milestone count: ${details.count || 0}).`;
        icon = DollarSign;
        iconColor = 'text-indigo-500';
        iconBg = 'bg-indigo-500/10';
        type = 'finance';
        break;
      case 'PROJECT_FROZEN':
        title = 'Operations Lockout Applied (Frozen)';
        description = `Operations frozen due to Category: ${details.reason || 'payment_pending'}. Notes: "${details.comment || ''}"`;
        icon = Lock;
        iconColor = 'text-rose-500';
        iconBg = 'bg-rose-500/10';
        type = 'finance';
        break;
      case 'PROJECT_UNFROZEN':
        title = 'Operations Lockout Lifted (Unfrozen)';
        description = `Operations restored. Notes: "${details.comment || ''}"`;
        icon = Unlock;
        iconColor = 'text-emerald-500';
        iconBg = 'bg-emerald-500/10';
        type = 'finance';
        break;
      case 'INVOICE_GENERATED':
        title = 'GST Invoice Generated';
        description = `Professional GST invoice logged. Invoice No: ${details.invoice_number || 'N/A'}, Amount: INR ${details.amount || 0}.`;
        icon = FileText;
        iconColor = 'text-blue-500';
        iconBg = 'bg-blue-500/10';
        type = 'finance';
        break;
      case 'PAYMENT_VERIFIED':
        title = 'Payment Cleared & Received';
        description = `Payment transaction verified. Transaction Ref: ${details.transaction_id || 'N/A'}, Amount: INR ${details.amount || 0}.`;
        icon = CheckCircle;
        iconColor = 'text-emerald-500';
        iconBg = 'bg-emerald-500/10';
        type = 'finance';
        break;
      case 'FILE_UPLOADED':
        title = 'Project Document Synced';
        description = `Document Vault updated: "${details.file_name || ''}" synced in Category: ${details.category || ''}.`;
        icon = FileText;
        iconColor = 'text-blue-500';
        iconBg = 'bg-blue-500/10';
        break;
      default:
        description = JSON.stringify(details);
        break;
    }

    return {
      id: a.id,
      title,
      description,
      type,
      icon,
      iconColor,
      iconBg,
      created_at: a.created_at,
      actorName,
      actorRole
    };
  });

  // Find the timestamp when the project was pushed to operations (project_created)
  const pushToEngineerEvent = workflowHistory.find((w: any) => w.to_stage === 'project_created');
  const cutoffTime = pushToEngineerEvent ? new Date(pushToEngineerEvent.created_at).getTime() : Infinity;

  // Combine and sort chronologically (Newest first)
  const timelineItems = [...mappedWorkflowHistory, ...mappedActivityLogs]
    .filter((item: any) => {
      // If project has been pushed to engineer, only show items at or after that time
      // If not yet pushed, we don't show the early sales/finance activities here
      return new Date(item.created_at).getTime() >= cutoffTime;
    })
    .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return (
    <div className="space-y-6">
      
      {/* Activity Log Header */}
      <div className="border-b border-slate-100 dark:border-white/5 pb-4 px-2">
        <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-wider flex items-center gap-2">
          <Activity className="w-5 h-5 text-indigo-500" />
          System Activity Log
        </h3>
        <p className="text-xs text-slate-400 mt-1">Read-only, system-generated audit trail of all project events and transitions.</p>
      </div>

      {/* Timeline Grid */}
      <div className="relative pl-6 space-y-6 max-w-4xl mx-auto py-4">
        
        {/* Central connecting line */}
        <div className="absolute left-[15px] top-4 bottom-4 w-[2px] bg-slate-200 dark:bg-white/5" />

        {timelineItems.map((item) => {
          const Icon = item.icon;
          
          return (
            <div key={item.id} className="relative pl-10 group animate-in fade-in duration-500">
              
              {/* Timeline dot/icon */}
              <div className={cn(
                "absolute left-0 top-0.5 w-8 h-8 rounded-full flex items-center justify-center border border-slate-250 dark:border-white/10 shadow-sm transition-all duration-300 z-10",
                item.iconBg,
                item.iconColor
              )}>
                <Icon className="w-4 h-4" />
              </div>

              {/* Log details card */}
              <div className="glass-card border-slate-200 dark:border-white/10 p-5 rounded-2xl bg-gradient-to-br from-white/95 to-slate-50/50 dark:from-slate-900/40 dark:to-slate-900/10 hover:shadow-md transition-shadow">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white tracking-tight">{item.title}</h4>
                  
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}</span>
                  </div>
                </div>

                <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 font-medium leading-relaxed">
                  {item.description}
                </p>

                {/* Actor profile */}
                <div className="border-t border-slate-100 dark:border-white/5 pt-2 mt-3 flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-slate-100 dark:bg-white/5 border border-slate-200/50 dark:border-white/10 flex items-center justify-center text-[8px] font-bold text-slate-500">
                    {item.actorName[0] || 'S'}
                  </div>
                  <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{item.actorName}</span>
                  <span className="text-[8px] font-bold tracking-wider px-1.5 py-0.5 rounded bg-slate-100 text-slate-550 border border-slate-200 dark:bg-white/5 dark:text-slate-450 dark:border-white/10">
                    {item.actorRole.replace('_', ' ')}
                  </span>
                </div>
              </div>

            </div>
          );
        })}

        {timelineItems.length === 0 && (
          <div className="py-16 text-center glass-card border-slate-200 dark:border-white/10 rounded-3xl flex flex-col items-center justify-center">
            <Activity className="w-10 h-10 text-slate-200 dark:text-slate-800 mb-2 animate-pulse" />
            <p className="text-xs text-slate-400 font-bold">No system activity events recorded.</p>
          </div>
        )}

      </div>

    </div>
  );
}
