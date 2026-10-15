/**
 * Shared commercial / dispatch stage helpers.
 * Keeps Client Approvals, finance transitions, and KPIs on one status model.
 */

/** Stages before the project is active in engineering/ops. */
export const PRE_OPS_STATUSES = [
  'lead',
  'lead_created',
  'requirement_gathering',
  'payment_pending',
  'payment_done',
  'ready_for_dispatch',
] as const;

/**
 * Stages that belong on Engineer / Field ops dashboards
 * (after accounts dispatches → project_created / "Active in Ops").
 */
export const OPS_ACTIVE_STATUSES = [
  'project_created',
  'data_collection',
  'prototype',
  'review',
  'field_assigned',
  'field_work',
  'data_sync',
  'final_review',
] as const;

export function isProjectDispatchedToOps(status?: string | null): boolean {
  if (!status) return false;
  return !(PRE_OPS_STATUSES as readonly string[]).includes(status);
}

export function isReadyForDispatch(status?: string | null): boolean {
  return status === 'ready_for_dispatch';
}

export function hasActiveMilestones(
  milestones?: Array<{ title?: string | null }> | null
): boolean {
  if (!milestones?.length) return false;
  return milestones.some((m) => m && !String(m.title || '').includes('[Archived]'));
}
