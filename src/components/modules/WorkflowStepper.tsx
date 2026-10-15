"use client";

import React, { useTransition } from 'react';
import { cn } from '@/lib/utils';
import { 
  CheckCircle2, 
  Circle, 
  Clock, 
  ArrowRight,
  Loader2
} from 'lucide-react';
import { updateProjectStageAction } from '@/actions/workflow.actions';
import { toast } from 'sonner';

interface WorkflowStepperProps {
  projectId: string;
  currentStatus: string;
  userRole?: string;
}

const STAGES = [
  { id: 'lead_created', label: 'Lead' },
  { id: 'payment_pending', label: 'Payment' },
  { id: 'ready_for_dispatch', label: 'Ready' },
  { id: 'project_created', label: 'Assigned' },
  { id: 'data_collection', label: 'Field' },
  { id: 'data_sync', label: 'Survey' },
  { id: 'final_review', label: 'Draft' },
  { id: 'completed', label: 'Done' },
];

export function WorkflowStepper({ projectId, currentStatus, userRole }: WorkflowStepperProps) {
  const [isPending, startTransition] = useTransition();
  const effectiveStatus = currentStatus;
  const currentIndex = STAGES.findIndex(s => s.id === effectiveStatus);
  const nextStage = STAGES[currentIndex + 1];

  // Permission logic matching server action matrix
  const canAdvance = () => {
    if (!userRole || !nextStage) return false;
    if (userRole === 'admin') return true;
    
    const permissionMatrix: Record<string, string[]> = {
      'sales': ['lead_created', 'payment_pending'],
      'accountant': ['payment_done', 'ready_for_dispatch', 'project_created'],
      'engineer': ['data_collection', 'field_work', 'data_sync', 'final_review'],
      'field': ['field_work', 'data_sync'],
    };

    return (permissionMatrix[userRole] || []).includes(nextStage.id);
  };

  const handleAdvance = () => {
    if (!nextStage) return;

    startTransition(async () => {
      const result = await updateProjectStageAction(projectId, nextStage.id);
      if (result?.success) {
        toast.success("Workflow Synchronized", {
          description: `Project has successfully transitioned to ${nextStage.label} stage.`
        });
      } else {
        toast.error("Workflow Interruption", {
          description: result?.error || "Failed to advance project stage."
        });
      }
    });
  };

  return (
    <div className="space-y-12">
      <div className="relative flex items-center justify-between w-full">
        <div className="absolute top-1/2 left-0 w-full h-0.5 bg-gray-200 dark:bg-white/5 -translate-y-1/2" />
        
        {STAGES.map((stage, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isFuture = index > currentIndex;

          return (
            <div key={stage.id} className="relative z-10 flex flex-col items-center gap-3">
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center transition-all duration-500 border-2",
                isCompleted && "bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-indigo-500/20",
                isCurrent && "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-500/20 ring-4 ring-indigo-500/20",
                isFuture && "bg-white dark:bg-slate-900 border-gray-200 dark:border-white/10 text-gray-400"
              )}>
                {isCompleted ? <CheckCircle2 className="w-5 h-5" /> : 
                 isCurrent ? <Clock className="w-5 h-5 animate-pulse" /> : 
                 <Circle className="w-5 h-5" />}
              </div>
              
              <div className="flex flex-col items-center">
                <span className={cn(
                  "text-xs font-bold uppercase tracking-widest text-center max-w-[60px]",
                  isCompleted && "text-emerald-500",
                  isCurrent && "text-indigo-600 dark:text-indigo-400",
                  isFuture && "text-gray-400"
                )}>
                  {stage.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {nextStage && canAdvance() && (
        <div className="flex justify-center animate-in fade-in slide-in-from-bottom-2 duration-500">
          <button
            onClick={handleAdvance}
            disabled={isPending}
            className="flex items-center gap-3 px-8 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold shadow-lg shadow-indigo-500/20 transition-all hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 group"
          >
            {isPending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                Advance to {nextStage.label}
                <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </>
            )}
          </button>
        </div>
      )}

      {nextStage && !canAdvance() && (
        <div className="flex justify-center">
          <p className="text-sm font-bold text-slate-400 uppercase tracking-[0.2em] bg-slate-50 dark:bg-white/5 px-6 py-2 rounded-full border border-slate-200 dark:border-white/10">
            Awaiting {nextStage.label} Authorization
          </p>
        </div>
      )}
    </div>
  );
}
