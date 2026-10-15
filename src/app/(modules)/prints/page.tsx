import { getUserProfileAction } from "@/actions/auth.actions";
import { listPrintJobsAction, listPrintDocumentTypesAction } from "@/actions/print.actions";
import { redirect } from "next/navigation";
import PrintDeskClient from "./PrintDeskClient";
import { getProjectsListAction } from "@/actions/project.actions";

export default async function PrintDeskPage({ searchParams }: { searchParams: { [key: string]: string | string[] | undefined } }) {
  const profile: any = await getUserProfileAction();
  if (!profile || !["admin", "accountant", "engineer", "developer"].includes(profile.role)) {
    redirect("/unauthorized");
  }

  const [jobsRes, docTypesRes, projectsRes]: any = await Promise.all([
    listPrintJobsAction(),
    listPrintDocumentTypesAction(),
    getProjectsListAction({}).catch(() => ({ data: [] }))
  ]);

  const initialJobs = jobsRes?.data || [];
  const initialDocTypes = docTypesRes?.data || [];
  const projects = Array.isArray(projectsRes) 
    ? projectsRes 
    : (projectsRes?.data?.projects || projectsRes?.data || []);
  
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const urlPrefill = {
    projectId: (resolvedSearchParams?.projectId as string) || "",
    clientName: (resolvedSearchParams?.clientName as string) || "",
    fileName: (resolvedSearchParams?.fileName as string) || "",
    fileId: (resolvedSearchParams?.fileId as string) || "",
  };

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500">
      <PrintDeskClient 
        initialJobs={initialJobs} 
        initialDocTypes={initialDocTypes}
        userRole={profile.role} 
        projects={projects}
        urlPrefill={urlPrefill}
      />
    </div>
  );
}
