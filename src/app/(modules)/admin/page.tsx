import React, { Suspense } from 'react';
import Link from 'next/link';
import { requireRole } from '@/lib/auth-guard';
import { getAdminWorkspaceDataAction } from '@/actions/workspace.actions';
import { getMilestonePaymentStatusAggregateAction } from '@/actions/admin.actions';
import { DispatchOverrideRequestsWidget } from '@/components/modules/DispatchOverrideRequestsWidget';
import DashboardNotificationCenter from '@/components/modules/DashboardNotificationCenter';
import { AdminMilestonePieChart } from '@/components/modules/AdminMilestonePieChart';
import { AdminProjectTrendChart } from '@/components/modules/AdminProjectTrendChart';
import { AdminIncomeExpenseChart } from '@/components/modules/AdminIncomeExpenseChart';
import { PageHeader } from '@/components/modules/PageHeader';
import { cn } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import {
  Users,
  FolderKanban,
  Landmark,
  Coins,
  ShieldAlert,
  ChevronRight,
  ArrowRight,
  Megaphone,
  Layers,
  Clock
} from 'lucide-react';

// ── Header Quick Action Button ──
function QuickAction({ 
  label, 
  href, 
  icon: Icon,
  variant = 'indigo'
}: { 
  label: string; 
  href: string; 
  icon: React.ElementType;
  variant?: 'indigo' | 'amber' | 'emerald' | 'purple';
}) {
  const styles = {
    indigo: "hover:bg-indigo-50/70 dark:hover:bg-indigo-500/10 hover:border-indigo-300/80 dark:hover:border-indigo-500/30 hover:text-indigo-600 dark:hover:text-indigo-450",
    amber: "hover:bg-amber-50/70 dark:hover:bg-amber-500/10 hover:border-amber-300/80 dark:hover:border-amber-500/30 hover:text-amber-600 dark:hover:text-amber-450",
    emerald: "hover:bg-emerald-50/70 dark:hover:bg-emerald-500/10 hover:border-emerald-300/80 dark:hover:border-emerald-500/30 hover:text-emerald-600 dark:hover:text-emerald-450",
    purple: "hover:bg-purple-50/70 dark:hover:bg-purple-500/10 hover:border-purple-300/80 dark:hover:border-purple-500/30 hover:text-purple-600 dark:hover:text-purple-450",
  };

  return (
    <Link 
      href={href} 
      className={cn(
        "flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 transition-all text-xs font-semibold text-slate-700 dark:text-slate-200 shadow-xs hover:shadow group",
        styles[variant]
      )}
    >
      <Icon className={cn("w-3.5 h-3.5 text-slate-400 transition-colors", {
        "group-hover:text-indigo-500": variant === 'indigo',
        "group-hover:text-amber-500": variant === 'amber',
        "group-hover:text-emerald-500": variant === 'emerald',
        "group-hover:text-purple-500": variant === 'purple',
      })} />
      {label}
    </Link>
  );
}

// ── Action Row Card ──
function ActionCardItem({ label, description, count, href, icon: Icon }: {
  label: string;
  description: string;
  count: number;
  href: string;
  icon: React.ElementType;
}) {
  const hasPending = count > 0;
  return (
    <Link 
      href={href} 
      className={cn(
        "group flex items-center justify-between p-3 rounded-xl border transition-all duration-200 cursor-pointer shadow-xs",
        hasPending 
          ? "bg-white dark:bg-slate-900/60 border-amber-500/30 dark:border-amber-500/20 hover:border-amber-500/50 hover:shadow-md hover:bg-amber-500/[0.04]" 
          : "bg-white/40 dark:bg-white/[0.02] border-slate-200/60 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/[0.05]"
      )}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className={cn(
          "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border transition-all",
          hasPending ? "bg-amber-500/10 text-amber-500 border-amber-500/20" : "bg-slate-100 dark:bg-white/5 text-slate-400 border-slate-200/60 dark:border-white/10"
        )}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        <div className="min-w-0">
          <div className="text-xs font-semibold text-slate-900 dark:text-white group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors truncate">
            {label}
          </div>
          <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1 leading-none truncate">
            {hasPending && <span className="w-1 h-1 rounded-full bg-amber-500 animate-pulse"></span>}
            {description}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <span className={cn(
          "text-[9px] uppercase font-bold tracking-wider py-0.5 px-2 rounded-md border",
          hasPending 
            ? "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20" 
            : "bg-slate-100 dark:bg-white/5 text-slate-400 border-transparent"
        )}>
          {count}
        </span>
        <div className="w-6 h-6 rounded-full bg-slate-100/60 dark:bg-white/5 flex items-center justify-center text-slate-400 group-hover:bg-amber-500 group-hover:text-white transition-all duration-200 shadow-xs">
          <ChevronRight className="w-3 h-3" />
        </div>
      </div>
    </Link>
  );
}

