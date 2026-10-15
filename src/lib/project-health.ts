export type HealthState = "Healthy" | "Delayed" | "Blocked" | "Frozen" | "At Risk";

export interface HealthResult {
  status: HealthState;
  score: number;
  details: string[];
}

/**
 * Calculates project health dynamically based on operational state markers.
 * Formula: Risk = 0.35 * BlockerIssues + 0.25 * OverdueTasks + 0.20 * RejectionCount + 0.15 * SLADelays + 0.05 * UnpaidMilestones
 */
export function calculateProjectHealth(context: {
  isFrozen: boolean;
  unpaidMilestonesCount: number;
  overdueTasksCount: number;
  rejectionCount: number;
  criticalIssuesCount: number;
  slaViolationsCount: number;
}): HealthResult {
  const details: string[] = [];
  
  if (context.isFrozen) {
    return {
      status: "Frozen",
      score: 10.0,
      details: ["Project is frozen: Financial lock is active due to outstanding milestone payments."]
    };
  }

  // 1. Calculate weighted risk factors
  const blockerRisk = context.criticalIssuesCount * 3.5;
  const overdueRisk = context.overdueTasksCount * 2.5;
  const rejectionRisk = context.rejectionCount * 2.0;
  const slaRisk = context.slaViolationsCount * 1.5;
  const paymentRisk = context.unpaidMilestonesCount * 0.5;

  const totalScore = blockerRisk + overdueRisk + rejectionRisk + slaRisk + paymentRisk;

  // Compile detailed descriptions
  if (context.criticalIssuesCount > 0) {
    details.push(`${context.criticalIssuesCount} unresolved critical/high severity issue(s) active.`);
  }
  if (context.overdueTasksCount > 0) {
    details.push(`${context.overdueTasksCount} task(s) currently overdue past deadlines.`);
  }
  if (context.rejectionCount > 0) {
    details.push(`${context.rejectionCount} Deliverable review rejection(s) logged.`);
  }
  if (context.slaViolationsCount > 0) {
    details.push(`${context.slaViolationsCount} SLA compliance deadline violation(s) detected.`);
  }
  if (context.unpaidMilestonesCount > 0) {
    details.push(`${context.unpaidMilestonesCount} billing milestone invoice(s) pending payment verification.`);
  }

  // Determine Category State
  let status: HealthState = "Healthy";
  if (totalScore >= 5.0 || context.rejectionCount >= 3) {
    status = "At Risk";
  } else if (context.criticalIssuesCount > 0 || totalScore >= 3.0) {
    status = "Blocked";
  } else if (context.overdueTasksCount > 0 || totalScore >= 1.0) {
    status = "Delayed";
  }

  if (details.length === 0) {
    details.push("All operational systems healthy. Deadlines and payment streams on track.");
  }

  return {
    status,
    score: Math.min(10, parseFloat(totalScore.toFixed(1))),
    details
  };
}

/**
 * Checks for SLA violations on project tasks.
 */
export function getSLAViolationsCount(tasks: any[]): number {
  const now = new Date().getTime();
  let violations = 0;

  for (const t of tasks) {
    if (t.status === "completed") continue;
    
    // Custom SLA targets in hours
    const slaLimits: Record<string, number> = {
      deliverable_review: 24,
      field_upload: 48,
      qc_signoff: 12
    };

    const taskType = t.type || (t.title?.toLowerCase().includes("deliverable") || t.title?.toLowerCase().includes("draft") ? "deliverable_review" : t.title?.toLowerCase().includes("field") ? "field_upload" : "qc_signoff");
    const limitHours = slaLimits[taskType] || 48; // default to 48 hours

    const createdTime = new Date(t.created_at || t.dueDate || new Date()).getTime();
    const ageHours = (now - createdTime) / (1000 * 60 * 60);

    if (ageHours > limitHours) {
      violations++;
    }
  }

  return violations;
}
