"use server";

import { normalizeData } from '@/lib/normalize';

import { getUserProfileAction } from "@/actions/auth.actions";
import { createClient } from "@/lib/supabase/server";
import { insertNotification, insertNotificationsBatch } from "./notification.actions";
import { verifyProjectAccess } from "@/lib/permissions/permissions";

export async function getMyVisitsAction() {
  const profile = await getUserProfileAction();
  if (!profile) return { success: false, error: "Unauthorized" };

  const supabase: any = await createClient();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const endOfWeek = new Date(today);
  endOfWeek.setDate(today.getDate() + 7);

  const { data: assignments } = await supabase
    .from('project_assignments')
    .select('project_id')
    .eq('user_id', profile.id);
    
  const assignedProjectIds = assignments ? assignments.map((a: any) => a.project_id) : [];

  let query = supabase
    .from("project_visits")
    .select(`
      id,
      scheduled_date,
      status,
      projects (
        name,
        client_address
      )
    `)
    .gte("scheduled_date", today.toISOString())
    .lte("scheduled_date", endOfWeek.toISOString())
    .order("scheduled_date", { ascending: true });

  if (assignedProjectIds.length > 0) {
    query = query.or(`assigned_team.cs.{${profile.id}},project_id.in.(${assignedProjectIds.join(',')})`);
  } else {
    query = query.contains("assigned_team", [profile.id]);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching my visits:", error);
    return { success: false, error: error.message };
  }

  const formattedVisits = (data || []).map((visit: any) => {
    const d = new Date(visit.scheduled_date);
    return {
      id: visit.id,
      project_name: visit.projects?.name || "Unknown Project",
      location: visit.projects?.client_address || "Location Pending",
      time: d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      status: visit.status,
    };
  });

  return { success: true, data: normalizeData(formattedVisits) };
}



export async function updateSiteProgressAction(projectId: string, progress: number, notes: string) {
  const profile = await getUserProfileAction();
  if (!profile) return { success: false, error: "Unauthorized" };

  const accessCheck = await verifyProjectAccess(projectId, profile.id, profile.role);
  if (!accessCheck.isAllowed) {
    return { success: false, error: accessCheck.error || "Access denied to this project." };
  }

  const supabase: any = await createClient();

  const { error } = await supabase.from("field_reports").insert({
    id: generateId("rep"),
    project_id: projectId,
    submitted_by: profile.id,
    report_type: "progress",
    report_date: new Date().toISOString().split("T")[0],
    content: `Progress updated to ${progress}%. ${notes || ""}`,
    status: "submitted",
    created_at: new Date().toISOString()
  });

  if (error) {
    console.error("Error updating site progress:", error);
    return { success: false, error: error.message };
  }

  await supabase.from('activity_logs').insert({
    id: generateId("act"),
    project_id: projectId,
    user_id: profile.id,
    action: "SITE_PROGRESS_UPDATED",
    details: { progress, notes },
    created_at: new Date().toISOString(),
  });

  const { revalidatePath } = await import("next/cache");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/field");
  revalidatePath("/operations");
  
  return { success: true, message: "Progress updated successfully." };
}

export async function submitQuickReportAction(projectId: string, formData: FormData) {
  const profile = await getUserProfileAction();
  if (!profile) return { success: false, error: "Unauthorized" };

  const accessCheck = await verifyProjectAccess(projectId, profile.id, profile.role);
  if (!accessCheck.isAllowed) {
    return { success: false, error: accessCheck.error || "Access denied to this project." };
  }

  const file = formData.get("file") as File;
  const notes = formData.get("notes") as string;
  
  if (!file || file.size === 0) {
    return { success: false, error: "No valid file provided" };
  }

  const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
  const ALLOWED_EXTENSIONS = [
    'jpg', 'jpeg', 'png', 'webp', 'gif', 'svg',
    'pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'txt', 'rtf',
    'zip', 'rar', '7z', 'tar', 'gz',
    'dwg', 'dxf', 'rvt', 'skp'
  ];

  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return { success: false, error: "Invalid file type. Please upload a supported document, image, drawing, or archive format." };
  }
  
  if (file.size > MAX_FILE_SIZE) {
    return { success: false, error: "File exceeds the 50MB maximum size limit." };
  }

  const supabase: any = await createClient();
  const fileExt = file.name.split('.').pop()?.toLowerCase() || '';
  const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
  const filePath = `field-reports/${projectId}/${fileName}`;
  
  const { error: uploadError } = await supabase.storage
    .from('project-assets')
    .upload(filePath, file);
    
  if (uploadError) {
    console.error("Upload error:", uploadError);
    return { success: false, error: "Failed to upload file." };
  }
  
  const { data: { publicUrl } } = supabase.storage
    .from('project-assets')
    .getPublicUrl(filePath);

  const reportId = generateId("rep");

  const { error } = await supabase.from("field_reports").insert({
    id: reportId,
    project_id: projectId,
    submitted_by: profile.id,
    report_type: "issue",
    report_date: new Date().toISOString().split("T")[0],
    content: notes || "Quick report with attachment",
    attachments: [publicUrl],
    status: "submitted",
    created_at: new Date().toISOString()
  });

  if (error) {
    console.error("Error creating quick report:", error);
    return { success: false, error: error.message };
  }
  
  await supabase.from('activity_logs').insert({
    id: generateId("act"),
    project_id: projectId,
    user_id: profile.id,
    action: "QUICK_REPORT_SUBMITTED",
    details: { report_id: reportId },
    created_at: new Date().toISOString(),
  });

  return { success: true, message: "Report submitted successfully", fileUrl: publicUrl };
}

