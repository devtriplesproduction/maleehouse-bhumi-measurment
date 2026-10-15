import React from "react";
import { getUserProfileAction } from "@/actions/auth.actions";
import { getEngineerWorkspaceDataAction } from "@/actions/workspace.actions";
import {
  Shield, FileText,
  CheckCircle2, Clock, ClipboardCheck, MapPin,
  Inbox, AlertCircle, FolderKanban, Activity
} from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDistanceToNow } from "date-fns";
import { ActivityFeedTab } from "@/components/modules/ActivityFeedTab";
import { PaginatedProjectList } from "@/components/modules/PaginatedProjectList";
import { EmptyState } from "@/components/ui/empty-state";
import { MaterialApprovalWidget } from "@/components/modules/MaterialApprovalWidget";
import { filterActivityLogsByRole } from "@/lib/utils";
import { PageHeader } from "@/components/modules/PageHeader";
import DashboardNotificationCenter from "@/components/modules/DashboardNotificationCenter";

export default async function EngineerDashboardPage() {
  const profile = await getUserProfileAction();
  const firstName = profile?.first_name || "Engineer";

  const { success, data } = await getEngineerWorkspaceDataAction();
  const workspaceData = success && data ? data : {};

  const rawActivityLogs: any[] = workspaceData.activityLogs || [];
  const activityLogs = filterActivityLogsByRole(rawActivityLogs, profile?.role || 'user');
  const comments: any[] = workspaceData.comments || [];
  const files: any[] = workspaceData.files || [];
  const allUsers: any[] = workspaceData.allUsers || [];

  const projects = workspaceData.assignedProjects || [];
  const eodReports = workspaceData.eodReports || [];

  const allMaterialRequests: any[] = workspaceData.materialRequests || [];

  // Filter project IDs that have had a QC rejection event
  const qcRejectedProjectIds = new Set(
    activityLogs
      .filter((l: any) => l.action === "QC_REJECTED")
      .map((l: any) => l.project_id)
  );

  const newlyAssigned = projects.filter(
    (p: any) => p.status === "project_created"
  );

  const pendingAcceptance = [...newlyAssigned];
  const deliverableReview = projects.filter((p: any) => {
    if (p.status === "review") return true;
    if (p.status === "data_sync") {
      const projectLogs = activityLogs.filter((l: any) => l.project_id === p.id);
      return projectLogs.some((l: any) => l.action === "FILE_UPLOADED" && l.details?.category === "final_file");
    }
    return false;
  });

  const fieldReviews = projects.filter((p: any) => {
    if (p.status === "data_sync") {
      const projectLogs = activityLogs.filter((l: any) => l.project_id === p.id);
      return !projectLogs.some((l: any) => l.action === "FILE_UPLOADED" && l.details?.category === "final_file");
    }
    return false;
  });
  const qcReturns = projects.filter(
    (p: any) => qcRejectedProjectIds.has(p.id) && p.status !== "completed" && p.status !== "archived"
  );
  const activeProjects = projects.filter(
    (p: any) => p.status !== "completed" && p.status !== "archived" && p.status !== "project_created"
  );

  // Construct recent activities timeline
  const myProjectIds = new Set([
    ...projects.map((p: any) => p.id)
  ]);

  const allProjects = [...projects];
  const assignedAtMap = new Map(
    allProjects.map((p: any) => [p.id, p.assigned_at])
  );

  const getProjectName = (projId: string) => {
    return allProjects.find((p: any) => p.id === projId)?.name || projId;
  };

  const parsedLogs = activityLogs
    .filter((log: any) => {
      if (!myProjectIds.has(log.project_id)) return false;
      const assignedAt = assignedAtMap.get(log.project_id);
      if (!assignedAt) return true;
      // Subtract 5 seconds to ensure the TEAM_ASSIGNED log itself is included
      return new Date(log.created_at).getTime() >= new Date(assignedAt).getTime() - 5000;
    })
    .map((log: any) => {
      const user = allUsers.find((u: any) => u.id === log.user_id);
      const userName = user ? `${user.first_name} ${user.last_name}` : "Team Member";

      let summary = "";
      switch (log.action) {
        case "STAGE_UPDATE":
          summary = `Project stage updated to "${log.details?.new_status?.replace(/_/g, ' ')}"`;
          break;
        case "TEAM_ASSIGNED":
          summary = `Assigned ${log.details?.assigned_role || 'member'} ${log.details?.assigned_user_name || ''}`;
          break;
        case "FIELD_VISIT_COMPLETED":
          summary = "Field Survey Completed";
          break;
        case "QC_REJECTED":
          summary = "QC Returned Project";
          break;
        case "QC_APPROVED":
          summary = "QC Approved / Deliverable Approved";
          break;
        default:
          summary = log.action.replace(/_/g, " ");
      }

      return {
        id: log.id,
        projectId: log.project_id,
        projectName: getProjectName(log.project_id),
        summary,
        user: userName,
        timestamp: log.created_at,
      };
    });

  const parsedFiles = files
    .filter((f: any) => {
      if (!myProjectIds.has(f.project_id)) return false;
      const assignedAt = assignedAtMap.get(f.project_id);
      if (!assignedAt) return true;
      return new Date(f.uploaded_at).getTime() >= new Date(assignedAt).getTime() - 5000;
    })
    .map((f: any) => {
      const user = allUsers.find((u: any) => u.id === f.uploaded_by);
      const userName = user ? `${user.first_name} ${user.last_name}` : "Team Member";

      let summary = "";
      if (['requirements', 'intake_document'].includes(f.category)) {
        summary = `Client Documents Added: "${f.file_name}"`;
      } else if (f.category === 'final_file') {
        summary = `Deliverable Submitted: "${f.file_name}"`;
      } else {
        summary = `Document Uploaded: "${f.file_name}"`;
      }

      return {
        id: f.id,
        projectId: f.project_id,
        projectName: getProjectName(f.project_id),
        summary,
        user: userName,
        timestamp: f.uploaded_at,
      };
    });

  const allTimeline = [...parsedLogs, ...parsedFiles]
    .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  const recentActivities = allTimeline.slice(0, 10);

  // KPIs Row
  const kpis = [
    { label: "New Assignments", value: pendingAcceptance.length, color: "text-indigo-500", bg: "bg-indigo-500/10", icon: Inbox },
    { label: "Deliverable Reviews", value: deliverableReview.length, color: "text-blue-500", bg: "bg-blue-500/10", icon: ClipboardCheck },
    { label: "Activity Feed", value: allTimeline.length, color: "text-amber-500", bg: "bg-amber-500/10", icon: Activity },
    { label: "Active Projects", value: activeProjects.length, color: "text-emerald-500", bg: "bg-emerald-500/10", icon: FolderKanban },
  ];

  // Helper: Get project operational status badge
  const getOperationalBadge = (p: any) => {
    const projectLogs = activityLogs.filter((l: any) => l.project_id === p.id);
    const isQcRejected = projectLogs.some((l: any) => l.action === "QC_REJECTED" || l.action === "ENGINEER_FINAL_DELIVERABLE_REJECTED") &&
      !projectLogs.some((l: any) => l.action === "QC_APPROVED" || l.action === "ENGINEER_FINAL_DELIVERABLE_APPROVED") &&
      (p.status === "data_sync" || p.status === "final_review");

    if (p.is_frozen || isQcRejected) {
      return { text: "Blocked", color: "text-rose-600 bg-rose-500/10 border-rose-500/20" };
    }
    if (p.status === "qc_approved") {
      return { text: "Ready For Delivery", color: "text-emerald-600 bg-emerald-500/10 border-emerald-500/20" };
    }
    const hasFinalDeliverable = projectLogs.some((l: any) => l.action === "FILE_UPLOADED" && l.details?.category === "final_file");
    if (p.status === "data_sync" && hasFinalDeliverable) {
      return { text: "Under Review", color: "text-purple-600 bg-purple-500/10 border-purple-500/20" };
    }
    if (p.status === "qc_review") {
      return { text: "Under Review", color: "text-purple-600 bg-purple-500/10 border-purple-500/20" };
    }
    if (p.status === "project_created" || p.status === "review") {
      return { text: "Requires Action", color: "text-indigo-600 bg-indigo-500/10 border-indigo-500/20" };
    }
    return { text: "In Progress", color: "text-blue-600 bg-blue-500/10 border-blue-500/20" };
  };

  // Helper: Get project workflow-driven action labels
  const getProjectNextActionLabel = (p: any) => {
    const projectLogs = activityLogs.filter((l: any) => l.project_id === p.id);
    const isQcRejected = projectLogs.some((l: any) => l.action === "QC_REJECTED") &&
      !projectLogs.some((l: any) => l.action === "QC_APPROVED") &&
      (p.status === "data_sync" || p.status === "review");

    if (isQcRejected) {
      return "Returned for Revision";
    }

    switch (p.status) {
      case 'project_created':
        return "Requires Client Contact";
      case 'data_collection':
        return "Document Collection";
      case 'review':
        return "Deliverable Review Required";
      case 'field_assigned':
      case 'field_work':
        return "Survey In Progress";
      case 'data_sync':
        const hasFinalFile = projectLogs.some((l: any) => l.action === "FILE_UPLOADED" && l.details?.category === "final_file");
        if (hasFinalFile) {
          return "Engineer Review Required";
        }
        return "Survey Raw Data Sync";
      case 'qc_review':
        return "QC Audit In Progress";
      case 'qc_approved':
        return "Ready For Delivery";
      default:
        return "Review Details";
    }
  };

  // Server-side project enrichment
  const enrichProject = (p: any) => {
    return {
      ...p,
      operationalBadge: getOperationalBadge(p),
      nextActionLabel: getProjectNextActionLabel(p)
    };
  };

  const enrichedPending = pendingAcceptance.map(enrichProject);
  const enrichedDeliverableReview = deliverableReview.map(enrichProject);
  const enrichedFieldReviews = fieldReviews.map(enrichProject);
  const enrichedActive = activeProjects.map(enrichProject);



  return (
    <div className="space-y-8 animate-in fade-in duration-700 pb-20">

      {/* Header */}
      <PageHeader
        className="border-b border-slate-200/60 dark:border-white/5 pb-6 mb-8"
        title={
          <>
            <span className="block text-[10px] font-semibold uppercase tracking-[0.2em] text-indigo-600 dark:text-indigo-400 mb-1.5">

            </span>
            <span className="text-3xl">Project Operations <span className="text-indigo-600 dark:text-indigo-400">Hub</span></span>
          </>
        }
        subtitle={`Project Lead Operations Hub for ${firstName}. Action-driven workflow metrics.`}
      />

      {/* KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div
              key={kpi.label}
              className="glass-card p-4 border-slate-200/60 dark:border-white/10 dark:bg-white/[0.03] group hover:bg-white/[0.08] transition-all duration-500 relative overflow-hidden shadow-sm rounded-xl flex items-center justify-between"
            >
              <div className="space-y-0.5 relative z-10">
                <p className="text-[11px] font-extrabold tracking-wider uppercase text-slate-400">{kpi.label}</p>
                <h3 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white leading-none font-sans">
                  {kpi.value}
                </h3>
              </div>
              <div className={cn("p-2 rounded-lg transition-transform duration-500", kpi.bg)}>
                <Icon className={cn("w-4.5 h-4.5", kpi.color)} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Grid 10-Column Split (70/30) */}
      <div className="grid grid-cols-1 lg:grid-cols-10 gap-8">

        {/* Left Column (70%) - Queue Tabs & Lists */}
        <div className="lg:col-span-7 space-y-6">
          <Tabs defaultValue="pending" className="space-y-6">
            <div className="border-b border-slate-200 dark:border-white/10 w-full overflow-x-auto custom-scrollbar pb-3">
              <TabsList className="bg-transparent border-none p-0 flex h-auto gap-8 w-full justify-start">

                <TabsTrigger
                  value="pending"
                  className="px-1 py-2.5 rounded-none border-b-[3px] border-transparent text-sm font-semibold transition-all text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 data-[state=active]:border-indigo-600 data-[state=active]:!text-indigo-600 dark:data-[state=active]:!text-indigo-400 flex items-center gap-2 data-[state=active]:shadow-none bg-transparent hover:bg-transparent data-[state=active]:bg-transparent"
                >
                  New Assignments
                  {pendingAcceptance.length > 0 && (
                    <span className="px-1.5 py-0.2 text-[10px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded">
                      {pendingAcceptance.length}
                    </span>
                  )}
                </TabsTrigger>

                <TabsTrigger
                  value="active"
                  className="px-1 py-2.5 rounded-none border-b-[3px] border-transparent text-sm font-semibold transition-all text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 data-[state=active]:border-indigo-600 data-[state=active]:!text-indigo-600 dark:data-[state=active]:!text-indigo-400 flex items-center gap-2 data-[state=active]:shadow-none bg-transparent hover:bg-transparent data-[state=active]:bg-transparent"
                >
                  Active Projects
                  {activeProjects.length > 0 && (
                    <span className="px-1.5 py-0.2 text-[10px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded">
                      {activeProjects.length}
                    </span>
                  )}
                </TabsTrigger>

                <TabsTrigger
                  value="reviews"
                  className="px-1 py-2.5 rounded-none border-b-[3px] border-transparent text-sm font-semibold transition-all text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 data-[state=active]:border-indigo-600 data-[state=active]:!text-indigo-600 dark:data-[state=active]:!text-indigo-400 flex items-center gap-2 data-[state=active]:shadow-none bg-transparent hover:bg-transparent data-[state=active]:bg-transparent"
                >
                  Deliverable Reviews
                  {deliverableReview.length > 0 && (
                    <span className="px-1.5 py-0.2 text-[10px] font-bold bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded">
                      {deliverableReview.length}
                    </span>
                  )}
                </TabsTrigger>

                <TabsTrigger
                  value="field_reviews"
                  className="px-1 py-2.5 rounded-none border-b-[3px] border-transparent text-sm font-semibold transition-all text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 data-[state=active]:border-cyan-500 data-[state=active]:!text-cyan-600 dark:data-[state=active]:!text-cyan-400 flex items-center gap-2 data-[state=active]:shadow-none bg-transparent hover:bg-transparent data-[state=active]:bg-transparent"
                >
                  Field Reviews
                  {fieldReviews.length > 0 && (
                    <span className="px-1.5 py-0.2 text-[10px] font-bold bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 rounded">
                      {fieldReviews.length}
                    </span>
                  )}
                </TabsTrigger>

                <TabsTrigger
                  value="activity"
                  className="px-1 py-2.5 rounded-none border-b-[3px] border-transparent text-sm font-semibold transition-all text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 data-[state=active]:border-amber-500 data-[state=active]:!text-amber-600 dark:data-[state=active]:!text-amber-400 flex items-center gap-2 data-[state=active]:shadow-none bg-transparent hover:bg-transparent data-[state=active]:bg-transparent"
                >
                  Activity Feed
                  {allTimeline.length > 0 && (
                    <span className="px-1.5 py-0.2 text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded">
                      {allTimeline.length}
                    </span>
                  )}
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Tab Panel Queue Lists */}
            <div className="pt-1">
              <TabsContent value="pending" className="mt-0 focus-visible:outline-none">
                {enrichedPending.length === 0 ? (
                  <EmptyState message="No new assignments awaiting acceptance." icon={Inbox} />
                ) : (
                  <PaginatedProjectList projects={enrichedPending} showAccept={true} />
                )}
              </TabsContent>

              <TabsContent value="active" className="mt-0 focus-visible:outline-none">
                {enrichedActive.length === 0 ? (
                  <EmptyState message="No active projects assigned to you." icon={Shield} />
                ) : (
                  <PaginatedProjectList projects={enrichedActive} />
                )}
              </TabsContent>

              <TabsContent value="reviews" className="mt-0 focus-visible:outline-none">
                {enrichedDeliverableReview.length === 0 ? (
                  <EmptyState message="No deliverable reviews pending." icon={ClipboardCheck} />
                ) : (
                  <PaginatedProjectList projects={enrichedDeliverableReview} />
                )}
              </TabsContent>

              <TabsContent value="field_reviews" className="mt-0 focus-visible:outline-none">
                {enrichedFieldReviews.length === 0 ? (
                  <EmptyState message="No field reviews pending." icon={FileText} />
                ) : (
                  <PaginatedProjectList projects={enrichedFieldReviews} />
                )}
              </TabsContent>

              <TabsContent value="activity" className="mt-0 focus-visible:outline-none">
                <div className="glass-card p-5 border-slate-200/60 dark:border-white/10 dark:bg-white/[0.03] rounded-2xl">
                  <ActivityFeedTab activities={allTimeline} />
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>

        {/* Right Column (30%) - Action widgets and Recent Activity */}
        <div className="lg:col-span-3 space-y-6 animate-in fade-in duration-300">
          <DashboardNotificationCenter />

          <MaterialApprovalWidget requests={allMaterialRequests} />

          <div className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <Activity className="w-4 h-4 text-indigo-500" />
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white tracking-tight">recent activity</h2>
            </div>

            <div className="glass-card p-5 rounded-[1.5rem] bg-white/40 dark:bg-slate-900/40 border-slate-200/50 dark:border-white/5 overflow-y-auto h-[500px] shadow-sm custom-scrollbar">
              {recentActivities.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400 italic">
                  no recent activity logs recorded.
                </div>
              ) : (
                <div className="space-y-2">
                  {recentActivities.map((item) => {
                    const s = item.summary.toLowerCase();

                    // ── classify ──────────────────────────────────────────
                    let iconBg = 'bg-slate-100 dark:bg-white/5';
                    let iconText = 'text-slate-400';
                    let rowBg = 'bg-slate-50/60 dark:bg-white/[0.01] hover:bg-slate-100/60 dark:hover:bg-white/[0.03] border-slate-200 dark:border-white/5';
                    let nameColor = 'text-slate-600 dark:text-slate-400';
                    let Icon: React.ComponentType<{ className?: string }> = Clock;
                    let isImportant = false;

                    if (s.includes('qc returned') || s.includes('rejected') || s.includes('failed')) {
                      iconBg = 'bg-rose-500/10'; iconText = 'text-rose-500';
                      rowBg = 'bg-rose-500/[0.03] dark:bg-rose-500/[0.02] hover:bg-rose-500/[0.06] dark:hover:bg-rose-500/[0.04] border-rose-400/40';
                      nameColor = 'text-rose-600 dark:text-rose-400';
                      Icon = AlertCircle; isImportant = true;

                    } else if (s.includes('invoice') || s.includes('payment')) {
                      iconBg = 'bg-amber-500/10'; iconText = 'text-amber-500';
                      rowBg = 'bg-amber-500/[0.03] dark:bg-amber-500/[0.02] hover:bg-amber-500/[0.06] dark:hover:bg-amber-500/[0.04] border-amber-400/40';
                      nameColor = 'text-amber-600 dark:text-amber-400';
                      Icon = FileText;
                    } else if (s.includes('approved') || s.includes('deliverable') || s.includes('signed off')) {
                      iconBg = 'bg-emerald-500/10'; iconText = 'text-emerald-500';
                      rowBg = 'bg-emerald-500/[0.02] dark:bg-emerald-500/[0.01] hover:bg-emerald-500/[0.04] dark:hover:bg-emerald-500/[0.03] border-emerald-400/30';
                      nameColor = 'text-emerald-600 dark:text-emerald-400';
                      Icon = CheckCircle2;
                    } else if (s.includes('survey') || s.includes('field visit') || s.includes('field_visit')) {
                      iconBg = 'bg-sky-500/10'; iconText = 'text-sky-500';
                      rowBg = 'bg-sky-500/[0.02] dark:bg-sky-500/[0.01] hover:bg-sky-500/[0.04] dark:hover:bg-sky-500/[0.03] border-sky-400/30';
                      nameColor = 'text-sky-600 dark:text-sky-400';
                      Icon = MapPin;
                    } else if (s.includes('document') || s.includes('requirement') || s.includes('uploaded')) {
                      iconBg = 'bg-violet-500/10'; iconText = 'text-violet-500';
                      rowBg = 'bg-violet-500/[0.02] dark:bg-violet-500/[0.01] hover:bg-violet-500/[0.04] dark:hover:bg-violet-500/[0.03] border-violet-400/30';
                      nameColor = 'text-violet-600 dark:text-violet-400';
                      Icon = FileText;
                    } else if (s.includes('assigned') || s.includes('engineer') || s.includes('team')) {
                      iconBg = 'bg-indigo-500/10'; iconText = 'text-indigo-500';
                      rowBg = 'bg-indigo-500/[0.02] dark:bg-indigo-500/[0.01] hover:bg-indigo-500/[0.04] dark:hover:bg-indigo-500/[0.03] border-indigo-400/30';
                      nameColor = 'text-indigo-600 dark:text-indigo-400';
                      Icon = Clock;
                    }

                    return (
                      <div
                        key={item.id}
                        className={cn(
                          'p-3 rounded-xl border transition-all duration-200 flex items-start gap-3',
                          rowBg,
                          isImportant && 'shadow-sm'
                        )}
                      >
                        <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0', iconBg)}>
                          <Icon className={cn('w-3.5 h-3.5', iconText)} />
                        </div>

                        <div className="flex-1 min-w-0 space-y-0.5">
                          <div className="flex items-start justify-between gap-1">
                            <Link
                              href={`/projects/${item.projectId}`}
                              className={cn('text-[10px] font-bold uppercase tracking-widest hover:underline leading-none truncate', nameColor)}
                            >
                              {item.projectName}
                            </Link>
                            <span className="text-[9px] font-medium text-slate-400 dark:text-slate-500 whitespace-nowrap shrink-0">
                              {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
                            </span>
                          </div>

                          <p className={cn(
                            'text-xs leading-snug',
                            isImportant ? 'font-semibold text-slate-800 dark:text-slate-200' : 'font-medium text-slate-700 dark:text-slate-300'
                          )}>
                            {item.summary}
                          </p>

                          <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500">
                            by {item.user}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