// ── Department Widget Component ──
function DepartmentWidget({ title, subtitle, icon: Icon, theme, children, buttonText, buttonHref }: {
  title: string;
  subtitle: string;
  icon: React.ElementType;
  theme: { iconBg: string; iconText: string; gradient: string; badgeText: string; badgeBg: string };
  children: React.ReactNode;
  buttonText: string;
  buttonHref: string;
}) {
  return (
    <Card className="shadow-sm border-slate-200 dark:border-white/10 flex flex-col justify-between overflow-hidden bg-white/50 backdrop-blur-sm dark:bg-slate-900/50 transition-all hover:shadow-md h-full min-h-[350px]">
      <div>
        <CardHeader className={cn("pb-4 pt-5 px-5 border-b border-slate-100 dark:border-white/5 bg-gradient-to-r", theme.gradient)}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", theme.iconBg)}>
                <Icon className={cn("h-4 w-4", theme.iconText)} />
              </div>
              <div>
                <CardTitle className="text-base font-bold text-slate-900 dark:text-white tracking-tight">{title}</CardTitle>
                <CardDescription className="text-xs font-medium mt-0.5">{subtitle}</CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-4 space-y-2.5 bg-slate-50/30 dark:bg-slate-950/20">
          {children}
        </CardContent>
      </div>
      <div className="p-3 border-t border-slate-100 dark:border-white/5 bg-white/40 dark:bg-slate-900/40">
        <Link 
          href={buttonHref} 
          className="flex items-center justify-between w-full px-3.5 py-2 rounded-xl border border-slate-200/80 dark:border-white/10 bg-white dark:bg-white/[0.03] hover:bg-slate-50 dark:hover:bg-white/[0.08] text-xs font-semibold text-slate-700 dark:text-slate-300 transition-all duration-200 group"
        >
          <span>{buttonText}</span>
          <ArrowRight className="w-3.5 h-3.5 text-slate-400 group-hover:text-indigo-500 group-hover:translate-x-0.5 transition-all" />
        </Link>
      </div>
    </Card>
  );
}

// ── Metric Line Item ──
function StatRow({ label, value, isHighlighted = false }: { label: string; value: React.ReactNode; isHighlighted?: boolean }) {
  return (
    <div className="flex justify-between items-center py-1.5 px-3 rounded-lg bg-white/60 dark:bg-white/[0.02] border border-slate-200/40 dark:border-white/5 text-xs">
      <span className="text-slate-500 dark:text-slate-400 font-medium">{label}</span>
      <span className={cn("font-bold tracking-tight text-sm", isHighlighted ? "text-amber-600 dark:text-amber-400" : "text-slate-900 dark:text-white")}>
        {value}
      </span>
    </div>
  );
}

// ── Pipeline Progress Indicator ──
function PipelineStageItem({ label, count, total, colorClass, borderClass, bgClass, barBgClass }: {
  label: string;
  count: number;
  total: number;
  colorClass: string;
  borderClass: string;
  bgClass: string;
  barBgClass: string;
}) {
  const percentage = total > 0 ? Math.min(100, Math.round((count / total) * 100)) : 0;
  return (
    <div className="space-y-1.5 p-3 rounded-xl border border-slate-200/50 dark:border-white/5 bg-white/40 dark:bg-white/[0.01]">
      <div className="flex justify-between items-center text-xs">
        <span className="font-semibold text-slate-700 dark:text-slate-300">{label}</span>
        <span className={cn("font-extrabold px-2 py-0.5 rounded text-[10px] border", colorClass, borderClass, bgClass)}>
          {count} Projects
        </span>
      </div>
      <div className="w-full bg-slate-100 dark:bg-white/5 h-2 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all duration-500", barBgClass)} style={{ width: `${percentage}%` }}></div>
      </div>
    </div>
  );
}

