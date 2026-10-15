"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAuthContext } from "@/lib/permissions/access-control";
import { normalizeData } from "@/lib/normalize";
import { OPS_ACTIVE_STATUSES } from "@/lib/project-commercial";
import { PERMISSIONS } from "@/lib/permissions/constants";
import { getMyEODReportsAction } from "./eod.actions";
import { getEngineerTasksAction } from "./task.actions";
import { getNotificationsAction } from "./notification.actions";
import { getAllMaterialRequestsAction, getMyMaterialRequestsAction, getMyVisitsAction, getMyPendingFieldReportsAction, getFieldMetricsAction } from "./field.actions";
import { getSOPsAction } from "./sop.actions";

export type WorkspaceResponse<T = null> = {
  success: boolean;
  error: string | null;
  data?: T;
};

/** Ops dashboards: engineers see the full ops queue; others only their assignments. */
function buildOpsProjectsQuery(supabase: any, userId: string, role: string) {
  const seesAllOps =
    role === "admin" || (PERMISSIONS.VIEW_ALL_PROJECTS as string[]).includes(role);

  if (seesAllOps) {
    // Left-join assignments so unassigned dispatches (project_created) still appear
    return supabase
      .from("projects")
      .select("*, project_assignments(*)")
      .in("status", [...OPS_ACTIVE_STATUSES])
      .is("deleted_at", null)
      .order("updated_at", { ascending: false });
  }

  return supabase
    .from("projects")
    .select("*, project_assignments!inner(*)")
    .in("status", [...OPS_ACTIVE_STATUSES])
    .is("deleted_at", null)
    .eq("project_assignments.user_id", userId)
    .order("updated_at", { ascending: false });
}

function enrichOpsProjects(projects: any[], userId: string) {
  return (projects || []).map((p: any) => {
    const mine = (p.project_assignments || []).find((a: any) => a.user_id === userId);
    return {
      ...p,
      assigned_at: mine?.assigned_at || p.updated_at || p.created_at,
      is_claimed_by_me: Boolean(mine),
    };
  });
}

// ─── ENGINEER WORKSPACE ────────────────────────────────────────────────────────

