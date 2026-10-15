'use client';

import React from 'react';
import { 
  CheckCircle2, 
  Circle, 
  User, 
  Clipboard, 
  MapPin, 
  PenTool, 
  Layers, 
  ShieldCheck, 
  Users,
  AlertCircle,
  Lock
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface TeamMember {
  userId: string;
  firstName: string;
  lastName: string;
  role: string;
  email: string;
}

interface ProjectFile {
  id: string;
  uploaded_by: string;
  category: string;
}

interface WorkflowCheckpointsProps {
  projectStatus: string;
  teamMembers: TeamMember[];
  files: ProjectFile[];
}

export function WorkflowCheckpoints({ projectStatus, teamMembers, files }: WorkflowCheckpointsProps) {
  // 1. Get all assigned Field Engineers
  const fieldEngineers = teamMembers.filter((member: any) => member.role === 'field');

  // Check if a specific user has uploaded any field data
  const hasUserUploadedData = (userId: string) => {
    return files.some((file: any) => 
      file.uploaded_by === userId && 
      ['survey_data', 'control_point_image', 'control_point_csv'].includes(file.category)
    );
  };

  // 2. Define the ideal checkpoints
  const checkpoints = [
    {
      id: 1,
      title: 'Project Start',
      role: 'Engineer',
      icon: Clipboard,
      description: 'Project setup, commercial handover, and technical mobilization.',
      statusKey: ['project_created']
    },
    {
      id: 2,
      title: 'Gathering All Data',
      role: 'Engineer',
      icon: Clipboard,
      description: 'Initial site intelligence, details and requirement setup.',
      statusKey: ['data_collection']
    },
    {
      id: 3,
      title: 'Field Survey Team Allocation',
      role: 'Field Engineer',
      icon: Users,
      description: 'Assign squad members and schedule visits.',
      statusKey: ['field_work']
    },
    {
      id: 4,
      title: 'Collecting On-field Data',
      role: 'Individual Field Engineer',
      icon: MapPin,
      description: 'Field survey, monument setup, and point clouds collection.',
      statusKey: ['field_work'],
      isFieldUploadStep: true
    },
    {
      id: 5,
      title: 'Processing Survey Data',
      role: 'Engineer',
      icon: Layers,
      description: 'Process raw field coordinates and generate technical deliverables.',
      statusKey: ['data_sync']
    },
    {
      id: 6,
      title: 'Deliverables & QC Review',
      role: 'Engineer',
      icon: CheckCircle2,
      description: 'Final blueprint quality check and review clearance.',
      statusKey: ['final_review']
    },
    {
      id: 7,
      title: 'Pushing Final Deliverables',
      role: 'Engineer',
      icon: ShieldCheck,
      description: 'Release finalized project deliverables to client/design.',
      statusKey: ['completed']
    }
  ];

  // 3. Map database status to step numbers
  const getActiveStepNumber = (): number => {
    switch (projectStatus) {
      case 'project_created':
        return 1;
      case 'data_collection':
        return 2;
      case 'field_work':
        return fieldEngineers.length > 0 ? 4 : 3;
      case 'data_sync':
        return 5;
      case 'final_review':
        return 6;
      case 'completed':
      case 'archived':
        return 7;
      default:
        return 1;
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'Engineer':
        return User;
      case 'Field Engineer':
      case 'Individual Field Engineer':
        return MapPin;
      default:
        return User;
    }
  };

  const activeStep = getActiveStepNumber();

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-2">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/10 dark:bg-indigo-500/20 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4 text-indigo-500" />
            </div>
            Project Checkpoints
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Timeline tracker of standard operational pipelines and roles.</p>
        </div>
        
        {/* Dynamic overall progress indicator badge */}
        <div className="self-start sm:self-center px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-900 border border-slate-200/50 dark:border-white/5 text-xs font-semibold text-slate-600 dark:text-slate-300">
          Step <span className="text-indigo-600 dark:text-indigo-400 font-bold">{activeStep}</span> of {checkpoints.length}
        </div>
      </div>

      {/* Compact Auto-Expanding Timeline */}
      <div className="relative space-y-3 py-1 pl-1">
        {checkpoints.map((step, index) => {
          const StepIcon = step.icon;
          const isCompleted = step.id < activeStep;
          const isActive = step.id === activeStep;
          const isLocked = step.id > activeStep;
          const RoleIcon = getRoleIcon(step.role);

          return (
            <div key={step.id} className="relative pl-10 group transition-all">
              {/* Connector Line between step nodes */}
              {index < checkpoints.length - 1 && (
                <div 
                  className={cn(
                    "absolute left-[15px] top-7 bottom-[-15px] w-[2px] transition-all duration-500 z-0",
                    step.id < activeStep ? "bg-emerald-500" : "bg-slate-200 dark:bg-white/5"
                  )}
                />
              )}

              {/* Node Icon Indicator */}
              <div className={cn(
                "absolute left-0 top-0.5 w-8 h-8 rounded-full flex items-center justify-center border transition-all duration-500 z-10",
                isCompleted && "bg-emerald-500 border-emerald-500 text-white shadow-sm shadow-indigo-500/10",
                isActive && "bg-indigo-600 border-indigo-600 text-white shadow-md shadow-indigo-600/20 scale-105",
                isLocked && "bg-slate-100 dark:bg-slate-900 border-slate-200 dark:border-white/5 text-slate-400 dark:text-slate-600"
              )}>
                {isCompleted ? (
                  <CheckCircle2 className="w-4 h-4" />
                ) : isActive ? (
                  <StepIcon className="w-4 h-4 animate-pulse" />
                ) : (
                  <Lock className="w-3.5 h-3.5" />
                )}
              </div>

              {/* Content Panel: Expanded if active, Collapsed if completed or locked */}
              {isActive ? (
                /* Active Expanded Card */
                <div className="relative rounded-xl p-4 border bg-white dark:bg-slate-900/60 border-indigo-500/20 shadow-sm transition-all duration-300">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500" />
                  
                  {/* Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="nums text-xs font-semibold text-indigo-500">0{step.id}</span>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">
                        {step.title}
                      </h4>
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                        In Progress
                      </span>
                    </div>

                    <span className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider border self-start sm:self-center",
                      step.role === 'Engineer' && "bg-blue-500/5 text-blue-500 border-blue-500/10",
                      step.role === 'Field Engineer' && "bg-amber-500/5 text-amber-500 border-amber-500/10",
                      step.role === 'Individual Field Engineer' && "bg-amber-500/5 text-amber-500 border-amber-500/10"
                    )}>
                      <RoleIcon className="w-2.5 h-2.5" />
                      {step.role}
                    </span>
                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed mb-1.5">
                    {step.description}
                  </p>

                  {/* Checkpoint 5 Field Engineer upload sub-checklist */}
                  {step.isFieldUploadStep && (
                    <div className="mt-3 border-t border-slate-100 dark:border-white/5 pt-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping" />
                          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Field Squad Sync Status</span>
                        </div>
                      </div>

                      {fieldEngineers.length > 0 ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                          {fieldEngineers.map((eng) => {
                            const uploaded = hasUserUploadedData(eng.userId);
                            return (
                              <div 
                                key={eng.userId} 
                                className={cn(
                                  "flex items-center gap-2 p-1.5 rounded-lg border text-sm font-medium transition-all",
                                  uploaded 
                                    ? "bg-emerald-500/5 border-emerald-500/10 text-emerald-600 dark:text-emerald-400" 
                                    : "bg-slate-50 dark:bg-white/5 border-slate-100 dark:border-transparent text-slate-500"
                                )}
                              >
                                <div className={cn(
                                  "w-5 h-5 rounded-md flex items-center justify-center shrink-0",
                                  uploaded ? "bg-emerald-500/10" : "bg-slate-200/50 dark:bg-white/10"
                                )}>
                                  {uploaded ? (
                                    <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                                  ) : (
                                    <Circle className="w-3 h-3 text-slate-300 dark:text-slate-600" />
                                  )}
                                </div>
                                <span className="truncate">{eng.firstName} {eng.lastName}</span>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 p-2 bg-amber-500/5 border border-amber-500/10 rounded-lg text-amber-500 text-xs">
                          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                          <span>No field engineers assigned to this project squad yet.</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                /* Collapsed Minimal Row (Completed or Locked) */
                <div className={cn(
                  "flex flex-col sm:flex-row sm:items-center justify-between gap-1 p-2 rounded-lg transition-all duration-200",
                  isCompleted 
                    ? "hover:bg-slate-50 dark:hover:bg-white/[0.02]" 
                    : "opacity-50 select-none"
                )}>
                  <div className="flex items-center gap-2.5">
                    <span className={cn(
                      "nums text-xs font-semibold",
                      isCompleted ? "text-slate-500 dark:text-slate-400" : "text-slate-400 dark:text-slate-600"
                    )}>
                      0{step.id}
                    </span>
                    <span className={cn(
                      "text-xs font-medium tracking-tight",
                      isCompleted ? "text-slate-700 dark:text-slate-300" : "text-slate-400 dark:text-slate-600"
                    )}>
                      {step.title}
                    </span>
                    {isCompleted && (
                      <span className="text-xs text-emerald-500 dark:text-emerald-400/80 bg-emerald-500/5 px-1.5 py-0.5 rounded-full border border-emerald-500/10">
                        Completed
                      </span>
                    )}
                    {isLocked && (
                      <span className="text-xs text-slate-400 dark:text-slate-600 bg-slate-100 dark:bg-white/5 px-1.5 py-0.5 rounded-full border border-slate-200/50 dark:border-white/5 flex items-center gap-1">
                        <Lock className="w-2 h-2" /> Locked
                      </span>
                    )}
                  </div>

                  <span className={cn(
                    "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider border self-start sm:self-center shrink-0",
                    isCompleted 
                      ? (step.role === 'Engineer' && "bg-blue-500/5 text-blue-500 border-blue-500/10") ||
                        (step.role === 'Field Engineer' && "bg-amber-500/5 text-amber-500 border-amber-500/10") ||
                        (step.role === 'Individual Field Engineer' && "bg-amber-500/5 text-amber-500 border-amber-500/10")
                      : "bg-slate-100 dark:bg-white/5 text-slate-400 dark:text-slate-600 border-slate-200/50 dark:border-white/5"
                  )}>
                    <RoleIcon className="w-2.5 h-2.5" />
                    {step.role}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