const formatCurrency = (n: number) => {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
  if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
  return `₹${n.toLocaleString('en-IN')}`;
};

async function CommandCenterContent() {

  const [{ success, data }, { success: milestoneSuccess, data: milestoneData }] = await Promise.all([
    getAdminWorkspaceDataAction(),
    getMilestonePaymentStatusAggregateAction()
  ]);
  const workspaceData = success && data ? data : {};
  const milestoneAggregate = milestoneSuccess && milestoneData ? milestoneData : [];

  // Safely extract action responses to protect against `{ success: false, error }` results
  const activeProjects = workspaceData.activeProjects || 0;
  const statusCounts = workspaceData.statusCounts || {};
  const totalBankBalance = workspaceData.totalBankBalance || 0;
  const financial = workspaceData.financial || {};
  const payrollStatus = workspaceData.payrollStatus || 'Draft';
  const pendingLeaves = workspaceData.pendingLeaves || 0;
  const pendingInvoices = workspaceData.pendingInvoices || 0;
  const pendingMaterials = workspaceData.pendingMaterials || 0;
  const dispatchOverrides = workspaceData.dispatchOverridesRaw || [];
  const materialRequestsRaw = workspaceData.materialRequestsRaw || [];
  const attendanceToday = workspaceData.attendanceTodayRaw || {};
  const users = workspaceData.usersList || [];
  const ongoingProjectsCount = workspaceData.ongoingProjectsCount || 0;
  const allProjectStatuses = workspaceData.allProjectStatuses || [];
  const pendingExpensesCount = workspaceData.pendingExpensesCount || 0;
  const pendingMilestonesCount = workspaceData.pendingMilestonesCount || 0;
  const pendingFieldApprovalsCount = workspaceData.pendingFieldApprovalsCount || 0;
  const equipmentIssuesCount = workspaceData.equipmentIssuesCount || 0;
  const pendingEodsCount = workspaceData.pendingEodsCount || 0;
  const upcomingHoliday = workspaceData.upcomingHoliday || null;

  const projectStatuses = allProjectStatuses;
  const totalActivePipeline = projectStatuses.filter((p: any) => p.status !== 'completed' && p.status !== 'archived').length;

  const pipelineCounts = {
    intake: projectStatuses.filter((p: any) => ['project_created', 'data_collection'].includes(p.status)).length,
    lead: projectStatuses.filter((p: any) => ['lead', 'lead_created', 'requirement_gathering'].includes(p.status)).length,
    payment: projectStatuses.filter((p: any) => p.status === 'payment_pending').length,
    survey: projectStatuses.filter((p: any) => ['field_work', 'data_sync'].includes(p.status)).length,
    qc: projectStatuses.filter((p: any) => p.status === 'final_review' || p.status === 'review').length,
    dispatch: projectStatuses.filter((p: any) => p.status === 'ready_for_dispatch').length,
  };

  const outstandingReceivables = financial.accountsReceivable || 0;
  const payrollApprovalCount = (payrollStatus === 'Pending' || payrollStatus === 'Draft') ? 1 : 0;

  // ── HR Calculations (use summary action, not full attendance history) ──
  const presentCount = Number((attendanceToday as any)?.present || 0);
  const lateLogins = 0; // late status not in EOD summary; keep metric without full log scan
  
  const recentEods = (attendanceToday as any)?.recentEods || [];
  const submittedUserIds = new Set(recentEods.map((eod: any) => eod.user_id));
  const unsubmittedUsers = (users || [])
    .filter((u: any) => u.is_active && u.role?.toLowerCase() !== 'admin')
    .filter((u: any) => !submittedUserIds.has(u.id));
  
  const missingEod = unsubmittedUsers.length;
  const expectedStaff = (users || []).filter((u: any) => u.is_active && u.role?.toLowerCase() !== 'admin').length;
  const absentCount = Math.max(0, expectedStaff - presentCount);

  // ── Month Calculations ──
  const currentMonthName = new Date().toLocaleDateString('en-US', { month: 'short' });
  const currentMonthData = (financial.monthlyCashFlow || []).find((m: any) => m.month === currentMonthName) || { income: 0, expense: 0 };
  const currentMonthIncome = currentMonthData.income || 0;
  const currentMonthExpense = currentMonthData.expense || 0;

  // ── Metrics ──
  const pendingExpenses = workspaceData.pendingExpensesCount || 0;
  const delayedProjects = (statusCounts as any)?.delayed || 0;
  const pendingProjectApprovals = (activeProjects || 0) > 0 ? delayedProjects : 0;
  const pendingMilestones = workspaceData.pendingMilestonesCount || 0;
  const qaPendingReview = (statusCounts as any)?.onTrack || 0;
  const pendingFieldApprovals = workspaceData.pendingFieldApprovalsCount || 0;
  const equipmentIssues = workspaceData.equipmentIssuesCount || 0;

  return (
    <div className="space-y-6">
      {/* ── Signature Terminal Header using PageHeader ── */}
      <PageHeader
        title="Admin Dashboard"
        subtitle="Company overview and administrative control."
        actions={
          <div className="flex items-center gap-1.5 p-1.5 bg-gradient-to-r from-slate-50/90 to-slate-100/90 dark:from-slate-900/90 dark:to-slate-950/90 border border-slate-200/85 dark:border-white/10 rounded-2xl shadow-sm backdrop-blur-md flex-shrink-0 flex-wrap">
            <QuickAction label="Add Employee" href="/admin/users" icon={Users} variant="indigo" />
            <QuickAction label="Create Project" href="/projects" icon={FolderKanban} variant="amber" />
            <QuickAction label="Open Banking" href="/accounts/banks" icon={Landmark} variant="emerald" />
            <QuickAction label="Announcements" href="/announcements" icon={Megaphone} variant="purple" />
          </div>
        }
        className="pb-4 border-b border-slate-200/60 dark:border-white/5"
      />

      {/* ── KPI Grid ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Ongoing Projects */}
        <Card className="p-4 bg-gradient-to-br from-indigo-500/[0.05] to-transparent border-slate-200/80 dark:border-white/5 shadow-xs flex justify-between items-start">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Ongoing Projects</p>
            <h3 className="text-2xl font-bold mt-1 text-slate-900 dark:text-white">{workspaceData.ongoingProjectsCount || 0}</h3>
          </div>
          <div className="w-8 h-8 rounded-lg bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
            <FolderKanban className="w-4 h-4" />
          </div>
        </Card>

        {/* Total Funds */}
        <Card className="p-4 bg-gradient-to-br from-emerald-500/[0.05] to-transparent border-slate-200/80 dark:border-white/5 shadow-xs flex justify-between items-start">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Total Funds</p>
            <h3 className="text-2xl font-bold mt-1 text-slate-900 dark:text-white">{formatCurrency(totalBankBalance)}</h3>
          </div>
          <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
            <Coins className="w-4 h-4" />
          </div>
        </Card>

        {/* Outstanding Funds */}
        <Card className="p-4 bg-gradient-to-br from-amber-500/[0.05] to-transparent border-slate-200/80 dark:border-white/5 shadow-xs flex justify-between items-start">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Outstanding Funds</p>
            <h3 className="text-2xl font-bold mt-1 text-slate-900 dark:text-white">{formatCurrency(outstandingReceivables)}</h3>
          </div>
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
            <Landmark className="w-4 h-4" />
          </div>
        </Card>

        {/* Absent Today */}
        <Card className="p-4 bg-gradient-to-br from-rose-500/[0.05] to-transparent border-slate-200/80 dark:border-white/5 shadow-xs flex justify-between items-start">
          <div>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Absent Today</p>
            <h3 className="text-2xl font-bold mt-1 text-slate-900 dark:text-white">{absentCount}</h3>
          </div>
          <div className="w-8 h-8 rounded-lg bg-rose-500/10 text-rose-500 flex items-center justify-center">
            <Users className="w-4 h-4" />
          </div>
        </Card>
      </div>

      {/* ── Top Layout section: Project Pipeline & Critical Actions ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Side: Project Pipeline Widget (spans 2 columns, fixed height) */}
        <Card className="lg:col-span-2 h-[420px] shadow-sm border-slate-200 dark:border-white/10 overflow-hidden bg-white/50 backdrop-blur-sm dark:bg-slate-900/50 flex flex-col justify-between">
          <div>
            <CardHeader className="pb-3 pt-4 px-5 border-b border-slate-100 dark:border-white/5 bg-gradient-to-r from-indigo-50/50 to-transparent dark:from-indigo-950/20 dark:to-transparent">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-indigo-500/10 flex items-center justify-center shrink-0">
                  <Layers className="h-4 w-4 text-indigo-500" />
                </div>
                <div>
                  <CardTitle className="text-base font-bold text-slate-900 dark:text-white tracking-tight">Project Pipeline</CardTitle>
                  <CardDescription className="text-xs font-medium mt-0.5">Distribution across key active stages</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3.5 bg-slate-50/30 dark:bg-slate-950/20 overflow-y-auto max-h-[330px] thin-scrollbar">
              <PipelineStageItem label="Project Created" count={totalActivePipeline} total={totalActivePipeline} colorClass="text-slate-600 dark:text-slate-400" borderClass="border-slate-500/20" bgClass="bg-slate-500/5" barBgClass="bg-slate-500 dark:bg-slate-400" />
              <PipelineStageItem label="Lead & Commercial Phase" count={pipelineCounts.lead} total={totalActivePipeline} colorClass="text-purple-600 dark:text-purple-400" borderClass="border-purple-500/20" bgClass="bg-purple-500/5" barBgClass="bg-purple-500 dark:bg-purple-400" />
              <PipelineStageItem label="Advance Payment Pending" count={pipelineCounts.payment} total={totalActivePipeline} colorClass="text-emerald-600 dark:text-emerald-400" borderClass="border-emerald-500/20" bgClass="bg-emerald-500/5" barBgClass="bg-emerald-500 dark:bg-emerald-400" />
              <PipelineStageItem label="Data Collection (Engineer)" count={pipelineCounts.intake} total={totalActivePipeline} colorClass="text-indigo-600 dark:text-indigo-400" borderClass="border-indigo-500/20" bgClass="bg-indigo-500/5" barBgClass="bg-indigo-500 dark:bg-indigo-400" />
              <PipelineStageItem label="Field Surveying" count={pipelineCounts.survey} total={totalActivePipeline} colorClass="text-sky-600 dark:text-sky-400" borderClass="border-sky-500/20" bgClass="bg-sky-500/5" barBgClass="bg-sky-500 dark:bg-sky-400" />
              <PipelineStageItem label="Lead Engineer Review (QC)" count={pipelineCounts.qc} total={totalActivePipeline} colorClass="text-rose-600 dark:text-rose-400" borderClass="border-rose-500/20" bgClass="bg-rose-500/5" barBgClass="bg-rose-500 dark:bg-rose-400" />
              <PipelineStageItem label="Ready for Delivery" count={pipelineCounts.dispatch} total={totalActivePipeline} colorClass="text-teal-600 dark:text-teal-400" borderClass="border-teal-500/20" bgClass="bg-teal-500/5" barBgClass="bg-teal-500 dark:bg-teal-400" />
            </CardContent>
          </div>
        </Card>

        {/* Right Side: Critical Action Center Widget (spans 1 column, same fixed height) */}
        <Card className="lg:col-span-1 h-[420px] shadow-sm border-slate-200 dark:border-white/10 overflow-hidden bg-white/50 backdrop-blur-sm dark:bg-slate-900/50 flex flex-col justify-between">
          <div>
            <CardHeader className="pb-3 pt-4 px-5 border-b border-slate-100 dark:border-white/5 bg-gradient-to-r from-amber-50/50 to-transparent dark:from-amber-950/20 dark:to-transparent">
              <div className="flex items-center gap-3">
                <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                  <ShieldAlert className="h-4 w-4 text-amber-500" />
                </div>
                <div>
                  <CardTitle className="text-base font-bold text-slate-900 dark:text-white tracking-tight">Critical Action Center</CardTitle>
                  <CardDescription className="text-xs font-medium mt-0.5">Urgent approvals & operational queues</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-4 space-y-3 bg-slate-50/30 dark:bg-slate-950/20 overflow-y-auto max-h-[330px] thin-scrollbar">
              <ActionCardItem label="Dispatch Override" description="Review system override requests" count={dispatchOverrides.filter((r: any) => !r.is_read).length} href="#overrides-widget" icon={ShieldAlert} />
              <ActionCardItem label="Leave Request" description="Apply for personal leaves" count={pendingLeaves} href="/leaves" icon={Users} />
              <ActionCardItem label="HR's Leave Approval" description="Review pending team leaves" count={pendingLeaves} href="/hr" icon={Users} />
              <ActionCardItem label="EOD Approval" description="Review submitted work logs" count={pendingEodsCount} href="/hr" icon={Clock} />
            </CardContent>
          </div>
        </Card>
      </div>

      {/* ── Mid Layout section: Analytics & Trends ── */}
      <div className="grid grid-cols-1 gap-6">
        <AdminMilestonePieChart data={milestoneAggregate} />
        <AdminProjectTrendChart />
        <AdminIncomeExpenseChart />
      </div>

      {/* ── Bottom Section: Department widgets & alert center ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* HR Department */}
        <div className="col-span-1">
          <DepartmentWidget 
            title="HR Portal" 
            subtitle="Team pulse & attendance"
            icon={Users} 
            theme={{
              iconBg: "bg-indigo-500/10",
              iconText: "text-indigo-500",
              gradient: "from-indigo-50/50 to-transparent dark:from-indigo-950/20",
              badgeText: "text-indigo-600",
              badgeBg: "bg-indigo-50"
            }}
            buttonText="View HR Portal" 
            buttonHref="/hr"
          >
            <StatRow label="Total Employees" value={expectedStaff} />
            <StatRow label="Present Today" value={`${presentCount} / ${expectedStaff}`} />
            <StatRow label="Missing EOD Submissions" value={missingEod} isHighlighted={missingEod > 0} />
            <StatRow label="Upcoming Holiday" value={upcomingHoliday ? new Date((upcomingHoliday as any).date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : 'None'} />
            <StatRow label="Payroll Status" value={
              <span className={cn(
                "px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider border shrink-0",
                payrollStatus?.toLowerCase() === 'draft' && "bg-slate-100 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-white/10",
                (payrollStatus?.toLowerCase() === 'pending' || payrollStatus?.toLowerCase() === 'submitted') && "bg-amber-500/10 text-amber-600 dark:text-amber-450 border-amber-500/25",
                payrollStatus?.toLowerCase() !== 'draft' && payrollStatus?.toLowerCase() !== 'pending' && payrollStatus?.toLowerCase() !== 'submitted' && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25"
              )}>
                {payrollStatus || 'Draft'}
              </span>
            } />
          </DepartmentWidget>
        </div>

        {/* Finance Department */}
        <div className="col-span-1">
          <DepartmentWidget 
            title="Finance & Banking" 
            subtitle="Cash flow & accounts"
            icon={Coins} 
            theme={{
              iconBg: "bg-emerald-500/10",
              iconText: "text-emerald-500",
              gradient: "from-emerald-50/50 to-transparent dark:from-emerald-950/20",
              badgeText: "text-emerald-600",
              badgeBg: "bg-emerald-50"
            }}
            buttonText="Go to Accounts" 
            buttonHref="/accounts"
          >
            <StatRow label="Total Bank Balance" value={formatCurrency(totalBankBalance)} />
            <StatRow label="Outstanding Receivables" value={formatCurrency(outstandingReceivables)} />
            <StatRow label="Monthly Income" value={formatCurrency(currentMonthIncome)} />
            <StatRow label="Monthly Expenses" value={formatCurrency(currentMonthExpense)} />
          </DepartmentWidget>
        </div>

        {/* Alert Center (Personnel Notifications) - spans 2 rows, increased height */}
        <div className="col-span-1 md:row-span-2">
          <DashboardNotificationCenter className="h-full md:min-h-[724px] md:max-h-[724px]" />
        </div>

        {/* Dispatch Overrides Widget - spans 2 columns next to the Alert Center */}
        <div id="overrides-widget" className="md:col-span-2">
          <DispatchOverrideRequestsWidget requests={dispatchOverrides} className="h-full min-h-[350px] max-h-[350px]" />
        </div>

      </div>
    </div>
  );
}

export default async function AdminDashboardPage() {
  await requireRole('admin');

  return (
    <div className="space-y-6 animate-in fade-in duration-500 p-2 md:p-4">
      <Suspense fallback={
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-28 rounded-2xl bg-white/5 animate-pulse border border-white/5" />
            ))}
          </div>
        </div>
      }>
        <CommandCenterContent />
      </Suspense>
    </div>
  );
}
