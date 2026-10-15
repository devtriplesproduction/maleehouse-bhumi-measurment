export interface ActiveReworkInfo {
  type: 'survey' | 'final' | 'qc';
  title: string;
  badge: string;
  reason: string;
  instructions?: string | null;
  actor?: string | null;
  timestamp?: string | null;
}

export function detectActiveRework(
  projectStatus: string,
  activityLogs: any[] = [],
  comments: any[] = []
): ActiveReworkInfo | null {
  // 1. Survey Data Rework check: projectStatus === 'field_work'
  if (projectStatus === 'field_work') {
    const surveyRejection = activityLogs.find((l: any) => l.action === 'FIELD_SURVEY_REJECTED');
    const rejectionComment = comments.find((c: any) => 
      c.comment_type === 'rejection' || (c.content && c.content.includes('[Survey Rejection]'))
    );
    
    if (surveyRejection || rejectionComment) {
      const reason = surveyRejection?.details?.reviewNotes 
        || rejectionComment?.content?.replace(/^\[Survey Rejection\]\s*/i, '')
        || 'Survey data returned for rework.';
      const actor = surveyRejection?.actor_profile 
        ? `${surveyRejection.actor_profile.first_name || ''} ${surveyRejection.actor_profile.last_name || ''}`.trim()
        : (rejectionComment?.author_profile 
            ? `${rejectionComment.author_profile.first_name || ''} ${rejectionComment.author_profile.last_name || ''}`.trim() 
            : null);
      const timestamp = surveyRejection?.created_at || rejectionComment?.created_at;

      return {
        type: 'survey',
        title: 'Field Survey Returned For Rework',
        badge: 'Survey Rework Required',
        reason,
        actor: actor || null,
        timestamp: timestamp || null,
      };
    }
  }

  // 2. Final Deliverables / QC Rework check:
  const finalRejection = activityLogs.find((l: any) => 
    l.action === 'ENGINEER_FINAL_DELIVERABLE_REJECTED' || l.action === 'QC_REJECTED'
  );
  const isResolved = activityLogs.some((l: any) => 
    l.action === 'ENGINEER_FINAL_DELIVERABLE_APPROVED' || l.action === 'QC_APPROVED'
  );

  if (finalRejection && !isResolved && projectStatus !== 'completed' && projectStatus !== 'archived') {
    const reason = finalRejection.details?.reason || finalRejection.details?.note || 'Deliverable returned for revision.';
    const instructions = finalRejection.details?.instructions;
    const actor = finalRejection.actor_profile
      ? `${finalRejection.actor_profile.first_name || ''} ${finalRejection.actor_profile.last_name || ''}`.trim()
      : null;
    const timestamp = finalRejection.created_at;

    return {
      type: finalRejection.action === 'QC_REJECTED' ? 'qc' : 'final',
      title: finalRejection.action === 'QC_REJECTED' ? 'QC Rework Requested' : 'Final Deliverable Revision Requested',
      badge: 'Deliverable Revision',
      reason,
      instructions: instructions || null,
      actor: actor || null,
      timestamp: timestamp || null,
    };
  }

  return null;
}
