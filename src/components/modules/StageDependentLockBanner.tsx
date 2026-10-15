"use client";

import React from "react";
import { AlertTriangle, ShieldAlert, Lock } from "lucide-react";

interface Milestone {
  id: string;
  title: string;
  amount: number;
  status: "pending" | "invoiced" | "paid";
  linked_stage?: string;
  block_after_stage?: string;
  is_activation_gate?: boolean;
}

interface StageDependentLockBannerProps {
  projectId: string;
  isFrozen: boolean;
  freezeReason: string | null;
  frozenAt: string | null;
  milestones: Milestone[];
  currentStage: string;
  dispatchOverrideRequested?: boolean;
  dispatchOverrideApproved?: boolean;
}

export function StageDependentLockBanner({
  projectId,
  isFrozen,
  freezeReason,
  frozenAt,
  milestones = [],
  currentStage,
  dispatchOverrideRequested = false,
  dispatchOverrideApproved = false,
}: StageDependentLockBannerProps) {
  
  // 1. Global Freeze Check
  if (isFrozen) {
    return (
      <div className="p-5 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-2xl flex items-start gap-4 shadow-sm">
        <div className="p-2.5 bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 rounded-xl flex-shrink-0">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-red-900 dark:text-red-100 uppercase tracking-wider">PROJECT OPERATIONS FROZEN</h3>
          <p className="text-xs font-medium text-red-700 dark:text-red-300">
            This project has been stopped. You will be notified when the accountant unfreezes it and operations can resume.
          </p>
          <div className="text-xs font-medium text-red-600 dark:text-red-400 pt-0.5 nums">
            Locked At: {frozenAt ? new Date(frozenAt).toLocaleString() : "N/A"}
          </div>
        </div>
      </div>
    );
  }

  // 2. Dispatch Override Requested Check
  if (dispatchOverrideRequested) {
    return (
      <div className="p-5 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 rounded-2xl flex items-start gap-4 shadow-sm animate-in slide-in-from-top-2 duration-300">
        <div className="p-2.5 bg-red-100 dark:bg-red-500/20 text-red-600 dark:text-red-400 rounded-xl flex-shrink-0">
          <ShieldAlert className="w-5 h-5" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-red-900 dark:text-red-100 uppercase tracking-wider">DISPATCH OVERRIDE REQUESTED</h3>
          <p className="text-xs font-medium text-red-700 dark:text-red-300">
            An operations override has been requested for this project. It is currently awaiting Admin approval.
          </p>
        </div>
      </div>
    );
  }

  // 3. Dispatch Override Approved Check
  if (dispatchOverrideApproved) {
    return (
      <div className="p-5 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 rounded-2xl flex items-start gap-4 shadow-sm animate-in slide-in-from-top-2 duration-300">
        <div className="p-2.5 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-xl flex-shrink-0">
          <ShieldAlert className="w-5 h-5" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-emerald-900 dark:text-emerald-100 uppercase tracking-wider">DISPATCH OVERRIDE APPROVED</h3>
          <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
            Admin has approved the dispatch override. You can proceed with operations despite pending milestone payments.
          </p>
        </div>
      </div>
    );
  }

  // 4. Stage-Dependent Payment Checks
  const pendingMilestones = milestones.filter(
    (m) => m.status !== "paid" && (m.block_after_stage === currentStage)
  );

  if (pendingMilestones.length > 0) {
    const activeMilestone = pendingMilestones[0];
    return (
      <div className="p-5 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 rounded-2xl flex items-start gap-4 shadow-sm animate-in slide-in-from-top-2 duration-300">
        <div className="p-2.5 bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded-xl flex-shrink-0">
          <Lock className="w-5 h-5" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-amber-900 dark:text-amber-100 uppercase tracking-wider">PAYMENT HOLD: STAGE BLOCKED</h3>
          <p className="text-xs font-medium text-amber-800 dark:text-amber-200">
            Operations for the current stage <b>[{currentStage.replace("_", " ")}]</b> have been suspended because the invoice for milestone <b>&quot;{activeMilestone.title}&quot;</b> (₹{activeMilestone.amount.toLocaleString()}) remains unpaid.
          </p>
          <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
            Please verify payment with Accounts to release this stage block and proceed with field/draft hand-offs.
          </p>
        </div>
      </div>
    );
  }

  return null;
}
