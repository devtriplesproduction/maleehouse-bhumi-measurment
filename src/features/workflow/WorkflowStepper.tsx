"use client";

import React from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type ProjectStage =
  | "lead_created"
  | "payment_pending"
  | "payment_done"
  | "project_created"
  | "data_collection"
  | "prototype"
  | "review"
  | "field_work"
  | "data_sync"
  | "final_review"
  | "completed";

export const STAGE_ORDER: ProjectStage[] = [
  "lead_created",
  "payment_pending",
  "payment_done",
  "project_created",
  "data_collection",
  "field_work",
  "data_sync",
  "final_review",
  "completed",
];

export const STAGE_LABELS: Record<ProjectStage, string> = {
  lead_created: "Lead Created",
  payment_pending: "Payment Pending",
  payment_done: "Payment Done",
  project_created: "Project Created",
  data_collection: "Data Collection",
  prototype: "Prototype",
  review: "Review",
  field_work: "Field Work",
  data_sync: "Data Sync",
  final_review: "Final Review",
  completed: "Delivered",
};

interface WorkflowStepperProps {
  currentStage: ProjectStage;
  /** If provided, renders a clickable "Advance to next stage" indicator */
  onAdvance?: (nextStage: ProjectStage) => void;
  isAdvancing?: boolean;
}

export function WorkflowStepper({
  currentStage,
  onAdvance,
  isAdvancing = false,
}: WorkflowStepperProps) {
  const currentIndex = STAGE_ORDER.indexOf(currentStage);
  const nextStage = currentIndex < STAGE_ORDER.length - 1
    ? STAGE_ORDER[currentIndex + 1]
    : null;

  return (
    <div className="w-full">
      {/* Layout: Vertical on mobile, Horizontal on desktop */}
      <div className="flex flex-col sm:flex-row sm:items-start gap-4 sm:gap-0 sm:overflow-x-auto sm:pb-4 sm:-mx-1 sm:px-1 custom-scrollbar">
        {STAGE_ORDER.map((stage, index) => {
          const isPast    = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isFuture  = index > currentIndex;

          return (
            <React.Fragment key={stage}>
              {/* Step node */}
              <div className="flex flex-row sm:flex-col items-center gap-4 sm:gap-0 sm:w-24 group">
                {/* Circle Container */}
                <div className="relative flex flex-col items-center">
                  <div
                    className={cn(
                      "relative w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-300 flex-shrink-0 z-10",
                      isPast && "bg-indigo-600 border-indigo-600",
                      isCurrent && [
                        "bg-indigo-600 border-indigo-600",
                        "shadow-[0_0_0_4px_rgba(99,102,241,0.20)]",
                        "ring-2 ring-indigo-500/30",
                      ],
                      isFuture && "bg-white dark:bg-slate-900 border-gray-300 dark:border-white/10"
                    )}
                  >
                    {isPast && <Check className="w-4 h-4 text-white" strokeWidth={2.5} />}
                    {isCurrent && (
                      <>
                        <span className="w-2.5 h-2.5 rounded-full bg-white" />
                        <span className="absolute inset-0 rounded-full border-2 border-indigo-400 animate-ping opacity-40" />
                      </>
                    )}
                    {isFuture && (
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-white/20" />
                    )}
                  </div>

                  {/* Vertical Connector (Mobile only) */}
                  {index < STAGE_ORDER.length - 1 && (
                    <div className={cn(
                      "sm:hidden w-0.5 h-8 mt-1 rounded-full transition-colors duration-300",
                      index < currentIndex ? "bg-indigo-500" : "bg-gray-200 dark:bg-white/5"
                    )} />
                  )}
                </div>

                {/* Label */}
                <div className="flex flex-col sm:items-center">
                  <span
                    className={cn(
                      "text-[11px] font-bold uppercase tracking-wider transition-colors sm:text-center sm:w-20 sm:mt-3 leading-tight",
                      isPast    && "text-indigo-600",
                      isCurrent && "text-indigo-700 dark:text-indigo-400 font-black",
                      isFuture  && "text-gray-400 dark:text-slate-600"
                    )}
                  >
                    {STAGE_LABELS[stage]}
                  </span>
                  {isCurrent && (
                    <span className="text-[9px] text-indigo-500/60 font-bold sm:hidden">CURRENT STAGE</span>
                  )}
                </div>
              </div>

              {/* Horizontal Connector line (Desktop only) */}
              {index < STAGE_ORDER.length - 1 && (
                <div className="hidden sm:flex flex-shrink-0 relative h-8 items-center" style={{ width: 40 }}>
                  <div
                    className={cn(
                      "h-0.5 w-full rounded-full transition-colors duration-300",
                      index < currentIndex ? "bg-indigo-500" : "bg-gray-200 dark:bg-white/5"
                    )}
                  />
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>

      {/* Advance Button */}
      {onAdvance && nextStage && (
        <div className="mt-5 flex items-center gap-3">
          <button
            onClick={() => onAdvance(nextStage)}
            disabled={isAdvancing}
            className={cn(
              "inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold",
              "bg-indigo-600 text-white hover:bg-indigo-700 active:scale-[0.98]",
              "shadow-sm shadow-indigo-500/20 transition-all duration-150",
              "disabled:opacity-60 disabled:cursor-not-allowed"
            )}
          >
            {isAdvancing ? (
              <>
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Advancing…
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                Advance to{" "}
                <span className="opacity-90">{STAGE_LABELS[nextStage]}</span>
              </>
            )}
          </button>

          <span className="text-xs text-gray-400">
            Current:{" "}
            <span className="font-semibold text-indigo-600">
              {STAGE_LABELS[currentStage]}
            </span>
          </span>
        </div>
      )}
    </div>
  );
}
