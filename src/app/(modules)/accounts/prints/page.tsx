import { getUserProfileAction } from "@/actions/auth.actions";
import { listPrintJobsAction } from "@/actions/print.actions";
import { redirect } from "next/navigation";
import PrintLedgerClient from "./PrintLedgerClient";

export default async function PrintLedgerPage({ searchParams }: { searchParams: { [key: string]: string | string[] | undefined } }) {
  const profile: any = await getUserProfileAction();
  if (!profile || !["admin", "accountant", "developer"].includes(profile.role)) {
    redirect("/unauthorized");
  }

  const resolvedSearchParams = await Promise.resolve(searchParams);
  const filters = {
    status: (resolvedSearchParams?.status as string) || undefined,
    from: (resolvedSearchParams?.from as string) || undefined,
    to: (resolvedSearchParams?.to as string) || undefined,
    search: (resolvedSearchParams?.search as string) || undefined,
  };

  const { data: initialJobs } = await listPrintJobsAction(filters);

  return (
    <div className="space-y-4 pb-20 animate-in fade-in duration-500">
      <PrintLedgerClient 
        initialJobs={initialJobs || []} 
        userRole={profile.role} 
        filters={filters}
      />
    </div>
  );
}
