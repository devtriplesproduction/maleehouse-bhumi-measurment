"use client";

import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { 
  Printer, 
  X, 
  User, 
  Phone, 
  FileText, 
  Plus, 
  Minus, 
  Palette, 
  IndianRupee, 
  FolderKanban, 
  Sparkles, 
  Calculator,
  Layers,
  FileCheck2,
  HelpCircle,
  RotateCcw
} from "lucide-react";
import { cn } from "@/lib/utils";

import ManageDocTypesModal from "./ManageDocTypesModal";
import { createPrintJobAction, type PrintDocumentType } from "@/actions/print.actions";
import { Select, SelectItem } from "@/components/ui/select";
import { toast } from "sonner";

// Standard standard rate card per page for print desk
const STANDARD_RATES: Record<string, { bw: number; color: number; label: string; desc: string }> = {
  A4: { bw: 5, color: 15, label: "A4", desc: "Standard Document" },
  A3: { bw: 15, color: 30, label: "A3", desc: "Engineering Drawing" },
  A1: { bw: 60, color: 120, label: "A1", desc: "Cadastral / Blueprint" },
  A0: { bw: 120, color: 250, label: "A0", desc: "Masterplan Plot" },
  Custom: { bw: 10, color: 25, label: "Custom", desc: "Special Format" },
};

