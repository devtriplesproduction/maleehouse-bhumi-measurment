'use server';

import { revalidatePath } from 'next/cache';

/**
 * revalidateAccountsPaths
 * Utility to aggressively revalidate and purge Next.js App Router caches across
 * Projects, Sales, and Accountant portals. This guarantees that role-based state
 * transitions (e.g. Sales handover to Accounts) reflect immediately in real-time.
 */
export async function revalidateAccountsPaths(projectId?: string) {
  try {
    if (projectId) {
      revalidatePath(`/projects/${projectId}`);
    }
    
    // Core routes
    revalidatePath('/projects');
    revalidatePath('/sales');
    // NOTE: '/accounts' and all of its subpages (intake, billing, approvals,
    // verification, reports, quotations, milestones) were previously each
    // revalidated individually AND via a layout-scoped call below. In the
    // Next.js App Router, revalidatePath(path, 'layout') invalidates that
    // layout segment and every nested route beneath it in one call, so the
    // per-subpage calls were redundant duplicate cache purges. Removed here;
    // the layout-scoped call at the bottom of this function still covers all
    // of them with identical cache correctness.

    // Operations specific subpages
    revalidatePath('/engineer');
    revalidatePath('/field');
    
    // Force revalidation of route group layouts
    revalidatePath('/(modules)/accounts', 'layout');
    revalidatePath('/(modules)/(operations)/engineer', 'layout');
    revalidatePath('/accounts', 'layout');
    
    console.log(`[Revalidation] Cleared App Router caches for sales, projects, and accountant subpaths${projectId ? ` (Project: ${projectId})` : ''}`);
  } catch (error) {
    console.error('[Revalidation] Failed to execute path revalidations:', error);
  }
}
