"use client";

import React from "react";
import {
  CheckCircle2, Lock, Unlock, Package, AlertTriangle,
  MapPin, Shield, FileCheck, Truck
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface DeliveryReadinessPanelProps {
  projectId: string;
  checklist: any;
  userRole: string;
  isFrozen?: boolean;
  fieldReports?: any[];
  files?: any[];
  milestones?: any[];
  projectStatus?: string;
}

export function DeliveryReadinessPanel({
  projectId,
  checklist,
  userRole,
  isFrozen = false,
  fieldReports = [],
  files = [],
  milestones = [],
  projectStatus = "",
}: DeliveryReadinessPanelProps) {

  // Dynamic system evaluation logic
  const isSurveyDataVerified = (files || []).some((f: any) => f.category === 'survey_data');
  const isFieldSurveyComplete = (fieldReports || []).some((r: any) => r.report_type === 'completion');
  const isEngineerApproved = ['completed', 'archived'].includes(projectStatus || '');
  const isFilesFinalized = (files || []).some((f: any) => f.category === 'final_file' || f.category === 'survey_data');
  const isDeliverablesUploaded = (files || []).some((f: any) => f.category === 'final_file');
  
  // Payment check: Linked milestone status
  const isPaymentsCleared = (milestones || []).length > 0 
    ? (milestones || []).filter((m: any) => m.is_activation_gate || m.linked_stage).every((m: any) => m.status === 'paid')
    : true;

  // Issues check: No unresolved issues
  const isDependenciesResolved = (fieldReports || []).filter((r: any) => r.report_type === 'issue').every((r: any) => r.status === 'resolved');

  // Dynamic Blocker Detection Array
  const blockers: string[] = [];
  if (!isSurveyDataVerified) blockers.push("Survey Data Verified: Missing field survey data upload.");
  if (!isFieldSurveyComplete) blockers.push("Field Survey Complete: Survey completion report is outstanding.");
  if (!isEngineerApproved) blockers.push("Engineer Review Passed: Lead Engineer final sign-off is pending.");
  if (!isFilesFinalized) blockers.push("Files Finalized: Prerequisite deliverables have not been version-locked.");
  if (!isDeliverablesUploaded) blockers.push("Deliverables Uploaded: Client-ready files are missing from the vault.");
  if (!isPaymentsCleared) blockers.push("Payment Clearance: Outstanding milestone invoice is unpaid.");
  if (!isDependenciesResolved) blockers.push("Dependencies & Issues: Active field issues are currently blocking progress.");

  const items = [
    {
      key: "survey_verified",
      label: "Survey Data Verified",
      checked: isSurveyDataVerified,
      description: isSurveyDataVerified 
        ? "Survey data verified and uploaded to vault." 
        : "Awaiting field survey data upload.",
      icon: FileCheck,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      key: "field_survey_complete",
      label: "Field Survey Complete",
      checked: isFieldSurveyComplete,
      description: isFieldSurveyComplete 
        ? "Completion report submitted by Field Squad." 
        : "Awaiting field completion report.",
      icon: MapPin,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
    },
    {
      key: "engineer_approved",
      label: "Engineer Review Passed",
      checked: isEngineerApproved,
      description: isEngineerApproved 
        ? "Final package approved by Lead Engineer." 
        : "Project is awaiting Lead Engineer review and sign-off.",
      icon: Shield,
      color: "text-purple-500",
      bg: "bg-purple-500/10",
    },
    {
      key: "files_finalized",
      label: "Files Finalized",
      checked: isFilesFinalized,
      description: isFilesFinalized 
        ? "Required files version-locked." 
        : "Prerequisite deliverables not yet version-locked.",
      icon: FileCheck,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
    },
    {
      key: "deliverables_uploaded",
      label: "Deliverables Uploaded",
      checked: isDeliverablesUploaded,
      description: isDeliverablesUploaded 
        ? "Client-ready deliverables uploaded to file vault." 
        : "Final deliverables missing from library.",
      icon: Package,
      color: "text-indigo-500",
      bg: "bg-indigo-500/10",
    },
    {
      key: "payments_cleared",
      label: "Payment Clearance",
      checked: isPaymentsCleared,
      description: isPaymentsCleared 
        ? "All linked activation milestone payments cleared." 
        : "Milestone payment pending. Financial hold active.",
      icon: Truck,
      color: "text-violet-500",
      bg: "bg-violet-500/10",
    },
    {
      key: "dependencies_resolved",
      label: "Dependencies & Issues",
      checked: isDependenciesResolved,
      description: isDependenciesResolved 
        ? "All outstanding issue reports resolved." 
        : "Active issue blocker reports pending resolution.",
      icon: AlertTriangle,
      color: "text-rose-500",
      bg: "bg-rose-500/10",
    }
  ];

  const completedCount = items.filter((item) => item.checked).length;
  const totalCount = items.length;
  const isFullyReady = completedCount === totalCount;
  const progressPct = Math.round((completedCount / totalCount) * 100);

  const handleInfo = (label: string) => {
    toast.info(`"${label}" is an automated gate evaluated dynamically from database parameters.`);
  };

  return (
    <div className="space-y-5">
      {/* Header + Progress */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Truck className="w-4 h-4 text-indigo-500" />
          <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">
            Delivery Readiness
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-black text-slate-500">
            {completedCount}/{totalCount}
          </span>
          {isFullyReady ? (
            <span className="text-xs font-black px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              READY
            </span>
          ) : (
            <span className="text-xs font-black px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" />
              PENDING
            </span>
          )}
        </div>
      </div>

      {/* Progress Bar */}
      <div className="space-y-1.5">
        <div className="w-full h-2 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-700",
              isFullyReady
                ? "bg-gradient-to-r from-emerald-500 to-emerald-400"
                : progressPct >= 60
                ? "bg-gradient-to-r from-amber-500 to-yellow-400"
                : "bg-gradient-to-r from-indigo-600 to-indigo-400"
            )}
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <p className="text-xs text-slate-500 font-bold text-right">{progressPct}% system matched</p>
      </div>

      {/* Checklist Items */}
      <div className="space-y-2">
        {items.map((item) => {
          const Icon = item.icon;
          const isChecked = item.checked;

          return (
            <div
              key={item.key}
              onClick={() => handleInfo(item.label)}
              className={cn(
                "w-full flex items-center gap-4 p-4 rounded-2xl border text-left cursor-help transition-all group",
                isChecked
                  ? "bg-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/40"
                  : "bg-slate-50/50 dark:bg-white/5 border-slate-200 dark:border-white/8 hover:border-slate-300 dark:hover:border-white/15"
              )}
            >
              {/* Status Icon */}
              <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all",
                isChecked ? "bg-emerald-500/15" : item.bg
              )}>
                {isChecked ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                ) : (
                  <Icon className={cn("w-5 h-5", item.color)} />
                )}
              </div>

              {/* Label */}
              <div className="flex-1 min-w-0">
                <p className={cn(
                  "text-sm font-bold leading-tight flex items-center gap-1.5",
                  isChecked
                    ? "text-emerald-600 dark:text-emerald-400 line-through opacity-70"
                    : "text-slate-900 dark:text-slate-200"
                )}>
                  {item.label}
                </p>
                <p className="text-xs text-slate-400 mt-0.5 font-medium leading-tight">
                  {item.description}
                </p>
              </div>

              {/* Dynamic locking indicator */}
              {!isChecked && (
                <Lock className="w-3.5 h-3.5 text-slate-400 dark:text-slate-600 flex-shrink-0" />
              )}
            </div>
          );
        })}
      </div>

      {/* Blocker Alert Box */}
      {blockers.length > 0 && (
        <div className="p-5 rounded-2xl bg-rose-500/5 border border-rose-500/15 space-y-3">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-rose-500 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            Active Delivery Blockers ({blockers.length})
          </p>
          <ul className="space-y-1.5 pl-1 list-none">
            {blockers.map((b, idx) => (
              <li key={idx} className="text-sm text-slate-500 dark:text-slate-400 font-semibold flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-rose-500 flex-shrink-0" />
                {b}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Delivery Gate */}
      {isFullyReady && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 flex items-center justify-center">
            <Unlock className="w-5 h-5 text-emerald-500" />
          </div>
          <div>
            <p className="text-sm font-black text-emerald-600 dark:text-emerald-400">
              Delivery Gate Unlocked
            </p>
            <p className="text-xs text-emerald-600/70 dark:text-emerald-500/70 font-medium">
              All checks passed. Admin can now mark this project as completed.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