export default function NewPrintJobDialog({ 
  isOpen, 
  onClose, 
  projects = [], 
  urlPrefill, 
  initialDocTypes = [],
  onSuccess 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  projects: any[]; 
  urlPrefill?: any; 
  initialDocTypes?: PrintDocumentType[];
  onSuccess: (job: any) => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sourceType, setSourceType] = useState<"walkin" | "project">(
    urlPrefill?.projectId ? "project" : "walkin"
  );

  // Document types & management modal
  const [docTypes, setDocTypes] = useState<PrintDocumentType[]>(initialDocTypes);
  const [selectedDocTypeId, setSelectedDocTypeId] = useState<string>("");
  const [isManageTypesOpen, setIsManageTypesOpen] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (initialDocTypes && initialDocTypes.length > 0) {
      setDocTypes(initialDocTypes);
    }
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

  const [formData, setFormData] = useState({
    client_name: urlPrefill?.clientName || "",
    client_phone: "",
    project_id: urlPrefill?.projectId || "",
    doc_type: "",
    file_name: urlPrefill?.fileName || "",
    copies: 1,
    paper_size: "A4",
    print_type: "bw" as "bw" | "color",
    amount: 5,
    notes: ""
  });

  const [isManualAmount, setIsManualAmount] = useState(false);

  // Sync prefill if dialog is re-opened or prefill updates
  useEffect(() => {
    if (urlPrefill?.projectId || urlPrefill?.clientName) {
      if (urlPrefill.projectId) setSourceType("project");
      setFormData(prev => ({
        ...prev,
        client_name: urlPrefill.clientName || prev.client_name,
        project_id: urlPrefill.projectId || prev.project_id,
        file_name: urlPrefill.fileName || prev.file_name,
      }));
    }
  }, [urlPrefill]);

  // Selected document type object
  const selectedDocType = useMemo(() => {
    return docTypes.find(t => t.id === selectedDocTypeId);
  }, [docTypes, selectedDocTypeId]);

  // Base unit rate: if document type selected, use its base price; otherwise use paper standard rate
  const unitRate = useMemo(() => {
    if (selectedDocType && Number(selectedDocType.base_price) > 0) {
      return Number(selectedDocType.base_price);
    }
    const rateInfo = STANDARD_RATES[formData.paper_size] || STANDARD_RATES["A4"];
    return formData.print_type === "color" ? rateInfo.color : rateInfo.bw;
  }, [selectedDocType, formData.paper_size, formData.print_type]);

  const calculatedTotal = useMemo(() => {
    return unitRate * Math.max(1, formData.copies);
  }, [unitRate, formData.copies]);

  useEffect(() => {
    if (!isManualAmount) {
      setFormData(prev => ({ ...prev, amount: calculatedTotal }));
    }
  }, [calculatedTotal, isManualAmount]);

  const handleDocTypeChange = (typeId: string) => {
    setSelectedDocTypeId(typeId);
    const found = docTypes.find(t => t.id === typeId);
    if (found) {
      setFormData(prev => ({
        ...prev,
        doc_type: found.name,
        paper_size: found.suggested_paper || prev.paper_size,
        print_type: (found.suggested_print_type as any) || prev.print_type,
        file_name: prev.file_name || `${found.name.replace(/\s+/g, '_')}.pdf`,
      }));
      setIsManualAmount(false);
    } else {
      setFormData(prev => ({
        ...prev,
        doc_type: "",
      }));
      setIsManualAmount(false);
    }
  };

  const handleProjectSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const pId = e.target.value;
    const selected = projects.find(p => p.id === pId);
    if (selected) {
      setFormData(prev => ({
        ...prev,
        project_id: selected.id,
        client_name: selected.client_name || selected.name || prev.client_name,
        client_phone: selected.client_contact || prev.client_phone
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        project_id: pId
      }));
    }
  };

  const adjustCopies = (delta: number) => {
    setFormData(prev => {
      const nextVal = Math.max(1, (Number(prev.copies) || 1) + delta);
      return { ...prev, copies: nextVal };
    });
  };

  const handleResetToStandardRate = () => {
    setIsManualAmount(false);
    setFormData(prev => ({ ...prev, amount: calculatedTotal }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await createPrintJobAction({
        client_name: formData.client_name,
        client_phone: formData.client_phone || undefined,
        project_id: sourceType === "project" ? formData.project_id : undefined,
        doc_type: formData.doc_type || selectedDocType?.name || undefined,
        file_name: formData.file_name || undefined,
        copies: Number(formData.copies),
        paper_size: formData.paper_size,
        print_type: formData.print_type,
        amount: Number(formData.amount),
        notes: formData.notes || undefined
      });
      
      if (!res.success) {
        toast.error(res.error || "Failed to create print job");
        return;
      }
      
      toast.success("Print job created successfully");
      onSuccess(res.data);
      onClose();
    } catch (err: any) {
      toast.error(err?.message || "Failed to create print job");
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !mounted) return null;

  return createPortal(
    <>
      <div 
        className="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-md transition-all duration-300 ease-out"
        onClick={onClose}
      >
        <div 
          className="relative bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-white/10 rounded-2xl sm:rounded-3xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
          onClick={e => e.stopPropagation()}
        >
        {/* Top Gradient Accent Line */}
        <div className="h-1.5 w-full bg-gradient-to-r from-emerald-600 to-emerald-500 shrink-0" />

        {/* Modal Header */}
        <div className="px-6 sm:px-8 py-5 border-b border-slate-100 dark:border-white/10 flex justify-between items-center bg-slate-50/70 dark:bg-slate-800/40 shrink-0">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-600 to-emerald-500 flex items-center justify-center text-white shadow-md shadow-emerald-500/25 ring-4 ring-emerald-50 dark:ring-emerald-950/40">
              <Printer className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-white">New Print Job</h2>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300">
                  <Sparkles className="w-3 h-3" /> Desk Intake
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Front-desk walk-in order or survey project printing
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
        
        {/* Scrollable Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 custom-scrollbar">
          
          {/* Source Selector: Walk-in vs Project Linked */}
          <div className="bg-slate-100/80 dark:bg-slate-800/50 p-1 rounded-xl flex gap-1 border border-slate-200/60 dark:border-white/5">
            <button
              type="button"
              onClick={() => setSourceType("walkin")}
              className={cn(
                "flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2",
                sourceType === "walkin"
                  ? "bg-white dark:bg-slate-900 text-purple-700 dark:text-purple-400 shadow-sm border border-slate-200/80 dark:border-white/10"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              )}
            >
              <User className="w-3.5 h-3.5" />
              Walk-in Client
            </button>
            <button
              type="button"
              onClick={() => setSourceType("project")}
              className={cn(
                "flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-2",
                sourceType === "project"
                  ? "bg-white dark:bg-slate-900 text-purple-700 dark:text-purple-400 shadow-sm border border-slate-200/80 dark:border-white/10"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              )}
            >
              <FolderKanban className="w-3.5 h-3.5" />
              Link to Project
            </button>
          </div>

          {/* Project Link Dropdown (if project source selected) */}
          {sourceType === "project" && (
            <div className="space-y-1.5 animate-in fade-in duration-200 bg-purple-50/50 dark:bg-purple-950/20 p-3.5 rounded-xl border border-purple-200/60 dark:border-purple-800/30">
              <label className="text-xs font-bold uppercase tracking-wider text-purple-900 dark:text-purple-300 flex items-center gap-1.5">
                <FolderKanban className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                Select Survey Project *
              </label>
              <Select
                value={formData.project_id}
                onValueChange={(val) => {
                  const selected = projects.find(p => p.id === val);
                  if (selected) {
                    setFormData(prev => ({
                      ...prev,
                      project_id: selected.id,
                      client_name: selected.client_name || selected.name || prev.client_name,
                      client_phone: selected.client_contact || prev.client_phone
                    }));
                  } else {
                    setFormData(prev => ({ ...prev, project_id: val }));
                  }
                }}
                placeholder="-- Choose an active project --"
                buttonClassName="h-10 bg-white dark:bg-slate-900 border-purple-300 dark:border-purple-700/50 rounded-xl text-sm font-medium"
              >
                <SelectItem value="" label="-- Choose an active project --">
                  <span className="text-slate-400">-- Choose an active project --</span>
                </SelectItem>
                {projects.map((p) => (
                  <SelectItem 
                    key={p.id} 
                    value={p.id} 
                    label={`${p.name || p.id}${p.client_name ? ` • ${p.client_name}` : ""}`}
                  >
                    <div className="flex flex-col text-left py-0.5">
                      <span className="font-semibold text-slate-800 dark:text-white">{p.name || p.id}</span>
                      {p.client_name && (
                        <span className="text-xs text-slate-400 font-medium">{p.client_name}</span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </Select>
            </div>
          )}

          {/* Client Info Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                <User className="w-3.5 h-3.5 text-purple-500" /> Client Name *
              </label>
              <div className="relative">
                <input 
                  required 
                  type="text" 
                  value={formData.client_name} 
                  onChange={e => setFormData({ ...formData, client_name: e.target.value })} 
                  className="w-full bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 transition-all placeholder:text-slate-400 placeholder:font-normal" 
                  placeholder="e.g. Ramesh Kumar" 
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                <Phone className="w-3.5 h-3.5 text-purple-500" /> Client Phone
              </label>
              <div className="relative">
                <input 
                  type="text" 
                  inputMode="numeric" 
                  pattern="[0-9]*" 
                  value={formData.client_phone} 
                  onChange={e => {
                    const val = e.target.value.replace(/\D/g, '');
                    setFormData({ ...formData, client_phone: val });
                  }} 
                  className="w-full bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-sm font-semibold text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 transition-all placeholder:text-slate-400 placeholder:font-normal" 
                  placeholder="98765 43210" 
                />
              </div>
            </div>
          </div>

          {/* Document Type & File Name 2-Column Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Document Type Selector */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  <FileCheck2 className="w-3.5 h-3.5 text-purple-500" /> Document / Plan Type
                </label>
                <button
                  type="button"
                  onClick={() => setIsManageTypesOpen(true)}
                  className="text-[11px] font-bold text-purple-600 dark:text-purple-400 hover:text-purple-700 hover:underline flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Manage Types
                </button>
              </div>
              <Select 
                value={selectedDocTypeId}
                onValueChange={(val) => handleDocTypeChange(val)}
                placeholder="-- Standard / Walk-in Document --"
                buttonClassName="h-10 bg-white dark:bg-slate-900/80 border-slate-200 dark:border-white/10 rounded-xl text-sm font-semibold text-slate-900 dark:text-white focus:border-purple-500"
              >
                <SelectItem value="" label="-- Standard / Walk-in Document --">
                  <span className="text-slate-400 font-normal">-- Standard / Walk-in Document --</span>
                </SelectItem>
                {docTypes.map(t => (
                  <SelectItem 
                    key={t.id} 
                    value={t.id} 
                    label={`${t.name} (Base: ₹${t.base_price} • ${t.suggested_paper})`}
                  >
                    <div className="flex items-center justify-between w-full py-0.5">
                      <span className="font-semibold text-slate-900 dark:text-white">{t.name}</span>
                      <span className="text-xs text-purple-600 dark:text-purple-400 font-bold ml-2 shrink-0">
                        ₹{t.base_price} <span className="text-[10px] text-slate-400 font-normal">({t.suggested_paper})</span>
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </Select>
              {selectedDocType && (
                <div className="flex items-center gap-1.5 text-[11px] text-purple-700 dark:text-purple-300 font-medium">
                  <span>Base Tariff:</span>
                  <span className="font-extrabold text-emerald-600 dark:text-emerald-400">
                    ₹{selectedDocType.base_price}
                  </span>
                  <span>•</span>
                  <span className="text-slate-400">{selectedDocType.suggested_paper} {selectedDocType.suggested_print_type?.toUpperCase()}</span>
                </div>
              )}
            </div>

            {/* Document / File Name */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                <FileText className="w-3.5 h-3.5 text-purple-500" /> Document / File Name
              </label>
              <input 
                type="text" 
                value={formData.file_name} 
                onChange={e => setFormData({ ...formData, file_name: e.target.value })} 
                className="w-full bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 transition-all placeholder:text-slate-400 placeholder:font-normal" 
                placeholder="e.g. Survey_Contour_Site_Plan_A3.pdf" 
              />
            </div>
          </div>

          {/* Section: Paper Size Selector Pills */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                <Layers className="w-3.5 h-3.5 text-purple-500" /> Paper Size *
              </label>
              <span className="text-[11px] font-medium text-slate-400">
                {STANDARD_RATES[formData.paper_size]?.desc}
              </span>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {Object.keys(STANDARD_RATES).map((sizeKey) => {
                const item = STANDARD_RATES[sizeKey];
                const isSelected = formData.paper_size === sizeKey;
                return (
                  <button
                    key={sizeKey}
                    type="button"
                    onClick={() => setFormData({ ...formData, paper_size: sizeKey })}
                    className={cn(
                      "py-2.5 px-2 rounded-xl text-center border transition-all duration-150 flex flex-col items-center justify-center",
                      isSelected
                        ? "bg-purple-600 text-white border-purple-600 shadow-md shadow-purple-600/20 ring-2 ring-purple-600/20"
                        : "bg-white dark:bg-slate-800/60 border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 hover:border-purple-300 dark:hover:border-purple-700 hover:bg-purple-50/50"
                    )}
                  >
                    <span className="text-sm font-bold tracking-tight">{item.label}</span>
                    <span className={cn(
                      "text-[10px] mt-0.5",
                      isSelected ? "text-purple-100" : "text-slate-400 dark:text-slate-500"
                    )}>
                      ₹{formData.print_type === "color" ? item.color : item.bw}/ea
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Print Type & Copies & Amount 3-Column Box */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            {/* Print Type Selector */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                <Palette className="w-3.5 h-3.5 text-purple-500" /> Color Mode *
              </label>
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-white/10">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, print_type: "bw" })}
                  className={cn(
                    "py-2 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5",
                    formData.print_type === "bw"
                      ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm border border-slate-200 dark:border-white/10"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  )}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-slate-900 dark:bg-white inline-block" />
                  B&W
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, print_type: "color" })}
                  className={cn(
                    "py-2 px-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5",
                    formData.print_type === "color"
                      ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  )}
                >
                  <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-tr from-amber-400 via-rose-500 to-cyan-400 inline-block" />
                  Color
                </button>
              </div>
            </div>

            {/* Copies Stepper */}
            <div className="space-y-1.5">
              <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                <FileCheck2 className="w-3.5 h-3.5 text-purple-500" /> Copies *
              </label>
              <div className="flex items-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl overflow-hidden focus-within:border-purple-500 focus-within:ring-4 focus-within:ring-purple-500/10">
                <button
                  type="button"
                  onClick={() => adjustCopies(-1)}
                  className="w-10 h-10 flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors active:scale-95"
                >
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <input 
                  required 
                  type="number" 
                  min="1" 
                  value={formData.copies} 
                  onChange={e => setFormData({ ...formData, copies: Math.max(1, parseInt(e.target.value) || 1) })} 
                  className="w-full text-center font-bold text-slate-900 dark:text-white bg-transparent outline-none text-sm" 
                />
                <button
                  type="button"
                  onClick={() => adjustCopies(1)}
                  className="w-10 h-10 flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors active:scale-95"
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Total Amount Input with auto-calc hint */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                  <IndianRupee className="w-3.5 h-3.5 text-emerald-600" /> Amount *
                </label>
                {isManualAmount && (
                  <button
                    type="button"
                    onClick={handleResetToStandardRate}
                    title="Reset to standard tariff"
                    className="text-[10px] text-purple-600 dark:text-purple-400 hover:underline inline-flex items-center gap-0.5 font-semibold"
                  >
                    <RotateCcw className="w-2.5 h-2.5" /> Auto
                  </button>
                )}
              </div>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-bold text-emerald-600 dark:text-emerald-400">
                  ₹
                </span>
                <input 
                  required 
                  type="number" 
                  min="0" 
                  step="0.01" 
                  value={formData.amount} 
                  onChange={e => {
                    setIsManualAmount(true);
                    setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 });
                  }} 
                  className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl pl-8 pr-3.5 py-2 text-sm font-bold text-emerald-700 dark:text-emerald-400 focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all" 
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400">
              Notes & Special Instructions
            </label>
            <textarea 
              value={formData.notes} 
              onChange={e => setFormData({ ...formData, notes: e.target.value })} 
              className="w-full bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-white/10 rounded-xl px-3.5 py-2.5 text-sm font-medium text-slate-900 dark:text-white focus:outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 transition-all placeholder:text-slate-400 placeholder:font-normal resize-none" 
              placeholder="e.g. Spiral binding required, laminated, 120gsm bond paper..." 
              rows={2} 
            />
          </div>

        </form>

        {/* Modal Footer with Summary Banner */}
        <div className="px-6 sm:px-8 py-4.5 border-t border-slate-100 dark:border-white/10 bg-slate-50/80 dark:bg-slate-800/50 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          
          {/* Quick summary pill */}
          <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
            <span className="font-semibold px-2 py-0.5 rounded-md bg-purple-100/70 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200/50">
              {formData.paper_size}
            </span>
            <span>•</span>
            <span className="font-semibold uppercase">
              {formData.print_type === "color" ? "Color" : "B&W"}
            </span>
            <span>•</span>
            <span>{formData.copies} {formData.copies === 1 ? "Copy" : "Copies"}</span>
            <span>•</span>
            <span className="font-bold text-emerald-600 dark:text-emerald-400 text-sm">
              ₹{Number(formData.amount).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
            </span>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button 
              type="button" 
              onClick={onClose} 
              className="px-4 py-2.5 text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-slate-800 rounded-xl transition-all" 
              disabled={loading}
            >
              Cancel
            </button>
            <button 
              type="button"
              onClick={handleSubmit}
              disabled={loading || !formData.client_name.trim()} 
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 active:scale-[0.98] text-white rounded-xl transition-all font-bold text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/25 disabled:opacity-50 disabled:cursor-not-allowed" 
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Creating Job...
                </>
              ) : (
                <>
                  <Printer className="w-4 h-4" />
                  Create Print Job
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>

    {isManageTypesOpen && (
      <ManageDocTypesModal
        isOpen={isManageTypesOpen}
        onClose={() => setIsManageTypesOpen(false)}
        initialDocTypes={docTypes}
        onTypesUpdated={(newTypes) => {
          setDocTypes(newTypes);
          if (newTypes.length > 0) {
            const latest = newTypes[newTypes.length - 1];
            handleDocTypeChange(latest.id);
          }
        }}
      />
    )}
  </>,
  document.body
);
}
