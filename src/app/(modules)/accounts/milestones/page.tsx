import React, { Suspense } from "react";
import { getProjectsWithFinancialsAction } from "@/actions/finance.actions";
import { ProjectMilestonesContent } from "@/features/accounts/ProjectMilestonesContent";
import DashboardLoading from "@/app/(modules)/loading";

export const metadata = {
  title: "Project Milestones | MaleeHouse",
};

export default async function ProjectMilestonesPage({
  searchParams
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  let initialProjects: any[] = [];
  
  // Fetch all active, non-archived projects so milestones can be tracked across any stage
  const projRes = await getProjectsWithFinancialsAction();

  if (projRes?.success && projRes.data) {
    initialProjects = projRes.data;
  }

  return (
    <Suspense fallback={<DashboardLoading />}>
      <ProjectMilestonesContent initialProjects={initialProjects} />
    </Suspense>
  );
}
