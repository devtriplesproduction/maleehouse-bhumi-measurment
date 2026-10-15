import React from "react";
import { Metadata } from "next";
import { redirect } from "next/navigation";
import { getUserProfileAction } from "@/actions/auth.actions";
import { getEquipmentCatalogAction } from "@/actions/equipment.actions";
import { EquipmentsManager } from "@/components/modules/EquipmentsManager";

export const metadata: Metadata = {
  title: "Equipment & Parts Catalog | Malee House",
  description: "Manage survey equipments and their subparts/accessories.",
};

export default async function EquipmentsPage() {
  const profile = await getUserProfileAction();

  if (!profile) {
    redirect("/login");
  }

  // Allowed for engineers and admins
  if (!["admin", "engineer"].includes(profile.role)) {
    redirect("/unauthorized");
  }

  const res = await getEquipmentCatalogAction();
  const catalog = res.success && res.data ? res.data : [];

  return (
    <div className="py-2">
      <EquipmentsManager initialCatalog={catalog} userRole={profile.role} />
    </div>
  );
}
