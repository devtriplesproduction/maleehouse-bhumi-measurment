'use client';

import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';
import { ActiveReworkInfo, detectActiveRework } from '@/lib/rework-utils';

export type { ActiveReworkInfo };
export { detectActiveRework };

export function ActiveReworkBanner({
  rework,
  className
}: {
  rework: ActiveReworkInfo;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "p-5 bg-rose-50/90 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/30 rounded-2xl flex items-start gap-4 shadow-sm animate-in slide-in-from-top-2 duration-300",
        className
      )}
    >
      <div className="p-2.5 bg-rose-100 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400 rounded-xl flex-shrink-0 mt-0.5">
        <RotateCcw className="w-5 h-5 animate-spin-reverse duration-1000" />
      </div>
      <div className="space-y-1.5 flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="text-sm font-bold text-rose-900 dark:text-rose-100 uppercase tracking-wider flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            {rework.title}
          </h3>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-200/70 dark:bg-rose-500/30 text-rose-800 dark:text-rose-300">
            {rework.badge}
          </span>
        </div>
        <p className="text-xs font-semibold text-rose-800 dark:text-rose-200 leading-relaxed">
          <span className="font-bold">Rejection Note:</span> &ldquo;{rework.reason.trim()}&rdquo;
        </p>
        {rework.instructions && (
          <p className="text-xs font-medium text-rose-700 dark:text-rose-300">
            <span className="font-bold">Revision Instructions:</span> {rework.instructions}
          </p>
        )}
        <div className="flex items-center gap-2 text-[11px] text-rose-600 dark:text-rose-400 pt-0.5">
          {rework.actor && (
            <span>
              Rejected by: <strong className="font-semibold">{rework.actor}</strong>
            </span>
          )}
          {rework.timestamp && (
            <span>
              · {formatDistanceToNow(new Date(rework.timestamp), { addSuffix: true })}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