export async function getMyPendingFieldReportsAction() {
  const profile = await getUserProfileAction();
  if (!profile) return { success: false, error: "Unauthorized" };

  const supabase: any = await createClient();
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  const { data: assignments, error: asgError } = await supabase
    .from("project_assignments")
    .select("project_id, projects!inner ( id, name, status, deleted_at )")
    .eq("user_id", profile.id)
    .in("projects.status", ["field_assigned", "field_work", "data_sync"])
    .is("projects.deleted_at", null);

  if (asgError) {
    console.error("Error fetching assignments:", asgError);
    return { success: false, error: asgError.message };
  }

  const activeProjects = assignments?.map((a: any) => a.projects) || [];
  if (activeProjects.length === 0) return { success: true, data: [] };

  const projectIds = activeProjects.map((p: any) => p.id);

  const { data: reports, error: reportsError } = await supabase
    .from("field_reports")
    .select("id, project_id, report_date, status, created_at")
    .in("project_id", projectIds)
    .order("created_at", { ascending: false });

  if (reportsError) {
    console.error("Error fetching reports:", reportsError);
    return { success: false, error: reportsError.message };
  }

  const pendingReports = [];

  for (const project of activeProjects) {
    const projectReports = reports?.filter((r: any) => r.project_id === project.id) || [];
    const mostRecentReport = projectReports[0];

    const hasReportToday = projectReports.some((r: any) => {
      if (r.report_date && r.report_date.startsWith(todayStr)) return true;
      if (r.created_at && r.created_at.startsWith(todayStr)) return true;
      return false;
    });

    if (!hasReportToday || (mostRecentReport && mostRecentReport.status === "submitted")) {
      pendingReports.push({
        id: project.id,
        name: project.name,
        status: project.status,
        reason: !hasReportToday ? "Survey report pending" : "Pending acknowledgment",
        isPendingAcceptance: project.status === "field_assigned"
      });
    }
  }

  return { success: true, data: normalizeData(pendingReports) };
}

export async function markVisitCompletedAction(visitId: string) {
  const profile = await getUserProfileAction();
  if (!profile) return { success: false, error: "Unauthorized" };

  const supabase: any = await createClient();
  const { error } = await supabase
    .from("project_visits")
    .update({ 
      status: "completed", 
      completed_date: new Date().toISOString() 
    })
    .eq("id", visitId);

  if (error) {
    console.error("Error marking visit completed:", error);
    return { success: false, error: error.message };
  }

  return { success: true, message: "Visit marked as completed" };
}

function generateId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
}

/**
 * Assign material / equipment to a project (Engineer / Admin workflow).
 */
