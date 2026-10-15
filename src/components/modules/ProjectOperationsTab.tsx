'use client';

import React from 'react';

import { OperationsFileUploadPanel } from './OperationsFileUploadPanel';

interface ProjectOperationsTabProps {
  projectId: string;
  projectStatus: string;
  userRole: string;
  currentUserId: string;
  teamMembers: any[];
  isFrozen?: boolean;
  files?: any[];
  cadRevisions?: any[];
  comments: any[];
  activityLogs: any[];
  workflowHistory: any[];
  onUpdateFiles?: (files: any[]) => void;
  onUpdateProject?: (updatedProject: any) => void;
}

export default function ProjectOperationsTab({
  projectId,
  projectStatus,
  userRole,
  currentUserId,
  teamMembers,
  isFrozen,
  files,
  cadRevisions,
  comments,
  activityLogs,
  workflowHistory,
  onUpdateFiles,
  onUpdateProject,
}: ProjectOperationsTabProps) {
  // Determine if user is operational role
  const isOperational = ['admin', 'engineer', 'field'].includes(userRole);
  const isAssigned = userRole === 'admin' || teamMembers.some((m: any) => m.userId === currentUserId || m.user_id === currentUserId);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* 1. File Uploads */}
      {isOperational && isAssigned && (
        <section className="space-y-4">
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            Project Files
          </h2>
          <OperationsFileUploadPanel
            projectId={projectId}
            files={files || []}
            userRole={userRole}
            projectStatus={projectStatus}
            teamMembers={teamMembers}
            cadRevisions={cadRevisions}
            onUpdateFiles={onUpdateFiles}
            onUpdateProject={onUpdateProject}
          />
        </section>
      )}

    </div>
  );
}
