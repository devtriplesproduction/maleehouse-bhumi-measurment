"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { 
  X, 
  Plus, 
  Trash2, 
  Edit2, 
  Check, 
  IndianRupee, 
  FileText, 
  Layers, 
  Palette, 
  Sparkles,
  HelpCircle,
  FileCheck2
} from "lucide-react";
import { 
  createPrintDocumentTypeAction, 
  updatePrintDocumentTypeAction, 
  deletePrintDocumentTypeAction,
  type PrintDocumentType 
} from "@/actions/print.actions";
import { Select, SelectItem } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export default function ManageDocTypesModal({
  isOpen,
  onClose,
  initialDocTypes = [],
  onTypesUpdated
}: {
  isOpen: boolean;
  onClose: () => void;
  initialDocTypes: PrintDocumentType[];
  onTypesUpdated: (types: PrintDocumentType[]) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [types, setTypes] = useState<PrintDocumentType[]>(initialDocTypes);
  const [isAdding, setIsAdding] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // New type form
  const [newType, setNewType] = useState({
    name: "",
    description: "",
    base_price: 20,
    suggested_paper: "A4",
    suggested_print_type: "bw"
  });

  // Edit state
  const [editForm, setEditForm] = useState<{ [key: string]: { name: string; base_price: number; suggested_paper: string } }>({});

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    setTypes(initialDocTypes);
  }, [initialDocTypes]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  if (!isOpen || !mounted) return null;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newType.name.trim()) return;

    setLoading(true);
    const res = await createPrintDocumentTypeAction({
      name: newType.name.trim(),
      description: newType.description.trim() || undefined,
      base_price: Number(newType.base_price) || 0,
      suggested_paper: newType.suggested_paper,
      suggested_print_type: newType.suggested_print_type
    });
    setLoading(false);

    if (res.success && res.data) {
      const next = [...types, res.data];
      setTypes(next);
      onTypesUpdated(next);
      setNewType({
        name: "",
        description: "",
        base_price: 20,
        suggested_paper: "A4",
        suggested_print_type: "bw"
      });
      setIsAdding(false);
    } else {
      alert(res.error || "Failed to create document type");
    }
  };

  const handleStartEdit = (t: PrintDocumentType) => {
    setEditingId(t.id);
    setEditForm({
      ...editForm,
      [t.id]: {
        name: t.name,
        base_price: t.base_price,
        suggested_paper: t.suggested_paper || "A4"
      }
    });
  };

  const handleSaveEdit = async (id: string) => {
    const editData = editForm[id];
    if (!editData || !editData.name.trim()) return;

    setLoading(true);
    const res = await updatePrintDocumentTypeAction(id, {
      name: editData.name.trim(),
      base_price: Number(editData.base_price) || 0,
      suggested_paper: editData.suggested_paper
    });
    setLoading(false);

    if (res.success && res.data) {
      const next = types.map(t => t.id === id ? res.data! : t);
      setTypes(next);
      onTypesUpdated(next);
      setEditingId(null);
    } else {
      alert(res.error || "Failed to update");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) return;

    setLoading(true);
    const res = await deletePrintDocumentTypeAction(id);
    setLoading(false);

    if (res.success) {
      const next = types.filter(t => t.id !== id);
      setTypes(next);
      onTypesUpdated(next);
    } else {
      alert(res.error || "Failed to delete");
    }
  };

  return createPortal(
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-md transition-all duration-300 ease-out"
      onClick={onClose}
    >
      <div 
        className="relative bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-white/10 rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-2xl max-h-[88vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Top Accent Gradient Line */}
        <div className="h-1.5 w-full bg-gradient-to-r from-emerald-600 to-emerald-500 shrink-0" />

        {/* Modal Header */}
        <div className="px-6 py-5 border-b border-slate-100 dark:border-white/10 flex justify-between items-center bg-slate-50/70 dark:bg-slate-800/40 shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-emerald-600 to-emerald-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/25 ring-4 ring-emerald-50 dark:ring-emerald-950/40">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                  Document Types & Base Pricing
                </h2>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300">
                  <Sparkles className="w-3 h-3" /> Tariff Master
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Configure document classifications and default base prices
              </p>
            </div>
          </div>
          <button 
            type="button"
            onClick={onClose} 
            className="w-9 h-9 rounded-xl text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800 flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 custom-scrollbar">

          {/* Action to Toggle New Type Form */}
          {!isAdding ? (
            <div className="flex justify-between items-center bg-purple-50/50 dark:bg-purple-950/20 p-3 rounded-2xl border border-purple-200/50">
              <span className="text-xs font-semibold text-purple-900 dark:text-purple-300">
                {types.length} configured document types
              </span>
              <button
                type="button"
                onClick={() => setIsAdding(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                Add New Type
              </button>
            </div>
          ) : (
            /* New Type Form */
            <form onSubmit={handleCreate} className="bg-slate-50 dark:bg-slate-800/60 p-4 rounded-2xl border border-purple-200/80 dark:border-purple-800/40 space-y-3 animate-in fade-in duration-150">
              <div className="flex items-center justify-between pb-1 border-b border-slate-200/60 dark:border-white/10">
                <h4 className="text-xs font-bold uppercase tracking-wider text-purple-900 dark:text-purple-300 flex items-center gap-1.5">
                  <Plus className="w-3.5 h-3.5 text-purple-600" />
                  New Document Type & Tariff
                </h4>
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="text-slate-400 hover:text-slate-600 text-xs font-semibold"
                >
                  Cancel
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                    Document Name *
                  </label>
                  <input
                    required
                    type="text"
                    placeholder="e.g. Cadastral Survey Map"
                    value={newType.name}
                    onChange={e => setNewType({ ...newType, name: e.target.value })}
                    className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-purple-500"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                    Base Price (₹) *
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-emerald-600">₹</span>
                    <input
                      required
                      type="number"
                      min="0"
                      step="0.01"
                      value={newType.base_price}
                      onChange={e => setNewType({ ...newType, base_price: parseFloat(e.target.value) || 0 })}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl pl-7 pr-3 py-2 text-xs font-bold text-emerald-700 dark:text-emerald-400 focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                    Recommended Paper
                  </label>
                  <Select
                    value={newType.suggested_paper}
                    onValueChange={(val) => setNewType({ ...newType, suggested_paper: val })}
                    buttonClassName="h-9 bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    <SelectItem value="A4" label="A4 (Standard)">A4 (Standard)</SelectItem>
                    <SelectItem value="A3" label="A3 (Drawing)">A3 (Drawing)</SelectItem>
                    <SelectItem value="A1" label="A1 (Blueprint)">A1 (Blueprint)</SelectItem>
                    <SelectItem value="A0" label="A0 (Masterplan)">A0 (Masterplan)</SelectItem>
                    <SelectItem value="Custom" label="Custom">Custom</SelectItem>
                  </Select>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                    Default Mode
                  </label>
                  <Select
                    value={newType.suggested_print_type}
                    onValueChange={(val) => setNewType({ ...newType, suggested_print_type: val })}
                    buttonClassName="h-9 bg-white dark:bg-slate-900 border-slate-200 dark:border-white/10 rounded-xl text-xs font-semibold text-slate-700 dark:text-slate-300"
                  >
                    <SelectItem value="bw" label="Black & White">Black & White</SelectItem>
                    <SelectItem value="color" label="Full Color">Full Color</SelectItem>
                  </Select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAdding(false)}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-500 hover:text-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-4 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl text-xs font-bold uppercase tracking-wider hover:from-purple-700 shadow-sm disabled:opacity-50"
                >
                  {loading ? "Saving..." : "Save Type"}
                </button>
              </div>
            </form>
          )}

          {/* List of Configured Document Types */}
          <div className="space-y-2">
            {types.length === 0 ? (
              <div className="p-8 text-center bg-slate-50 dark:bg-slate-800/30 rounded-2xl border border-dashed border-slate-200">
                <p className="text-xs font-semibold text-slate-400">No document types configured yet.</p>
              </div>
            ) : (
              types.map(t => {
                const isEditing = editingId === t.id;
                const currentEdit = editForm[t.id] || { name: t.name, base_price: t.base_price, suggested_paper: t.suggested_paper || "A4" };

                return (
                  <div 
                    key={t.id}
                    className="p-3.5 bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-white/10 rounded-2xl flex items-center justify-between gap-3 hover:border-purple-300 dark:hover:border-purple-700 transition-all shadow-xs"
                  >
                    {isEditing ? (
                      /* Inline Edit Mode */
                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <input
                          type="text"
                          value={currentEdit.name}
                          onChange={e => setEditForm({
                            ...editForm,
                            [t.id]: { ...currentEdit, name: e.target.value }
                          })}
                          className="px-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-purple-400 rounded-xl text-xs font-semibold text-slate-900 dark:text-white"
                        />
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-emerald-600">₹</span>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={currentEdit.base_price}
                            onChange={e => setEditForm({
                              ...editForm,
                              [t.id]: { ...currentEdit, base_price: parseFloat(e.target.value) || 0 }
                            })}
                            className="w-full pl-7 pr-3 py-1.5 bg-slate-50 dark:bg-slate-800 border border-purple-400 rounded-xl text-xs font-bold text-emerald-700 dark:text-emerald-400"
                          />
                        </div>
                        <div className="w-24 shrink-0">
                          <Select
                            value={currentEdit.suggested_paper}
                            onValueChange={(val) => setEditForm({
                              ...editForm,
                              [t.id]: { ...currentEdit, suggested_paper: val }
                            })}
                            buttonClassName="h-8 bg-slate-50 dark:bg-slate-800 border-purple-400 rounded-xl text-xs font-semibold px-2 py-1"
                          >
                            <SelectItem value="A4">A4</SelectItem>
                            <SelectItem value="A3">A3</SelectItem>
                            <SelectItem value="A1">A1</SelectItem>
                            <SelectItem value="A0">A0</SelectItem>
                            <SelectItem value="Custom">Custom</SelectItem>
                          </Select>
                        </div>
                      </div>
                    ) : (
                      /* Normal Display Mode */
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold text-xs border border-purple-200/60 shrink-0">
                          <FileCheck2 className="w-4 h-4" />
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-slate-900 dark:text-white truncate">
                              {t.name}
                            </span>
                            <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10 shrink-0">
                              {t.suggested_paper || "A4"}
                            </span>
                          </div>
                          {t.description && (
                            <p className="text-[11px] text-slate-400 truncate mt-0.5">{t.description}</p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Actions and Base Price */}
                    <div className="flex items-center gap-2 shrink-0">
                      {!isEditing && (
                        <div className="text-right px-3 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200/70">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600/80 block">Base Price</span>
                          <span className="text-sm font-extrabold text-emerald-700 dark:text-emerald-400">
                            ₹{Number(t.base_price).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      )}

                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleSaveEdit(t.id)}
                            className="p-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-xs"
                            title="Save changes"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                            title="Cancel"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleStartEdit(t)}
                            className="p-2 rounded-xl text-slate-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-950/50 transition-colors"
                            title="Edit Base Price & Name"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(t.id, t.name)}
                            className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
                            title="Delete Type"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                  </div>
                );
              })
            )}
          </div>

        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-100 dark:border-white/10 bg-slate-50/80 dark:bg-slate-800/50 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all"
          >
            Done
          </button>
        </div>

      </div>
    </div>,
    document.body
  );
}
