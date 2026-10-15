"use client";

import React, { useState } from "react";
import { MilestonePaymentsTable } from "@/features/accounts/MilestonePaymentsTable";
import { PaymentReceiptsTable } from "@/features/accounts/PaymentReceiptsTable";
import { ProjectBillingTable, ProjectBillingSummary } from "@/features/accounts/ProjectBillingTable";
import { ExpenseEntryTrigger } from "@/features/accounts/ExpenseEntryTrigger";
import { Target, RefreshCw, Search, Receipt, Briefcase, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/modules/PageHeader";

interface BillingWorkspaceContentProps {
  initialInvoices?: any[];
  initialMilestones: any[];
  initialProjectsData: ProjectBillingSummary[];
  initialPayments?: any[];
}

export function BillingWorkspaceContent({
  initialInvoices = [],
  initialMilestones,
  initialProjectsData,
  initialPayments = []
}: BillingWorkspaceContentProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"projects" | "milestones" | "receipts" | "print_jobs">("projects");
  const [searchQuery, setSearchQuery] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const regularProjects = initialProjectsData.filter((p: any) => p.id !== 'PRJ-PRINT-DESK');
  const regularPayments = (initialPayments || []).filter((p: any) => p.project_id !== 'PRJ-PRINT-DESK');
  const printJobPayments = (initialPayments || []).filter((p: any) => p.project_id === 'PRJ-PRINT-DESK');

  const handleRefresh = () => {
    setIsRefreshing(true);
    router.refresh();
    setTimeout(() => setIsRefreshing(false), 500); // Visual feedback
  };

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-500">
      {/* Header */}
      <PageHeader
        title="Billing & Collections"
        subtitle="Manage client payments, milestones, and receipts."
        icon={Wallet}
        actions={
          <>
            {/* Search bar */}
            <div className="relative flex-1 md:w-80 md:flex-initial">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search project, client, or milestone title..."
                className="w-full pl-9 pr-4 h-10 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs outline-none focus:bg-white dark:focus:bg-slate-950 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-slate-900 dark:text-white placeholder:text-slate-400"
              />
            </div>

            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-2.5 rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 text-slate-500 dark:text-slate-400 transition-all hover:text-slate-900 dark:hover:text-white active:scale-95 flex-shrink-0 disabled:opacity-50"
              title="Refresh Data"
            >
              <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
            </button>

            <ExpenseEntryTrigger projects={regularProjects} />
          </>
        }
      />

      {/* Tabs list selector */}
      <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-100/80 dark:bg-white/5 rounded-xl border border-slate-200/20 dark:border-white/5 self-start w-fit">
        <button
          onClick={() => setActiveTab("projects")}
          className={cn(
            "px-4 py-2 text-[11px] font-bold rounded-lg transition-all uppercase tracking-wider flex items-center gap-2",
            activeTab === "projects"
              ? "bg-white dark:bg-white/10 text-indigo-600 dark:text-white shadow-sm"
              : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          )}
        >
          <Briefcase className="w-3.5 h-3.5" />
          Projects View ({regularProjects.length})
        </button>
        <button
          onClick={() => setActiveTab("milestones")}
          className={cn(
            "px-4 py-2 text-[11px] font-bold rounded-lg transition-all uppercase tracking-wider flex items-center gap-2",
            activeTab === "milestones"
              ? "bg-white dark:bg-white/10 text-indigo-600 dark:text-white shadow-sm"
              : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          )}
        >
          <Target className="w-3.5 h-3.5" />
          Milestone Payments ({initialMilestones.filter((m: any) => m.status !== 'paid').length})
        </button>
        <button
          onClick={() => setActiveTab("receipts")}
          className={cn(
            "px-4 py-2 text-[11px] font-bold rounded-lg transition-all uppercase tracking-wider flex items-center gap-2",
            activeTab === "receipts"
              ? "bg-white dark:bg-white/10 text-indigo-600 dark:text-white shadow-sm"
              : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          )}
        >
          <Receipt className="w-3.5 h-3.5" />
          Payment Receipts ({regularPayments.filter((p: any) => p.status === 'verified').length})
        </button>
        <button
          onClick={() => setActiveTab("print_jobs")}
          className={cn(
            "px-4 py-2 text-[11px] font-bold rounded-lg transition-all uppercase tracking-wider flex items-center gap-2",
            activeTab === "print_jobs"
              ? "bg-white dark:bg-white/10 text-indigo-600 dark:text-white shadow-sm"
              : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          )}
        >
          <Receipt className="w-3.5 h-3.5" />
          Print Jobs ({printJobPayments.filter((p: any) => p.status === 'verified').length})
        </button>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-12 space-y-6">
          {activeTab === "projects" && (
            <ProjectBillingTable 
              projects={regularProjects} 
              onRefresh={handleRefresh} 
              searchQuery={searchQuery}
            />
          )}
          {activeTab === "milestones" && (
            <MilestonePaymentsTable 
              milestones={initialMilestones} 
              onRefresh={handleRefresh} 
              searchQuery={searchQuery}
            />
          )}
          {activeTab === "receipts" && (
            <PaymentReceiptsTable 
              payments={regularPayments}
              searchQuery={searchQuery} 
            />
          )}
          {activeTab === "print_jobs" && (
            <PaymentReceiptsTable 
              payments={printJobPayments}
              searchQuery={searchQuery} 
            />
          )}
        </div>
      </div>
    </div>
  );
}