export async function getEngineerWorkspaceDataAction(): Promise<WorkspaceResponse<any>> {
  try {
    const { unstable_noStore: noStore } = await import('next/cache');
    noStore();
    const auth = await requireAuthContext();
    if (auth.error) return { success: false, error: auth.error };

    const supabase: any = await createClient();

    // Engineers: full ops queue (dispatched + in progress), not only personal assignments.
    // Dispatch to Engineering sets status project_created with no assignment yet.
    const projectsQuery = buildOpsProjectsQuery(supabase, auth.userId!, auth.role!);
    const { data: projectsData, error: projError } = await projectsQuery;
    if (projError) throw projError;
    const assignedProjects = enrichOpsProjects(projectsData || [], auth.userId!);
    const projectIds = assignedProjects.map((p: any) => p.id);

    // 2. Execute related queries strictly filtered by assigned projects
    const logsQuery = projectIds.length > 0 
      ? supabase.from('activity_logs').select('id, project_id, user_id, action, details, created_at').in('project_id', projectIds).order('created_at', { ascending: false }).limit(100) 
      : Promise.resolve({ data: [] });
    
    const commentsQuery = projectIds.length > 0 
      ? supabase.from('comments').select('id, project_id, user_id, content, created_at, deleted_at').in('project_id', projectIds).is('deleted_at', null).order('created_at', { ascending: false }).limit(100) 
      : Promise.resolve({ data: [] });
    
    const filesQuery = projectIds.length > 0 
      ? supabase.from('files').select('id, project_id, file_name, file_url, category, mime_type, uploaded_by, uploaded_at').in('project_id', projectIds).order('uploaded_at', { ascending: false }).limit(100) 
      : Promise.resolve({ data: [] });
    
    const visitsQuery = projectIds.length > 0 
      ? supabase.from('project_visits').select('id, project_id, scheduled_date, status, assigned_team, projects(name, client_name)').in('project_id', projectIds).order('scheduled_date', { ascending: true }).limit(50) 
      : Promise.resolve({ data: [] });

    // Parallel execution
    const [
      eodRes, 
      tasksRes, 
      notifRes, 
      matReqRes,
      logsRes,
      commentsRes,
      filesRes,
      visitsRes
    ] = await Promise.all([
      getMyEODReportsAction(),
      getEngineerTasksAction(auth.userId),
      getNotificationsAction(),
      getAllMaterialRequestsAction(), // This fetches all for now as per original
      logsQuery,
      commentsQuery,
      filesQuery,
      visitsQuery
    ]);

    const activityLogs = logsRes.data || [];
    const comments = commentsRes.data || [];
    const files = filesRes.data || [];
    const visits = visitsRes.data || [];

    // 3. Extract unique user IDs and fetch profiles ONCE
    const uniqueUserIds = new Set<string>();
    activityLogs.forEach((l: any) => l.user_id && uniqueUserIds.add(l.user_id));
    comments.forEach((c: any) => c.user_id && uniqueUserIds.add(c.user_id));
    assignedProjects.forEach((p: any) => p.project_assignments?.forEach((a: any) => uniqueUserIds.add(a.user_id)));
    
    let allUsers: any[] = [];
    if (uniqueUserIds.size > 0) {
      const supabaseAdmin = await createAdminClient();
      const { data: profilesData } = await supabaseAdmin
        .from('profiles')
        .select('*')
        .in('id', Array.from(uniqueUserIds));
      if (profilesData) allUsers = profilesData;
    }

    return {
      success: true,
      error: null,
      data: normalizeData({
        assignedProjects,
        activityLogs,
        comments,
        files,
        allUsers,
        visits,
        tasks: tasksRes.success ? tasksRes.data : [],
        notifications: notifRes.success ? notifRes.data : [],
        eodReports: eodRes.success ? eodRes.data : [],
        materialRequests: matReqRes.success ? matReqRes.data : []
      })
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ─── FIELD WORKSPACE ───────────────────────────────────────────────────────────

export async function getFieldWorkspaceDataAction(): Promise<WorkspaceResponse<any>> {
  try {
    const { unstable_noStore: noStore } = await import('next/cache');
    noStore();
    const auth = await requireAuthContext();
    if (auth.error) return { success: false, error: auth.error };

    const supabase: any = await createClient();

    const projectsQuery = buildOpsProjectsQuery(supabase, auth.userId!, auth.role!);

    const isFullOps = auth.role === "admin" || auth.role === "engineer";
    const materialsPromise = isFullOps ? getAllMaterialRequestsAction() : getMyMaterialRequestsAction();

    const [
      projectsRes,
      sopsRes,
      eodRes,
      visitsRes,
      materialsRes,
      pendingReportsRes,
      metricsRes
    ] = await Promise.all([
      projectsQuery,
      getSOPsAction(),
      getMyEODReportsAction(),
      getMyVisitsAction(),
      materialsPromise,
      getMyPendingFieldReportsAction(),
      getFieldMetricsAction()
    ]);

    if (projectsRes.error) throw projectsRes.error;
    const assignedProjects = enrichOpsProjects(projectsRes.data || [], auth.userId!);

    return {
      success: true,
      error: null,
      data: normalizeData({
        assignedProjects,
        sops: sopsRes.success ? sopsRes.data : [],
        eodReports: eodRes.success ? eodRes.data : [],
        dailyVisits: visitsRes.success ? visitsRes.data : [],
        materials: materialsRes.success ? materialsRes.data : [],
        pendingReports: pendingReportsRes.success ? pendingReportsRes.data : [],
        metricsData: metricsRes.success && metricsRes.data ? metricsRes.data : { activeRevisions: [], productivity: { weeklyHours: 0, weeklyTasksCompleted: 0 } }
      })
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ─── REVIEW WORKSPACE ──────────────────────────────────────────────────────────

import { getOperationsQueueAction } from "./operations.actions";

export async function getReviewWorkspaceDataAction(): Promise<WorkspaceResponse<any>> {
  try {
    const { unstable_noStore: noStore } = await import('next/cache');
    noStore();
    const auth = await requireAuthContext();
    if (auth.error) return { success: false, error: auth.error };

    const [queueRes, sopsRes, eodRes] = await Promise.all([
      getOperationsQueueAction(),
      getSOPsAction(),
      getMyEODReportsAction()
    ]);

    return {
      success: true,
      error: null,
      data: normalizeData({
        queue: queueRes.data || null,
        sops: sopsRes.success ? sopsRes.data : [],
        eodReports: eodRes.success ? eodRes.data : []
      })
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
// ─── ADMIN WORKSPACE ─────────────────────────────────────────────────────────────

import { getTotalBankBalanceAction } from "./bank.actions";
import { getFinancialOverviewAction, getPendingInvoicesCountAction } from "./finance.actions";
import { getLatestPayrollStatusAction } from "./payroll.actions";
import { getPendingLeavesCountAction } from "./leave.actions";
import { getPendingMaterialRequestsCountAction } from "./field.actions";
import { getActiveProjectsCountAction, getProjectStatusCountsAction } from "./project.actions";
import { getAllOverrideRequestsAction } from "./workflow.actions";

export async function getAdminWorkspaceDataAction(): Promise<WorkspaceResponse<any>> {
  try {
    const { unstable_noStore: noStore } = await import('next/cache');
    noStore();
    const auth = await requireAuthContext();
    if (auth.error) return { success: false, error: auth.error };

    const supabase: any = await createClient();

    // One SQL KPI blob (if migration applied) + remaining domain actions in parallel
    const kpiPromise = supabase.rpc('get_admin_dashboard_kpis').then((r: any) => r).catch(() => ({ data: null, error: true }));

    const [
      kpisRes,
      activeProjectsRes,
      statusCountsRes,
      totalBankBalanceRes,
      financialResult,
      payrollStatusRes,
      pendingLeavesRes,
      pendingInvoicesRes,
      pendingMaterialsRes,
      dispatchOverridesRes,
      materialRequestsRes,
      attendanceTodayRes,
      usersRes,
    ] = await Promise.all([
      kpiPromise,
      getActiveProjectsCountAction(),
      getProjectStatusCountsAction(),
      getTotalBankBalanceAction(),
      getFinancialOverviewAction(),
      getLatestPayrollStatusAction(),
      getPendingLeavesCountAction(),
      getPendingInvoicesCountAction(),
      getPendingMaterialRequestsCountAction(),
      getAllOverrideRequestsAction(),
      getAllMaterialRequestsAction(),
      getTodayAttendanceSummaryAction(),
      getAllUsersAction(),
    ]);

    const kpis = (!kpisRes?.error && kpisRes?.data) ? kpisRes.data : null;

    // Cap heavy list payloads
    const dispatchRaw = dispatchOverridesRes.success ? (dispatchOverridesRes.data ?? []).slice(0, 30) : [];
    const materialsRaw = materialRequestsRes.success ? (materialRequestsRes.data ?? []).slice(0, 30) : [];
    const usersList = usersRes.success ? (usersRes.data ?? []).slice(0, 100) : [];

    // Fallback counts only if RPC missing (pre-migration environments)
    let fallback = {
      ongoingProjectsCount: 0,
      allProjectStatuses: [] as any[],
      pendingExpensesCount: 0,
      pendingMilestonesCount: 0,
      pendingFieldApprovalsCount: 0,
      equipmentIssuesCount: 0,
      pendingEodsCount: 0,
      upcomingHoliday: null as any,
    };

    if (!kpis) {
      const todayStr = new Date().toISOString().split('T')[0];
      const [
        ongoingProjectsQuery,
        allProjectStatusesQuery,
        pendingExpensesRes,
        pendingMilestonesRes,
        pendingFieldApprovalsRes,
        equipmentIssuesRes,
        pendingEodsQuery,
        upcomingHolidayQuery,
      ] = await Promise.all([
        supabase.from('projects').select('id', { count: 'exact', head: true }).in('status', ['prototype', 'review', 'field_work', 'data_sync', 'final_review']).is('deleted_at', null),
        supabase.from('projects').select('status').is('deleted_at', null).limit(500),
        supabase.from('expenses').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('project_milestones').select('id', { count: 'exact', head: true }).in('status', ['pending', 'payment_verification_pending']),
        supabase.from('field_reports').select('id', { count: 'exact', head: true }).eq('status', 'submitted'),
        supabase.from('field_reports').select('id', { count: 'exact', head: true }).eq('report_type', 'issue'),
        supabase.from('eod_reports').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('holidays').select('name, date').gte('date', todayStr).order('date', { ascending: true }).limit(1).maybeSingle(),
      ]);
      fallback = {
        ongoingProjectsCount: ongoingProjectsQuery.count ?? 0,
        allProjectStatuses: allProjectStatusesQuery.data ?? [],
        pendingExpensesCount: pendingExpensesRes.count ?? 0,
        pendingMilestonesCount: pendingMilestonesRes.count ?? 0,
        pendingFieldApprovalsCount: pendingFieldApprovalsRes.count ?? 0,
        equipmentIssuesCount: equipmentIssuesRes.count ?? 0,
        pendingEodsCount: pendingEodsQuery.count ?? 0,
        upcomingHoliday: upcomingHolidayQuery.data ?? null,
      };
    }

    return {
      success: true,
      error: null,
      data: normalizeData({
        activeProjects: activeProjectsRes.success ? activeProjectsRes.data ?? 0 : 0,
        statusCounts: statusCountsRes.success ? statusCountsRes.data ?? {} : {},
        totalBankBalance: totalBankBalanceRes.success ? totalBankBalanceRes.data ?? 0 : 0,
        financial: financialResult.success ? financialResult.data ?? {} : {},
        payrollStatus: payrollStatusRes.success ? payrollStatusRes.data ?? 'Draft' : 'Draft',
        pendingLeaves: pendingLeavesRes.success ? pendingLeavesRes.data ?? 0 : 0,
        pendingInvoices: pendingInvoicesRes.success ? pendingInvoicesRes.data ?? 0 : 0,
        pendingMaterials: pendingMaterialsRes.success ? pendingMaterialsRes.data ?? 0 : 0,
        dispatchOverridesRaw: dispatchRaw,
        materialRequestsRaw: materialsRaw,
        attendanceTodayRaw: attendanceTodayRes.success ? attendanceTodayRes.data ?? {} : {},
        usersList,
        attendanceLogs: [],
        ongoingProjectsCount: kpis?.ongoing_projects ?? fallback.ongoingProjectsCount,
        allProjectStatuses: kpis?.project_statuses ?? fallback.allProjectStatuses,
        pendingExpensesCount: kpis?.pending_expenses ?? fallback.pendingExpensesCount,
        pendingMilestonesCount: kpis?.pending_milestones ?? fallback.pendingMilestonesCount,
        pendingFieldApprovalsCount: kpis?.pending_field_approvals ?? fallback.pendingFieldApprovalsCount,
        equipmentIssuesCount: kpis?.equipment_issues ?? fallback.equipmentIssuesCount,
        pendingEodsCount: kpis?.pending_eods ?? fallback.pendingEodsCount,
        upcomingHoliday: kpis?.upcoming_holiday ?? fallback.upcomingHoliday,
      })
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
// ─── HR WORKSPACE ────────────────────────────────────────────────────────────────

import { getAllUsersAction } from "./admin.actions";
import { getAllLeavesAction } from "./leave.actions";
import { 
  getHRDashboardStatsAction,
  getPendingLeaveRequestsAction,
  getTodayAttendanceSummaryAction,
  getUpcomingHolidaysAction,
  getRecentAnnouncementsAction,
  getOnboardingInProgressAction
} from "./hr.actions";

export async function getHRWorkspaceDataAction(): Promise<WorkspaceResponse<any>> {
  try {
    const { unstable_noStore: noStore } = await import('next/cache');
    noStore();
    const auth = await requireAuthContext();
    if (auth.error) return { success: false, error: auth.error };

    const [
      statsRes, 
      pendingLeavesRes, 
      attendanceTodayRes, 
      holidaysRes, 
      announcementsRes, 
      usersRes,
      allLeavesRes,
      onboardingRes,
      eodRes
    ] = await Promise.all([
       getHRDashboardStatsAction(),
       getPendingLeaveRequestsAction(),
       getTodayAttendanceSummaryAction(),
       getUpcomingHolidaysAction(),
       getRecentAnnouncementsAction(),
       getAllUsersAction(),
       getAllLeavesAction(),
       getOnboardingInProgressAction(),
       getMyEODReportsAction()
    ]);

    return {
      success: true,
      error: null,
      data: normalizeData({
        stats: statsRes.data || {},
        pendingLeaves: pendingLeavesRes.data || [],
        attendanceToday: attendanceTodayRes.data || {},
        holidays: holidaysRes.data || [],
        announcements: announcementsRes.data || [],
        users: usersRes.data || [],
        allLeaves: allLeavesRes.data || [],
        onboarding: onboardingRes.data || [],
        eodReports: eodRes.success ? eodRes.data : []
      })
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}
