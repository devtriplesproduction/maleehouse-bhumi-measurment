import React, { Suspense } from "react";
import { getLostMaterialsAction } from "@/actions/field.actions";
import { LostMaterialsDashboard } from "@/components/modules/LostMaterialsDashboard";

export const metadata = {
  title: "Lost Equipment & Materials | Admin Portal",
  description: "Track unreturned equipment, accountable team members, and resolution status across all projects."
};

export default async function AdminLostMaterialsPage() {
  const result = await getLostMaterialsAction();

  if (!result.success) {
    return (
      <div className="p-8 text-center bg-rose-50 dark:bg-rose-950/20 rounded-2xl border border-rose-200 dark:border-rose-900/30 text-rose-600 dark:text-rose-400">
        <h2 className="text-xl font-bold">Failed to load lost materials records</h2>
        <p className="text-sm mt-1">{result.error}</p>
      </div>
    );
  }

  const materials = result.data || [];

  return (
    <div className="animate-in fade-in duration-500">
      <Suspense fallback={<div className="h-[600px] bg-white/5 animate-pulse rounded-2xl" />}>
        <LostMaterialsDashboard initialMaterials={materials} />
      </Suspense>
    </div>
  );
}
