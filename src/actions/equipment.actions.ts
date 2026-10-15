"use server";

import { revalidatePath } from "next/cache";
import { getUserProfileAction } from "@/actions/auth.actions";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  EquipmentItem,
  EquipmentSubpart,
  DEFAULT_EQUIPMENT_CATALOG,
} from "@/types/equipment.types";

const SETTINGS_KEY = "equipment_catalog";

function generateId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
}

/**
 * Fetch the master list of equipment and their subparts.
 * Falls back to DEFAULT_EQUIPMENT_CATALOG if not yet initialized in system_settings.
 */
export async function getEquipmentCatalogAction(): Promise<{
  success: boolean;
  data: EquipmentItem[];
  error?: string;
}> {
  try {
    const supabaseAdmin: any = createAdminClient();
    const { data, error } = await supabaseAdmin
      .from("system_settings")
      .select("value")
      .eq("key", SETTINGS_KEY)
      .maybeSingle();

    if (error) {
      console.warn("Could not query equipment catalog from system_settings, using defaults:", error.message);
      return { success: true, data: DEFAULT_EQUIPMENT_CATALOG };
    }

    if (!data || !data.value || !Array.isArray(data.value.items) || data.value.items.length === 0) {
      // Lazy auto-seed defaults so user can immediately edit them
      try {
        await supabaseAdmin.from("system_settings").upsert(
          {
            key: SETTINGS_KEY,
            value: { items: DEFAULT_EQUIPMENT_CATALOG },
            updated_at: new Date().toISOString(),
          },
          { onConflict: "key" }
        );
      } catch (seedErr) {
        console.warn("Failed to auto-seed default equipment catalog:", seedErr);
      }
      return { success: true, data: DEFAULT_EQUIPMENT_CATALOG };
    }

    return { success: true, data: data.value.items as EquipmentItem[] };
  } catch (err: any) {
    console.error("Error fetching equipment catalog:", err);
    return { success: true, data: DEFAULT_EQUIPMENT_CATALOG };
  }
}

/**
 * Add or update an equipment item with its subparts.
 * Accessible to Engineers and Admins.
 */
export async function saveEquipmentItemAction(item: {
  id?: string;
  name: string;
  category?: string;
  code?: string;
  description?: string;
  subparts: Array<{
    id?: string;
    name: string;
    defaultQuantity?: number;
    isRequired?: boolean;
    description?: string;
  }>;
}): Promise<{ success: boolean; data?: EquipmentItem; error?: string }> {
  try {
    const profile = await getUserProfileAction();
    if (!profile) return { success: false, error: "Unauthorized" };
    if (!["admin", "engineer"].includes(profile.role)) {
      return { success: false, error: "Unauthorized. Engineers and Admins only." };
    }

    if (!item.name || !item.name.trim()) {
      return { success: false, error: "Equipment name is required" };
    }

    const supabaseAdmin: any = createAdminClient();
    const currentRes = await getEquipmentCatalogAction();
    const existingList: EquipmentItem[] = currentRes.success && currentRes.data ? [...currentRes.data] : [...DEFAULT_EQUIPMENT_CATALOG];

    const cleanSubparts: EquipmentSubpart[] = (item.subparts || [])
      .filter((s) => s.name && s.name.trim())
      .map((s) => ({
        id: s.id && s.id.trim() ? s.id.trim() : generateId("sub"),
        name: s.name.trim(),
        defaultQuantity: Math.max(1, Number(s.defaultQuantity) || 1),
        isRequired: Boolean(s.isRequired),
        description: s.description?.trim() || undefined,
      }));

    const now = new Date().toISOString();
    const itemId = item.id && item.id.trim() ? item.id.trim() : generateId("eq");

    const completeItem: EquipmentItem = {
      id: itemId,
      name: item.name.trim(),
      category: item.category?.trim() || "Survey Equipment",
      code: item.code?.trim() || undefined,
      description: item.description?.trim() || undefined,
      subparts: cleanSubparts,
      createdAt: now,
      updatedAt: now,
    };

    const targetIdx = existingList.findIndex((x) => x.id === itemId);
    if (targetIdx >= 0) {
      completeItem.createdAt = existingList[targetIdx].createdAt || now;
      existingList[targetIdx] = completeItem;
    } else {
      existingList.unshift(completeItem);
    }

    const { error: upsertErr } = await supabaseAdmin.from("system_settings").upsert(
      {
        key: SETTINGS_KEY,
        value: { items: existingList },
        updated_at: now,
      },
      { onConflict: "key" }
    );

    if (upsertErr) {
      console.error("Error upserting equipment catalog:", upsertErr);
      return { success: false, error: upsertErr.message };
    }

    revalidatePath("/equipments");
    revalidatePath("/projects");
    revalidatePath("/engineer");

    return { success: true, data: completeItem };
  } catch (err: any) {
    console.error("Error saving equipment item:", err);
    return { success: false, error: err.message || "Failed to save equipment" };
  }
}

/**
 * Delete an equipment item from the catalog.
 */
export async function deleteEquipmentItemAction(itemId: string): Promise<{ success: boolean; error?: string }> {
  try {
    const profile = await getUserProfileAction();
    if (!profile) return { success: false, error: "Unauthorized" };
    if (!["admin", "engineer"].includes(profile.role)) {
      return { success: false, error: "Unauthorized. Engineers and Admins only." };
    }

    const supabaseAdmin: any = createAdminClient();
    const currentRes = await getEquipmentCatalogAction();
    const existingList: EquipmentItem[] = currentRes.success && currentRes.data ? [...currentRes.data] : [...DEFAULT_EQUIPMENT_CATALOG];

    const updatedList = existingList.filter((x) => x.id !== itemId);

    const { error: upsertErr } = await supabaseAdmin.from("system_settings").upsert(
      {
        key: SETTINGS_KEY,
        value: { items: updatedList },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );

    if (upsertErr) {
      return { success: false, error: upsertErr.message };
    }

    revalidatePath("/equipments");
    revalidatePath("/projects");
    revalidatePath("/engineer");

    return { success: true };
  } catch (err: any) {
    console.error("Error deleting equipment item:", err);
    return { success: false, error: err.message || "Failed to delete equipment" };
  }
}

/**
 * Reset the equipment catalog back to standard defaults.
 */
export async function resetEquipmentCatalogAction(): Promise<{ success: boolean; error?: string }> {
  try {
    const profile = await getUserProfileAction();
    if (!profile) return { success: false, error: "Unauthorized" };
    if (!["admin", "engineer"].includes(profile.role)) {
      return { success: false, error: "Unauthorized. Engineers and Admins only." };
    }

    const supabaseAdmin: any = createAdminClient();
    const { error } = await supabaseAdmin.from("system_settings").upsert(
      {
        key: SETTINGS_KEY,
        value: { items: DEFAULT_EQUIPMENT_CATALOG },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "key" }
    );

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/equipments");
    revalidatePath("/projects");
    revalidatePath("/engineer");

    return { success: true };
  } catch (err: any) {
    console.error("Error resetting equipment catalog:", err);
    return { success: false, error: err.message || "Failed to reset equipment catalog" };
  }
}
