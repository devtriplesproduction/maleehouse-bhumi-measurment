'use client';

import React, { useState, useTransition } from 'react';
import { 
  Upload, 
  ArrowRight, 
  CheckCircle2, 
  DollarSign,
  Loader2,
  Calculator,
  Clock,
  ListTodo,
  AlertCircle,
  ShieldCheck,
  Check
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { FileUploader } from '@/components/modules/FileUploader';
import { updateProjectStageAction } from '@/actions/workflow.actions';
import { updateProjectAction } from '@/actions/project.actions';
import { addProjectCommentAction } from '@/actions/comment.actions';
import { toast } from 'sonner';

interface SalesActionsPanelProps {
  projectId: string;
  currentStatus: string;
  project?: any;
  files?: any[];
}

export function SalesActionsPanel({ projectId, currentStatus, project, files = [] }: SalesActionsPanelProps) {
  const [showUploader, setShowUploader] = useState(false);
  const [uploadCategory, setUploadCategory] = useState<'receipt' | 'requirements'>('requirements');
  const [isPending, startTransition] = useTransition();

  const checklist = project?.requirement_checklist || {};

  // Handlers
  const handleUploadClick = (category: 'receipt' | 'requirements') => {
    setUploadCategory(category);
    setShowUploader(true);
  };

  const handleAdvance = async (nextStage: string, label: string) => {
    startTransition(async () => {
      const result = await updateProjectStageAction(projectId, nextStage);
      if (result.success) {
        toast.success("Lead Stage Updated", {
          description: `Lead moved to ${label} successfully.`
        });
      } else {
        toast.error("Operation Failed", {
          description: result.error
        });
      }
    });
  };

  const toggleChecklist = async (key: string, currentValue: boolean) => {
    const newValue = !currentValue;
    
    // Optimistic UI update could go here, but we'll let Server Actions handle revalidation.
    startTransition(async () => {
      const result = await updateProjectAction(projectId, {
        requirement_checklist: { ...checklist, [key]: newValue }
      });
      if (result.success) {
        toast.success("Requirement Verified", {
          description: `Checklist item updated successfully.`
        });
        const commentMsg = newValue 
          ? `System Log: Requirement Checklist - ${key.replace(/_/g, ' ')} was verified and marked as complete.`
          : `System Log: Requirement Checklist - ${key.replace(/_/g, ' ')} was marked as incomplete.`;
        await addProjectCommentAction(projectId, commentMsg, "internal");
      } else {
        toast.error("Verification Failed", {
          description: result.error
        });
      }
    });
  };

  // Validations
  const hasClientDetails = !!project?.client_name;
  const hasContactInfo = !!project?.client_contact;
  const hasSiteLocation = !!project?.client_address || !!project?.site_coordinates;
  const hasSurveyType = project?.services && project.services.length > 0;
  const hasProjectReqs = !!project?.survey_requirements;
  const hasTargetDate = !!project?.target_completion_date;
  
  // File Validations
  const uploadedRequirements = files.filter((f: any) => f.category === 'requirements').length > 0;

  // Operational Validation Engine
  const completeness = {
    client_info: hasClientDetails && hasContactInfo,
    site_location: hasSiteLocation,
    survey_type: hasSurveyType && hasProjectReqs,
    timeline: hasTargetDate && checklist.timeline_confirmed,
    budget: checklist.budget_discussed,
    docs: uploadedRequirements,
    site_images: checklist.site_images_received,
    requirements: checklist.client_requirements_verified,
    measurements: checklist.measurements_confirmed,
    satbara: checklist.satbara_uploaded
  };

  const isReadyForHandoff = Object.values(completeness).every((v: any) => v === true);

  const isLead = currentStatus === 'lead_created' || currentStatus === 'requirement_gathering';
  const isPayment = currentStatus === 'payment_pending';

  if (!isLead && !isPayment) {
    return (
      <div className="glass-card p-8 border-emerald-500/20 bg-emerald-500/5 space-y-8 relative overflow-hidden animate-in fade-in duration-500">
        <div className="absolute top-0 right-0 p-4 opacity-[0.03]">
          <CheckCircle2 className="w-48 h-48 text-emerald-500" />
        </div>

        <div className="relative z-10 space-y-2">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 text-[10px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-md">
              Lifecycle Step Complete
            </span>
          </div>
          <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            Sales & CRM Lifecycle Finalized
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400 font-medium">
            This project has successfully completed requirement verification, commercial setup, and billing milestones.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 relative z-10">
          {/* Client Details Summary */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold tracking-widest uppercase text-slate-400">Verified Client Details</h4>
            <div className="space-y-3 bg-white/40 dark:bg-slate-900/40 border border-slate-200 dark:border-white/5 rounded-2xl p-5">
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Client Name</p>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{project?.client_name || 'N/A'}</p>
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Contact Info</p>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{project?.client_contact || 'N/A'}</p>
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Site Coordinates / Address</p>
                <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
                  {project?.client_address || project?.site_coordinates || 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Survey Requirements</p>
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 italic mt-0.5 leading-relaxed">
                  &quot;{project?.survey_requirements || 'No custom requirements specified.'}&quot;
                </p>
              </div>
            </div>
          </div>

          {/* Verified Items & Assets */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold tracking-widest uppercase text-slate-400">Completed Milestones</h4>
            <div className="space-y-2 bg-white/40 dark:bg-slate-900/40 border border-slate-200 dark:border-white/5 rounded-2xl p-5">
              <div className="flex items-center gap-2.5 text-xs font-bold text-emerald-500">
                <Check className="w-4 h-4 shrink-0" strokeWidth={3} />
                <span>Commercial Amount & Milestones Configured</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs font-bold text-emerald-500">
                <Check className="w-4 h-4 shrink-0" strokeWidth={3} />
                <span>Initial Payment / Billing Setup Synchronized</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs font-bold text-emerald-500">
                <Check className="w-4 h-4 shrink-0" strokeWidth={3} />
                <span>Technical Specifications Confirmed</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs font-bold text-emerald-500">
                <Check className="w-4 h-4 shrink-0" strokeWidth={3} />
                <span>Field Prerequisites Handed Over</span>
              </div>
            </div>
            
            <div className="p-4 rounded-xl bg-indigo-500/5 border border-indigo-500/10 flex items-center gap-3">
              <ShieldCheck className="w-5 h-5 text-indigo-500 shrink-0" />
              <p className="text-[10px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-400">
                The operations control tower is coordinating technical execution, field work, and technical drafting.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card p-8 border-indigo-500/20 bg-indigo-500/5 space-y-8 relative overflow-hidden">
      <div className="absolute top-0 right-0 p-4 opacity-[0.03]">
        <ShieldCheck className="w-48 h-48 text-indigo-500" />
      </div>

      <div className="relative z-10 space-y-2">
        <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
          <ListTodo className="w-5 h-5 text-indigo-500" />
          Requirement Verification Engine
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Ensure all mandatory operational data is verified before handoff to the Accounts department.
        </p>
      </div>

      {isLead && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 relative z-10">
          {/* Automated Data Validation */}
          <div className="space-y-4">
            <h4 className="text-sm font-bold tracking-widest uppercase text-slate-400">Data Completeness</h4>
            <div className="space-y-3">
              <ValidationItem label="Client Details & Contact" valid={completeness.client_info} />
              <ValidationItem label="Site Location Data" valid={completeness.site_location} />
              <ValidationItem label="Survey Type & Requirements" valid={completeness.survey_type} />
              <ValidationItem label="Target Deadline Confirmed" valid={hasTargetDate} />
              <ValidationItem label="Required Documents Uploaded" valid={completeness.docs} />
            </div>

            <div className="pt-4 flex gap-4">
               <button 
                onClick={() => handleUploadClick('requirements')}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 hover:border-indigo-500 transition-colors text-sm font-bold shadow-sm"
              >
                <Upload className="w-4 h-4 text-indigo-500" />
                Upload Docs
              </button>
            </div>
          </div>

          {/* Interactive Checklist System */}
          <div className="space-y-4">
             <h4 className="text-sm font-bold tracking-widest uppercase text-slate-400">Sales Checklist</h4>
             <div className="space-y-2">
               <ChecklistItem 
                 label="Budget Discussed & Approved" 
                 checked={checklist.budget_discussed} 
                 onChange={() => toggleChecklist('budget_discussed', checklist.budget_discussed)} 
                 isPending={isPending}
               />
               <ChecklistItem 
                 label="Timeline Expectations Confirmed" 
                 checked={checklist.timeline_confirmed} 
                 onChange={() => toggleChecklist('timeline_confirmed', checklist.timeline_confirmed)} 
                 isPending={isPending}
               />
               <ChecklistItem 
                 label="Site Images Received" 
                 checked={checklist.site_images_received} 
                 onChange={() => toggleChecklist('site_images_received', checklist.site_images_received)} 
                 isPending={isPending}
               />
               <ChecklistItem 
                 label="Satbara Uploaded / verified" 
                 checked={checklist.satbara_uploaded} 
                 onChange={() => toggleChecklist('satbara_uploaded', checklist.satbara_uploaded)} 
                 isPending={isPending}
               />
               <ChecklistItem 
                 label="Measurements Confirmed" 
                 checked={checklist.measurements_confirmed} 
                 onChange={() => toggleChecklist('measurements_confirmed', checklist.measurements_confirmed)} 
                 isPending={isPending}
               />
               <ChecklistItem 
                 label="Client Requirements Verified" 
                 checked={checklist.client_requirements_verified} 
                 onChange={() => toggleChecklist('client_requirements_verified', checklist.client_requirements_verified)} 
                 isPending={isPending}
               />
             </div>
          </div>
        </div>
      )}

      {/* Handoff Workflow */}
      <div className="pt-6 border-t border-slate-200 dark:border-white/5 relative z-10">
        {isLead && (
          <div className="space-y-4">
            {!isReadyForHandoff && (
              <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-500/10 border border-amber-500/20">
                <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-amber-600 dark:text-amber-400">Incomplete Handoff Package</h4>
                  <p className="text-xs text-amber-600/80 dark:text-amber-400/80 mt-1">
                    Please ensure all mandatory data is filled and all checklist items are verified before pushing to the Accounts Queue.
                  </p>
                </div>
              </div>
            )}

            <button 
              disabled={!isReadyForHandoff || isPending}
              onClick={() => handleAdvance('payment_pending', 'Payment Pending')}
              className={cn(
                "w-full flex items-center justify-center gap-3 py-4 text-white rounded-xl font-bold shadow-lg transition-all group",
                isReadyForHandoff && !isPending 
                  ? "bg-indigo-600 hover:bg-indigo-700 shadow-indigo-500/20" 
                  : "bg-slate-300 dark:bg-slate-800 text-slate-500 cursor-not-allowed shadow-none"
              )}
            >
              {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                <>
                  <DollarSign className="w-5 h-5" />
                  Proceed to Payment Stage
                  <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                </>
              )}
            </button>
            <p className="text-[10px] text-center text-slate-500 font-bold uppercase tracking-widest">
              Advances project to commercial payment and milestone collection phase
            </p>
          </div>
        )}

        {isPayment && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 text-center text-xs font-bold uppercase tracking-widest">
            Awaiting Client Payment & Accountant Verification
          </div>
        )}
      </div>

      <FileUploader 
        projectId={projectId} 
        open={showUploader} 
        onOpenChange={setShowUploader} 
      />
    </div>
  );
}

function ValidationItem({ label, valid }: { label: string; valid: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div className={cn(
        "p-1 rounded-full",
        valid ? "bg-emerald-500/20 text-emerald-500" : "bg-slate-200 dark:bg-slate-800 text-slate-400"
      )}>
        {valid ? <Check className="w-3 h-3" strokeWidth={3} /> : <div className="w-3 h-3 rounded-full border-2 border-current" />}
      </div>
      <span className={cn(
        "text-sm font-medium",
        valid ? "text-slate-700 dark:text-slate-300" : "text-slate-500"
      )}>
        {label}
      </span>
    </div>
  );
}

function ChecklistItem({ label, checked, onChange, isPending }: { label: string; checked: boolean; onChange: () => void; isPending: boolean }) {
  return (
    <button 
      disabled={isPending}
      onClick={onChange}
      className={cn(
        "w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all",
        checked 
          ? "bg-indigo-500/10 border-indigo-500/30" 
          : "bg-white dark:bg-slate-900 border-slate-200 dark:border-white/5 hover:border-indigo-500/30"
      )}
    >
      <div className={cn(
        "p-1 rounded-full",
        checked ? "bg-indigo-500 text-white shadow-sm shadow-indigo-500/50" : "bg-slate-100 dark:bg-slate-800 text-transparent"
      )}>
        <Check className="w-4 h-4" strokeWidth={3} />
      </div>
      <span className={cn(
        "text-sm font-bold",
        checked ? "text-indigo-700 dark:text-indigo-400" : "text-slate-600 dark:text-slate-400"
      )}>
        {label}
      </span>
    </button>
  );
}