export async function assignMaterialToProjectAction(
  projectId: string,
  itemName: string,
  quantity: number,
  notes?: string,
  assignedToUserId?: string
) {
  const profile = await getUserProfileAction();
  if (!profile) return { success: false, error: "Unauthorized" };
  if (!["admin", "engineer"].includes(profile.role)) {
    return { success: false, error: "Unauthorized. Engineers and Admins only." };
  }

  const supabase: any = await createClient();
  const materialId = generateId("mat");

  const { data: inserted, error } = await supabase.from("material_requests").insert({
    id: materialId,
    project_id: projectId,
    requested_by: profile.id,
    assigned_by: profile.id,
    assigned_to: assignedToUserId || null,
    item_name: itemName,
    quantity: Math.max(1, Number(quantity) || 1),
    notes: notes || null,
    status: "assigned",
    created_at: new Date().toISOString()
  }).select().single();

  if (error) {
    console.error("Error assigning material to project:", error);
    return { success: false, error: error.message };
  }

  // Log activity
  await supabase.from('activity_logs').insert({
    id: generateId("act"),
    project_id: projectId,
    user_id: profile.id,
    action: "MATERIAL_ASSIGNED",
    details: { item: itemName, quantity, assigned_to: assignedToUserId, material_id: materialId },
    created_at: new Date().toISOString(),
  });

  // Notify assigned user if specified
  if (assignedToUserId) {
    const { data: project } = await supabase.from('projects').select('name').eq('id', projectId).single();
    const projectName = project?.name || projectId;
    await insertNotification({
      userId: assignedToUserId,
      title: "📦 Equipment & Material Assigned",
      message: `You were assigned ${quantity}x ${itemName} for project "${projectName}".`,
      type: "assignment",
      relatedProjectId: projectId
    });
  }

  const { revalidatePath } = await import("next/cache");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/field");
  revalidatePath("/operations");
  revalidatePath("/engineer");

  return { success: true, message: "Material assigned to project", data: inserted };
}

/**
 * Mark a single assigned material / equipment as submitted back to the company.
 */
export async function submitMaterialToCompanyAction(materialId: string, notes?: string) {
  const profile = await getUserProfileAction();
  if (!profile) return { success: false, error: "Unauthorized" };

  const supabase: any = await createClient();
  const { data: material } = await supabase.from("material_requests").select("*").eq("id", materialId).single();
  if (!material) return { success: false, error: "Material not found" };

  const updatedNotes = notes
    ? (material.notes ? `${material.notes} | Returned: ${notes}` : `Returned: ${notes}`)
    : material.notes;

  const { error } = await supabase.from("material_requests").update({
    status: "submitted",
    submitted_at: new Date().toISOString(),
    submitted_by: profile.id,
    notes: updatedNotes
  }).eq("id", materialId);

  if (error) {
    console.error("Error submitting material to company:", error);
    return { success: false, error: error.message };
  }

  // Log activity
  await supabase.from('activity_logs').insert({
    id: generateId("act"),
    project_id: material.project_id,
    user_id: profile.id,
    action: "MATERIAL_SUBMITTED_TO_COMPANY",
    details: { item: material.item_name, quantity: material.quantity, material_id: materialId },
    created_at: new Date().toISOString(),
  });

  const { revalidatePath } = await import("next/cache");
  revalidatePath(`/projects/${material.project_id}`);
  revalidatePath("/field");
  revalidatePath("/operations");
  revalidatePath("/engineer");

  return { success: true, message: `Material "${material.item_name}" submitted to company.` };
}

/**
 * Mark all assigned materials for a project as submitted back to the company.
 */
export async function submitAllProjectMaterialsAction(projectId: string) {
  const profile = await getUserProfileAction();
  if (!profile) return { success: false, error: "Unauthorized" };
  if (!["admin", "engineer"].includes(profile.role)) {
    return { success: false, error: "Unauthorized. Engineers and Admins only." };
  }

  const supabase: any = await createClient();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("material_requests")
    .update({
      status: "submitted",
      submitted_at: now,
      submitted_by: profile.id
    })
    .eq("project_id", projectId)
    .in("status", ["assigned", "requested"]);

  if (error) {
    console.error("Error submitting all materials:", error);
    return { success: false, error: error.message };
  }

  // Log activity
  await supabase.from('activity_logs').insert({
    id: generateId("act"),
    project_id: projectId,
    user_id: profile.id,
    action: "ALL_MATERIALS_SUBMITTED_TO_COMPANY",
    details: { project_id: projectId },
    created_at: now,
  });

  const { revalidatePath } = await import("next/cache");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/field");
  revalidatePath("/operations");
  revalidatePath("/engineer");

  return { success: true, message: "All materials marked as submitted to company." };
}

/**
 * Fetch all materials assigned to a given project.
 */
