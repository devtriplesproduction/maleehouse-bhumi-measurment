'use client';

import React, { useState } from 'react';
import { 
  ClipboardCheck, 
  Files, 
  Send, 
  ShieldCheck, 
  AlertTriangle,
  ArrowRight,
  CheckSquare,
  Square,
  Loader2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { finalizeRequirementsAction } from '../../actions';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

interface RequirementSystemProps {
  projectId: string;
  projectStatus: string;
}

const CHECKLIST_ITEMS = [
  { id: 'docs', label: 'Documents Received (Satbara/Deeds)', description: 'Legal ownership documents verified.' },
  { id: 'images', label: 'Site Images Received', description: 'Clear photos of site context and boundaries.' },
  { id: 'measurements', label: 'Measurements/Area Discussed', description: 'Primary plot dimensions confirmed.' },
  { id: 'budget', label: 'Budget Discussed', description: 'Financial expectations aligned.' },
  { id: 'timeline', label: 'Timeline Discussed', description: 'Delivery deadlines agreed upon.' },
];

export function RequirementSystem({ projectId, projectStatus }: RequirementSystemProps) {
  const router = useRouter();
  const [checkedItems, setCheckedItems] = useState<string[]>([]);
  const [isFinalizing, setIsFinalizing] = useState(false);

  const toggleItem = (id: string) => {
    setCheckedItems(prev => 
      prev.includes(id) ? prev.filter((i: any) => i !== id) : [...prev, id]
    );
  };

  const isAllChecked = checkedItems.length === CHECKLIST_ITEMS.length;

  const handlePushToAccounts = async () => {
    setIsFinalizing(true);
    try {
      const result = await finalizeRequirementsAction(projectId);
      if (result.success) {
        toast.success("Push to Accounts Successful", { 
          description: "Project is now in the Accounts queue for verification." 
        });
      } else {
        toast.error("Workflow Error", { description: result.error });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsFinalizing(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
      {/* Checklist Section */}
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-indigo-500" />
            Requirement Checklist
          </h3>
          <p className="text-xs text-slate-500 font-medium">Verify all critical data points before handover.</p>
        </div>

        <div className="space-y-3">
          {CHECKLIST_ITEMS.map((item) => {
            const isChecked = checkedItems.includes(item.id);
            return (
              <div 
                key={item.id}
                onClick={() => toggleItem(item.id)}
                className={cn(
                  "p-4 rounded-2xl border transition-all cursor-pointer flex items-start gap-4 group",
                  isChecked 
                    ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-900 dark:text-emerald-400" 
                    : "bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 text-slate-600 hover:border-indigo-500/30"
                )}
              >
                <div className={cn(
                  "mt-0.5 transition-colors",
                  isChecked ? "text-emerald-500" : "text-slate-300 group-hover:text-indigo-500"
                )}>
                  {isChecked ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                </div>
                <div>
                  <p className="text-sm font-bold">{item.label}</p>
                  <p className="text-[10px] opacity-60 font-medium">{item.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Push to Accounts / Status Section */}
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-black tracking-tight text-slate-900 dark:text-white flex items-center gap-2">
            <Send className="w-5 h-5 text-indigo-500" />
            Push To Accounts
          </h3>
          <p className="text-xs text-slate-500 font-medium">Finalize and notify the finance department.</p>
        </div>

        <div className="glass-card p-8 border-indigo-500/10 bg-indigo-500/5 flex flex-col items-center text-center space-y-6">
          <div className={cn(
            "w-20 h-20 rounded-[2rem] flex items-center justify-center transition-all duration-700",
            isAllChecked ? "bg-emerald-500 text-white shadow-2xl shadow-indigo-500/30 scale-110" : "bg-white/50 dark:bg-black/20 text-slate-300 border-2 border-dashed border-slate-200 dark:border-white/10"
          )}>
            <ShieldCheck className={cn("w-10 h-10", isAllChecked && "animate-pulse")} />
          </div>

          <div className="space-y-2">
            <h4 className="text-xl font-black">Ready for Handover?</h4>
            <p className="text-xs text-slate-500 max-w-[240px] mx-auto leading-relaxed">
              Once pushed, the project will move to the **Accounts Queue** for invoice generation and payment verification.
            </p>
          </div>

          <button
            onClick={handlePushToAccounts}
            disabled={isFinalizing || projectStatus === 'payment_pending'}
            className={cn(
              "w-full py-4 rounded-2xl font-black uppercase tracking-[0.2em] text-xs flex items-center justify-center gap-3 transition-all",
              projectStatus !== 'payment_pending' && !isFinalizing
                ? "bg-indigo-600 text-white shadow-xl shadow-indigo-500/30 hover:bg-indigo-700 hover:-translate-y-1 active:translate-y-0"
                : "bg-slate-200 dark:bg-white/5 text-slate-400 cursor-not-allowed border border-white/5"
            )}
          >
            {isFinalizing ? <Loader2 className="w-5 h-5 animate-spin" /> : (
              <>
                {projectStatus === 'payment_pending' ? 'Awaiting Payment' : 'Proceed to Payment'}
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>

          {!isAllChecked && projectStatus !== 'payment_pending' && (
            <div className="flex items-center gap-2 text-[10px] font-bold text-amber-600 bg-amber-500/10 px-4 py-2 rounded-xl border border-amber-500/20">
              <AlertTriangle className="w-3.5 h-3.5" />
              Checklist incomplete. Ready for quick handover.
            </div>
          )}
        </div>

        <div className="p-6 rounded-2xl border border-slate-200 dark:border-white/10 space-y-4">
           <h5 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
             <Files className="w-4 h-4" /> Supporting Assets
           </h5>
           <p className="text-xs text-slate-500">
             All site images, PDFs, and maps uploaded via the **Digital Vault** will be automatically preserved during handover.
           </p>
        </div>
      </div>
    </div>
  );
}
