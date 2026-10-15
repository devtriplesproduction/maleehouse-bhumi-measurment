import React from "react";
import { Building2 } from "lucide-react";

export default function ClientPortalPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#0c101f] p-6 font-sans">
      <div className="max-w-md w-full bg-white dark:bg-white/[0.03] backdrop-blur-xl p-8 rounded-2xl shadow-2xl border border-slate-200/80 dark:border-white/10 text-center space-y-5">
        <div className="w-12 h-12 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto">
          <Building2 className="w-6 h-6" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Commercial Setup Initialized</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Quotation approval via client portal is no longer required. Project commercial amounts and milestone payments are managed directly through our survey operations team.
          </p>
        </div>
      </div>
    </div>
  );
}