export async function getProjectMaterialsAction(projectId: string) {
  const profile = await getUserProfileAction();
  if (!profile) return { success: false, error: "Unauthorized", data: [] };

  const supabase: any = await createClient();
  const { data, error } = await supabase
    .from("material_requests")
    .select(`
      id,
      item_name,
      quantity,
      status,
      notes,
      assigned_to,
      assigned_by,
      submitted_at,
      submitted_by,
      created_at,
      profiles:assigned_to ( first_name, last_name, role ),
      assigner:assigned_by ( first_name, last_name )
    `)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching project materials:", error);
    return { success: false, error: error.message, data: [] };
  }

  const formatted = (data || []).map((m: any) => ({
    id: m.id,
    item: m.item_name,
    quantity: m.quantity,
    status: m.status,
    notes: m.notes,
    assigned_to: m.assigned_to,
    assigned_to_name: m.profiles ? `${m.profiles.first_name || ''} ${m.profiles.last_name || ''}`.trim() : null,
    assigned_by_name: m.assigner ? `${m.assigner.first_name || ''} ${m.assigner.last_name || ''}`.trim() : null,
    submitted_at: m.submitted_at,
    created_at: m.created_at
  }));

  return { success: true, data: normalizeData(formatted) };
}

/**
 * Remove an assigned material.
 */
export async function deleteProjectMaterialAction(materialId: string, projectId: string) {
  const profile = await getUserProfileAction();
  if (!profile || !["admin", "engineer"].includes(profile.role)) {
    return { success: false, error: "Unauthorized" };
  }

  const supabase: any = await createClient();
  const { error } = await supabase.from("material_requests").delete().eq("id", materialId);
  if (error) {
    return { success: false, error: error.message };
  }

  const { revalidatePath } = await import("next/cache");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/field");
  revalidatePath("/engineer");

  return { success: true, message: "Material assignment removed." };
}

export async function createMaterialRequestAction(projectId: string, itemName: string, quantity: number, notes: string) {
  // Alias to assignMaterialToProjectAction for backward compatibility
  return assignMaterialToProjectAction(projectId, itemName, quantity, notes);
}

export async function getMyMaterialRequestsAction() {
  const profile = await getUserProfileAction();
  if (!profile) return { success: false, error: "Unauthorized" };

  const supabase: any = await createClient();
  
  // Fetch materials assigned to user's projects or assigned to user directly
  const { data: assignments } = await supabase
    .from('project_assignments')
    .select('project_id')
    .eq('user_id', profile.id);
  const projectIds = (assignments || []).map((a: any) => a.project_id);

  let query = supabase
    .from("material_requests")
    .select(`
      id,
      item_name,
      quantity,
      status,
      notes,
      created_at,
      submitted_at,
      projects ( name )
    `)
    .order("created_at", { ascending: false });

  if (projectIds.length > 0) {
    query = query.or(`assigned_to.eq.${profile.id},requested_by.eq.${profile.id},project_id.in.(${projectIds.join(',')})`);
  } else {
    query = query.or(`assigned_to.eq.${profile.id},requested_by.eq.${profile.id}`);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching material requests:", error);
    return { success: false, error: error.message };
  }

  const formattedRequests = (data || []).map((req: any) => ({
    id: req.id,
    item: req.item_name,
    quantity: req.quantity,
    status: req.status,
    notes: req.notes,
    project_name: req.projects?.name || "Unknown Project",
    submitted_at: req.submitted_at,
    created_at: req.created_at
  }));

  return { success: true, data: normalizeData(formattedRequests) };
}

