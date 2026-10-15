"use client";

import React, { useState, useEffect, useTransition, useMemo } from "react";
import { createPortal } from "react-dom";
import {
  Wrench,
  Plus,
  Trash2,
  Edit2,
  Search,
  RotateCcw,
  Package,
  Layers,
  Cpu,
  Check,
  X,
  AlertCircle,
  HelpCircle,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { EquipmentItem, EquipmentSubpart } from "@/types/equipment.types";
import {
  saveEquipmentItemAction,
  deleteEquipmentItemAction,
  resetEquipmentCatalogAction,
} from "@/actions/equipment.actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface EquipmentsManagerProps {
  initialCatalog: EquipmentItem[];
  userRole?: string;
}

const CATEGORY_PRESETS = [
  "All",
  "Aerial Survey",
  "Optical Survey",
  "GNSS / Satellite",
  "Accessories",
  "Measuring Tools",
];

export function EquipmentsManager({ initialCatalog, userRole }: EquipmentsManagerProps) {
  const [catalog, setCatalog] = useState<EquipmentItem[]>(initialCatalog);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(6);
  const [isPending, startTransition] = useTransition();

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<EquipmentItem | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Prevent background scroll when modal is open
  useEffect(() => {
    if (isModalOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isModalOpen]);

  // Form State
  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState("Aerial Survey");
  const [formCode, setFormCode] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formSubparts, setFormSubparts] = useState<
    Array<{ id: string; name: string; defaultQuantity: number; isRequired: boolean }>
  >([]);

  // Reset confirmation
  const [isResetting, setIsResetting] = useState(false);

  // Filtered equipments
  const filteredCatalog = useMemo(() => {
    return catalog.filter((item) => {
      const matchCat =
        selectedCategory === "All" ||
        item.category.toLowerCase() === selectedCategory.toLowerCase();
      if (!matchCat) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      const matchName = item.name.toLowerCase().includes(q);
      const matchCode = item.code?.toLowerCase().includes(q);
      const matchDesc = item.description?.toLowerCase().includes(q);
      const matchSub = item.subparts.some((s) => s.name.toLowerCase().includes(q));

      return matchName || matchCode || matchDesc || matchSub;
    });
  }, [catalog, searchQuery, selectedCategory]);

  const totalSubpartsCount = useMemo(() => {
    return catalog.reduce((acc, item) => acc + (item.subparts?.length || 0), 0);
  }, [catalog]);

  const categoriesCount = useMemo(() => {
    return new Set(catalog.map((i) => i.category)).size;
  }, [catalog]);

  // Reset pagination on filter or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory, pageSize]);

  // Pagination calculations
  const totalItems = filteredCatalog.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);

  const startIndex = (safeCurrentPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const paginatedCatalog = useMemo(() => {
    return filteredCatalog.slice(startIndex, endIndex);
  }, [filteredCatalog, startIndex, endIndex]);

  const fromItem = totalItems === 0 ? 0 : startIndex + 1;
  const toItem = endIndex;

  const getPageNumbers = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (safeCurrentPage <= 4) {
      return [1, 2, 3, 4, 5, "...", totalPages];
    }
    if (safeCurrentPage >= totalPages - 3) {
      return [1, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, "...", safeCurrentPage - 1, safeCurrentPage, safeCurrentPage + 1, "...", totalPages];
  };

  const handleOpenAddModal = () => {
    setEditingItem(null);
    setFormName("");
    setFormCategory("Aerial Survey");
    setFormCode("");
    setFormDescription("");
    setFormSubparts([
      { id: `temp-${Date.now()}-1`, name: "Battery", defaultQuantity: 2, isRequired: true },
      { id: `temp-${Date.now()}-2`, name: "Charger", defaultQuantity: 1, isRequired: true },
    ]);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item: EquipmentItem) => {
    setEditingItem(item);
    setFormName(item.name);
    setFormCategory(item.category);
    setFormCode(item.code || "");
    setFormDescription(item.description || "");
    setFormSubparts(
      (item.subparts || []).map((s) => ({
        id: s.id,
        name: s.name,
        defaultQuantity: s.defaultQuantity || 1,
        isRequired: Boolean(s.isRequired),
      }))
    );
    setIsModalOpen(true);
  };

  const handleAddSubpartRow = () => {
    setFormSubparts((prev) => [
      ...prev,
      {
        id: `temp-${Date.now()}-${prev.length + 1}`,
        name: "",
        defaultQuantity: 1,
        isRequired: false,
      },
    ]);
  };

  const handleRemoveSubpartRow = (index: number) => {
    setFormSubparts((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubpartChange = (
    index: number,
    field: "name" | "defaultQuantity" | "isRequired",
    value: any
  ) => {
    setFormSubparts((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  const handleSaveEquipment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      toast.error("Equipment name is required");
      return;
    }

    const validSubparts = formSubparts.filter((s) => s.name.trim().length > 0);
    if (validSubparts.length === 0) {
      toast.error("Please add at least one subpart (e.g. Battery, Charger)");
      return;
    }

    startTransition(async () => {
      const payload = {
        id: editingItem?.id,
        name: formName.trim(),
        category: formCategory.trim(),
        code: formCode.trim() || undefined,
        description: formDescription.trim() || undefined,
        subparts: validSubparts.map((s) => ({
          id: s.id.startsWith("temp-") ? undefined : s.id,
          name: s.name.trim(),
          defaultQuantity: Number(s.defaultQuantity) || 1,
          isRequired: s.isRequired,
        })),
      };

      const res = await saveEquipmentItemAction(payload);
      if (res.success && res.data) {
        toast.success(
          editingItem
            ? `Updated equipment "${res.data.name}"`
            : `Added new equipment "${res.data.name}"`
        );
        setCatalog((prev) => {
          const idx = prev.findIndex((x) => x.id === res.data!.id);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = res.data!;
            return next;
          }
          return [res.data!, ...prev];
        });
        setIsModalOpen(false);
      } else {
        toast.error(res.error || "Failed to save equipment");
      }
    });
  };

  const handleDeleteItem = async (item: EquipmentItem) => {
    if (!confirm(`Are you sure you want to delete "${item.name}" and all its subparts?`)) {
      return;
    }

    startTransition(async () => {
      const res = await deleteEquipmentItemAction(item.id);
      if (res.success) {
        toast.success(`Deleted "${item.name}"`);
        setCatalog((prev) => prev.filter((x) => x.id !== item.id));
      } else {
        toast.error(res.error || "Failed to delete equipment");
      }
    });
  };

  const handleResetDefaults = async () => {
    if (
      !confirm(
        "Are you sure you want to reset the equipment catalog to standard survey defaults? Any custom items will be overwritten."
      )
    ) {
      return;
    }

    setIsResetting(true);
    startTransition(async () => {
      const res = await resetEquipmentCatalogAction();
      setIsResetting(false);
      if (res.success) {
        toast.success("Equipment catalog reset to standard presets");
        window.location.reload();
      } else {
        toast.error(res.error || "Failed to reset equipment catalog");
      }
    });
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 animate-in fade-in duration-300">
      {/* ── Page Header ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-200/80 dark:border-white/10">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-500/20 shadow-sm">
              <Wrench className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                Equipment & Parts Catalog
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Define master survey instruments (e.g. Drone, Total Station, DGPS) and their components (Batteries, Chargers, Accessories).
              </p>
            </div>
          </div>
        </div>

        {/* Header Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            disabled={isPending || isResetting}
            onClick={handleResetDefaults}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition active:scale-95 disabled:opacity-50"
            title="Restore default survey equipment catalog"
          >
            <RotateCcw className={cn("w-3.5 h-3.5", isResetting && "animate-spin")} />
            <span>Reset Defaults</span>
          </button>

          <button
            type="button"
            onClick={handleOpenAddModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm shadow-indigo-500/30 transition-all active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Add Equipment</span>
          </button>
        </div>
      </div>

      {/* ── KPI Quick Stats ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-white/10 shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Equipments</p>
            <p className="text-xl font-black text-slate-900 dark:text-white mt-0.5">{catalog.length}</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-white/10 shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Subparts & Accessories</p>
            <p className="text-xl font-black text-slate-900 dark:text-white mt-0.5">{totalSubpartsCount}</p>
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-white/10 shadow-sm flex items-center gap-3.5">
          <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
            <Cpu className="w-5 h-5" />
          </div>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Equipment Categories</p>
            <p className="text-xl font-black text-slate-900 dark:text-white mt-0.5">{categoriesCount}</p>
          </div>
        </div>
      </div>

      {/* ── Filters & Search ── */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-2xl bg-slate-50/70 dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/10">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search equipment or subpart (e.g. Drone, Battery, Total Station)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 focus:outline-none focus:border-indigo-500 font-medium"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Category Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 custom-scrollbar">
          {CATEGORY_PRESETS.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(cat)}
              className={cn(
                "text-xs px-3 py-1.5 rounded-xl border font-bold transition-all shrink-0",
                selectedCategory === cat
                  ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                  : "bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:border-indigo-400"
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* ── Equipment Cards Grid ── */}
      {filteredCatalog.length === 0 ? (
        <div className="text-center py-16 px-4 rounded-3xl border-2 border-dashed border-slate-200 dark:border-white/10 bg-white/40 dark:bg-white/[0.01]">
          <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-500 flex items-center justify-center mx-auto mb-3">
            <Package className="w-7 h-7" />
          </div>
          <p className="font-bold text-sm text-slate-800 dark:text-slate-200">No equipment found</p>
          <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
            {searchQuery
              ? `No equipment matches your search "${searchQuery}". Try a different keyword.`
              : "No equipment in this category. Click 'Add Equipment' above to create one."}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {paginatedCatalog.map((item) => (
              <div
                key={item.id}
                className="group rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-white/10 hover:border-indigo-500/40 hover:shadow-md transition-all duration-200 flex flex-col justify-between overflow-hidden"
              >
                {/* Card Top */}
                <div className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className="w-9 h-9 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 mt-0.5 group-hover:scale-105 transition-transform">
                        <Wrench className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-black text-sm text-slate-900 dark:text-white leading-tight truncate">
                          {item.name}
                        </h3>
                        <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-300 border border-indigo-500/20">
                            {item.category}
                          </span>
                          {item.code && (
                            <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300">
                              {item.code}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions: Edit / Delete */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenEditModal(item)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition"
                        title="Edit Equipment & Subparts"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleDeleteItem(item)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition disabled:opacity-50"
                        title="Delete Equipment"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {item.description && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2">
                      {item.description}
                    </p>
                  )}

                  {/* Subparts Section */}
                  <div className="pt-2 border-t border-slate-100 dark:border-white/5 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                        <Layers className="w-3 h-3 text-indigo-500" />
                        Subparts & Accessories ({item.subparts?.length || 0})
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1 custom-scrollbar">
                      {item.subparts && item.subparts.length > 0 ? (
                        item.subparts.map((sub) => (
                          <div
                            key={sub.id}
                            className="inline-flex items-center gap-1.5 text-[11px] px-2 py-1 rounded-lg bg-slate-50 dark:bg-white/[0.04] border border-slate-200/70 dark:border-white/10 text-slate-700 dark:text-slate-200"
                          >
                            <span className="font-semibold">{sub.name}</span>
                            <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-md bg-indigo-100 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-300">
                              ×{sub.defaultQuantity || 1}
                            </span>
                            {sub.isRequired && (
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" title="Required subpart" />
                            )}
                          </div>
                        ))
                      ) : (
                        <p className="text-[11px] text-slate-400 italic">No subparts configured</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Footer */}
                <div className="px-4 py-2.5 bg-slate-50/50 dark:bg-white/[0.02] border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
                  <span>Selectable in Project Material Assignments</span>
                  <button
                    type="button"
                    onClick={() => handleOpenEditModal(item)}
                    className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                  >
                    <span>Manage</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* ── Pagination Bar ── */}
          {totalItems > 0 && (
            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/60 border border-slate-200/80 dark:border-white/10 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
              {/* Left: Summary */}
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                Showing <span className="font-bold text-slate-900 dark:text-white">{fromItem}</span> to{" "}
                <span className="font-bold text-slate-900 dark:text-white">{toItem}</span> of{" "}
                <span className="font-bold text-slate-900 dark:text-white">{totalItems}</span> equipments
              </p>

              {/* Middle: Page Size Selector */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400 font-medium">Items per page:</span>
                <div className="inline-flex items-center rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50/70 dark:bg-white/[0.03] p-0.5">
                  {[6, 9, 12].map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => {
                        setPageSize(size);
                        setCurrentPage(1);
                      }}
                      className={cn(
                        "px-2.5 py-1 text-xs font-bold rounded-lg transition-all",
                        pageSize === size
                          ? "bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm"
                          : "text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                      )}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              {/* Right: Page Navigation */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safeCurrentPage === 1}
                  className="flex items-center justify-center w-8 h-8 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-500 hover:text-indigo-600 hover:border-indigo-300 dark:hover:border-indigo-500/40 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
                  title="Previous Page"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-1">
                  {getPageNumbers().map((item, idx) => {
                    if (typeof item === "string") {
                      return (
                        <span key={`ellipsis-${idx}`} className="px-1.5 text-slate-400 text-xs font-semibold">
                          ...
                        </span>
                      );
                    }
                    return (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setCurrentPage(item)}
                        className={cn(
                          "w-8 h-8 rounded-xl text-xs font-bold transition-all border",
                          item === safeCurrentPage
                            ? "bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-500/20"
                            : "bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:text-indigo-600 hover:border-indigo-300 dark:hover:border-indigo-500/40 active:scale-95"
                        )}
                      >
                        {item}
                      </button>
                    );
                  })}
                </div>

                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safeCurrentPage === totalPages}
                  className="flex items-center justify-center w-8 h-8 rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-500 hover:text-indigo-600 hover:border-indigo-300 dark:hover:border-indigo-500/40 disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
                  title="Next Page"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Modal: Add / Edit Equipment & Subparts (Mounted via Portal so sidebar gets blurred) ── */}
      {mounted && isModalOpen && typeof document !== "undefined" && createPortal(
        <div 
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsModalOpen(false);
          }}
          className="fixed inset-0 z-[99999] flex items-center justify-center p-4 sm:p-6 md:p-8 bg-slate-950/70 dark:bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
        >
          <div className="bg-white dark:bg-slate-900 w-full max-w-3xl md:max-w-4xl rounded-3xl border border-slate-200/90 dark:border-white/10 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-slate-200/80 dark:border-white/10 flex items-center justify-between bg-slate-50/60 dark:bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 text-white flex items-center justify-center shadow-md shadow-indigo-500/30 shrink-0">
                  <Wrench className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                    {editingItem ? "Edit Equipment & Subparts" : "Add New Survey Equipment"}
                  </h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Define equipment specifications and components that engineers select during project assignment.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-white/10 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveEquipment} className="flex-1 overflow-y-auto p-5 sm:p-7 space-y-5 custom-scrollbar">
              {/* Equipment Name, Code, Category & Description */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5">
                <div className="sm:col-span-3 space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Equipment Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Survey Drone / UAV, Leica TS07 Total Station"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    className="w-full text-xs p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-white/10 focus:outline-none focus:border-indigo-500 font-bold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Model / Code
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. UAV-01, TS-02"
                    value={formCode}
                    onChange={(e) => setFormCode(e.target.value)}
                    className="w-full text-xs p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-white/10 focus:outline-none focus:border-indigo-500 font-semibold"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Category <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full text-xs p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-white/10 focus:outline-none focus:border-indigo-500 font-semibold cursor-pointer"
                  >
                    <option value="Aerial Survey">Aerial Survey</option>
                    <option value="Optical Survey">Optical Survey</option>
                    <option value="GNSS / Satellite">GNSS / Satellite</option>
                    <option value="Accessories">Accessories</option>
                    <option value="Measuring Tools">Measuring Tools</option>
                    <option value="Bathymetry">Bathymetry</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="sm:col-span-3 space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Short Description
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Professional mapping drone for terrain modeling and aerial photogrammetry"
                    value={formDescription}
                    onChange={(e) => setFormDescription(e.target.value)}
                    className="w-full text-xs p-3 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-white/10 focus:outline-none focus:border-indigo-500 font-medium"
                  />
                </div>
              </div>

              {/* Subparts & Accessories Manager */}
              <div className="pt-4 border-t border-slate-200/80 dark:border-white/10 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <label className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                      <Layers className="w-4 h-4 text-indigo-500" />
                      Equipment Subparts & Accessories ({formSubparts.length})
                    </label>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Specify the accessories handed over with this unit (e.g., Drone includes Battery, Charger, Propellers, Controller).
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddSubpartRow}
                    className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition active:scale-95 shrink-0"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add Subpart</span>
                  </button>
                </div>

                {/* Subparts List in 2-column spacious grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto pr-1.5 custom-scrollbar">
                  {formSubparts.map((sub, idx) => (
                    <div
                      key={sub.id}
                      className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-white/10 hover:border-indigo-500/30 transition-all"
                    >
                      <span className="w-5 text-center text-[10px] font-bold text-slate-400 shrink-0">
                        #{idx + 1}
                      </span>

                      {/* Subpart Name */}
                      <input
                        type="text"
                        required
                        placeholder="Subpart name (e.g. Battery, Charger)"
                        value={sub.name}
                        onChange={(e) => handleSubpartChange(idx, "name", e.target.value)}
                        className="flex-1 min-w-0 text-xs p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 focus:outline-none focus:border-indigo-500 font-semibold"
                      />

                      {/* Default Qty */}
                      <div className="flex items-center gap-1 shrink-0">
                        <span className="text-[10px] font-bold uppercase text-slate-400">Qty:</span>
                        <input
                          type="number"
                          min="1"
                          max="99"
                          required
                          value={sub.defaultQuantity}
                          onChange={(e) =>
                            handleSubpartChange(
                              idx,
                              "defaultQuantity",
                              Math.max(1, parseInt(e.target.value) || 1)
                            )
                          }
                          className="w-12 text-xs p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 focus:outline-none focus:border-indigo-500 font-bold text-center"
                        />
                      </div>

                      {/* Required Toggle */}
                      <label className="flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-slate-400 cursor-pointer select-none shrink-0 px-1">
                        <input
                          type="checkbox"
                          checked={sub.isRequired}
                          onChange={(e) => handleSubpartChange(idx, "isRequired", e.target.checked)}
                          className="w-3.5 h-3.5 rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                        />
                        <span className="text-[10px] font-bold">Req</span>
                      </label>

                      {/* Remove Button */}
                      <button
                        type="button"
                        onClick={() => handleRemoveSubpartRow(idx)}
                        disabled={formSubparts.length <= 1}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition disabled:opacity-30 shrink-0"
                        title="Remove Subpart"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Modal Footer */}
              <div className="pt-4 border-t border-slate-200/80 dark:border-white/10 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 text-xs font-semibold rounded-xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="px-6 py-2.5 text-xs font-bold rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md shadow-indigo-500/30 transition active:scale-95 disabled:opacity-50 flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  <span>{editingItem ? "Save Changes" : "Create Equipment"}</span>
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
