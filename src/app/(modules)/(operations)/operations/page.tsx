import React from "react";
import { redirect } from "next/navigation";
import { getUserProfileAction } from "@/actions/auth.actions";
import { getOperationsQueueAction } from "@/actions/operations.actions";
import { OperationsDashboardClient } from "@/features/operations/OperationsDashboardClient";

export default async function OperationsPage() {
  const profile = await getUserProfileAction();
  const queueResult = await getOperationsQueueAction();
  const queue = queueResult.data;

  const firstName = profile?.first_name || "Operator";
  const role = profile?.role || "engineer";


  return (
    <OperationsDashboardClient
      queue={queue}
      firstName={firstName}
      role={role}
    />
  );
}