export async function getAllMaterialRequestsAction() {
  const profile = await getUserProfileAction();
  if (!profile || !["admin", "engineer"].includes(profile.role)) {
    return { success: false, error: "Unauthorized" };
  }

  const supabase: any = await createClient();
  const { data, error } = await supabase
    .from("material_requests")
    .select(`
      id,
      project_id,
      item_name,
      quantity,
      status,
      notes,
      created_at,
      submitted_at,
      projects ( id, name ),
      profiles:assigned_to ( first_name, last_name ),
      requester:requested_by ( first_name, last_name )
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching material requests:", error);
    return { success: false, error: error.message };
  }

  const formattedRequests = (data || []).map((req: any) => ({
    id: req.id,
    project_id: req.project_id || req.projects?.id,
    item: req.item_name,
    quantity: req.quantity,
    status: req.status,
    notes: req.notes,
    project_name: req.projects?.name || "Unknown Project",
    assigned_to_name: req.profiles ? `${req.profiles?.first_name || ""} ${req.profiles?.last_name || ""}`.trim() : null,
    requested_by_name: req.requester ? `${req.requester?.first_name || ""} ${req.requester?.last_name || ""}`.trim() : "Unknown User",
    submitted_at: req.submitted_at,
    created_at: req.created_at
  }));

  return { success: true, data: normalizeData(formattedRequests) };
}

export async function updateMaterialRequestStatusAction(requestId: string, newStatus: "approved" | "delivered" | "rejected" | "submitted" | "assigned") {
  const profile = await getUserProfileAction();
  if (!profile || !["admin", "engineer"].includes(profile.role)) {
    return { success: false, error: "Unauthorized" };
  }

  const supabase: any = await createClient();
  
  const { data: request } = await supabase.from("material_requests").select("*").eq("id", requestId).single();
  if (!request) return { success: false, error: "Request not found" };

  const updatePayload: any = { status: newStatus };
  if (newStatus === "submitted") {
    updatePayload.submitted_at = new Date().toISOString();
    updatePayload.submitted_by = profile.id;
  }

  const { error } = await supabase.from("material_requests").update(updatePayload).eq("id", requestId);
  if (error) {
    console.error("Error updating material request:", error);
    return { success: false, error: error.message };
  }

  // Notify the assigned worker or requester
  const notifyTarget = request.assigned_to || request.requested_by;
  if (notifyTarget) {
    await insertNotification({
      userId: notifyTarget,
      title: `📦 Material ${newStatus === 'submitted' ? 'Submitted in Company' : newStatus}`,
      message: `Material ${request.quantity}x ${request.item_name} marked as ${newStatus}.`,
      type: "assignment",
      relatedProjectId: request.project_id
    });
  }

  return { success: true, message: `Material marked as ${newStatus}` };
}

export async function getFieldMetricsAction(): Promise<any> {
  try {
    const profile: any = await getUserProfileAction();
    if (!profile) return { success: false, error: "Unauthorized.", data: null };
    const userId = profile.id;

    const supabase: any = await createClient();

    // Revision Requests (Projects assigned to field engineer, currently in field_work, that have a rejection comment)
    // 1. Get assignments
    const { data: assignments } = await supabase
      .from('project_assignments')
      .select('project_id')
      .eq('user_id', userId);
    
    const assignedProjectIds = (assignments || []).map((a: any) => a.project_id);

    let activeRevisions: any[] = [];
    if (assignedProjectIds.length > 0) {
      // 2. Get rejection comments for these projects where project is currently in field_work
      const { data: rejections } = await supabase
        .from('comments')
        .select(`
          id,
          project_id,
          content,
          projects!inner (
            status,
            name
          )
        `)
        .ilike('content', '[Survey Rejection]%')
        .in('project_id', assignedProjectIds)
        .eq('projects.status', 'field_work')
        .order('created_at', { ascending: false });

      // Deduplicate by project_id so we only show the latest rejection per project
      const seen = new Set();
      (rejections || []).forEach((r: any) => {
        if (!seen.has(r.project_id)) {
          seen.add(r.project_id);
          activeRevisions.push({
            id: r.id,
            project_id: r.project_id,
            title: r.content,
            status: 'rework_required',
            project_name: r.projects.name
          });
        }
      });
    }

    // Productivity Metrics (from EOD Reports)
    const { data: eodReports } = await supabase
      .from('eod_reports')
      .select('hours_spent, tasks_completed')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(7);

    let totalHours = 0;
    let totalTasksStr = "";
    (eodReports || []).forEach((r: any) => {
      totalHours += (r.hours_spent || 0);
      totalTasksStr += " " + (r.tasks_completed || "");
    });
    
    const tasksArr = totalTasksStr.split(/[\n,]+/).filter(t => t.trim().length > 0);
    
    const productivity = {
      weeklyHours: totalHours,
      weeklyTasksCompleted: tasksArr.length
    };

    return { 
      success: true, 
      error: null, 
      data: {
        activeRevisions,
        productivity
      } 
    };
  } catch (err: any) {
    return { success: false, error: err.message, data: null };
  }
}

export async function getPendingMaterialRequestsCountAction() {
  try {
    const supabase: any = await createClient();
    const { count, error } = await supabase
      .from('material_requests')
      .select('*', { count: 'exact', head: true })
      .in('status', ['assigned', 'requested']);
    if (error) throw error;
    return { success: true, data: count || 0 };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
