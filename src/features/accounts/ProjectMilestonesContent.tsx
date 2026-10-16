"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useRouter, useSearchParams } from "next/navigation";
import { getMilestonesAction, createMilestonesAction, freezeProjectAction, unfreezeProjectAction } from "@/actions/finance.actions";
import { transitionWorkflowAction } from "@/actions/workflow.actions";
import { getFieldVisitsAction, logFieldVisitAction } from "@/actions/operations.actions";
import {
  Target,
  Search,
  Building,
  Plus,
  X,
  Save,
  Trash2,
  IndianRupee,
  Activity,
  ArrowRight,
  Pause,
  Play,
  MapPin,
  ChevronLeft,
  ChevronRight
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import DashboardLoading from "@/app/(modules)/loading";
import { motion, AnimatePresence } from "framer-motion";
import { PremiumDatePicker } from "@/components/ui/PremiumDatePicker";
import { Select, SelectItem } from "@/components/ui/select";
import { WORKFLOW_STAGES } from "@/components/modules/ProjectWorkflowTab";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const ACTIVE_SURVEY_STATUSES = [
  "payment_pending",
  "payment_done",
  "project_created",
  "data_collection",
  "field_work",
  "data_sync",
  "final_review",
  "completed"
];

// Helper to format currency
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
};

export function ProjectMilestonesContent({ initialProjects }: { initialProjects: any[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectIdParam = searchParams.get("project");
  const planParam = searchParams.get("plan");

  const [projects, setProjects] = useState<any[]>(initialProjects);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;

  // Slide-over State
  const [selectedProject, setSelectedProject] = useState<any | null>(null);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [fieldVisits, setFieldVisits] = useState<any[]>([]);
  const [loadingMilestones, setLoadingMilestones] = useState(false);
  const [saving, setSaving] = useState(false);

  // Tabs in slideover
  const [activeTab, setActiveTab] = useState<"milestones" | "visits">("milestones");
  const [newVisitDate, setNewVisitDate] = useState<Date | undefined>(undefined);
  const [newVisitPrice, setNewVisitPrice] = useState<string>("");
  const [mounted, setMounted] = useState(false);

  const [projectToHold, setProjectToHold] = useState<any | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);
  
  // Sync when initialProjects update from server
  useEffect(() => {
    setProjects(initialProjects);
  }, [initialProjects]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery]);

  const hasAutoOpenedRef = React.useRef<string | null>(null);

  // Auto-open panel based on query parameter
  useEffect(() => {
    if (projectIdParam && projects.length > 0) {
      if (hasAutoOpenedRef.current === projectIdParam) return;
      const project = projects.find((p: any) => p.id === projectIdParam);
      if (project) {
        hasAutoOpenedRef.current = projectIdParam;
        handleOpenPanel(project);
      }
    }
  }, [projectIdParam, projects]);

  const handleOpenPanel = async (project: any) => {
    setSelectedProject(project);
    setLoadingMilestones(true);
    setMilestones([]);
    setFieldVisits([]);
    setActiveTab("milestones");

    try {
      const [msRes, visitsRes] = await Promise.all([
        getMilestonesAction(project.id),
        getFieldVisitsAction(project.id)
      ]);

      if (msRes?.success && msRes.data) {
        const loadedMilestones = msRes.data.map((m: any) => {
          const qTotal = project.contract_value || 0;
          if (qTotal > 0 && m.amount) {
            m.percentage = ((Number(m.amount) / qTotal) * 100).toFixed(2);
            // strip trailing '.00' if it's a whole number for cleaner UI
            if (m.percentage.endsWith('.00')) {
              m.percentage = m.percentage.slice(0, -3);
            }
          } else {
            m.percentage = "";
          }
          return m;
        });

        // Sort milestones by due date
        loadedMilestones.sort((a: any, b: any) => {
          if (!a.due_date && !b.due_date) return 0;
          if (!a.due_date) return 1;
          if (!b.due_date) return -1;
          return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
        });

        setMilestones(loadedMilestones);
      } else {
        console.error("Milestones fetch failed:", msRes);
        toast.error("Could not fetch existing milestones: " + (msRes?.error || "Unknown error"));
      }

      if (visitsRes?.success && visitsRes.data) {
        setFieldVisits(visitsRes.data);
      }
    } catch(err) {
      toast.error("Unexpected error loading data.");
    } finally {
      setLoadingMilestones(false);
    }
  };

  const closePanel = () => {
    setSelectedProject(null);
    setMilestones([]);
    setFieldVisits([]);
    setNewVisitDate(undefined);
    setNewVisitPrice("");
    if (projectIdParam) {
      router.replace("/accounts/milestones");
    }
    hasAutoOpenedRef.current = null;
  };

  const addMilestoneRow = () => {
    setMilestones([
      ...milestones,
      {
        id: `temp-${Date.now()}`,
        title: "",
        amount: 0,
        percentage: "",
        due_date: "",
        is_activation_gate: false,
        linked_stage: milestones.length === 0 ? "data_collection" : ""
      }
    ]);
  };

  const removeMilestone = (index: number) => {
    const updated = [...milestones];
    updated.splice(index, 1);
    setMilestones(updated);
  };

  const updateMilestone = (index: number, field: string, value: any) => {
    const updated = [...milestones];
    let m = { ...updated[index], [field]: value };
    
    const qTotal = selectedProject?.contract_value ? Number(selectedProject.contract_value) : 0;
    
    if (field === 'percentage' && qTotal > 0 && value !== "") {
      const pct = parseFloat(value);
      if (!isNaN(pct)) {
        m.amount = (qTotal * (pct / 100)).toFixed(2);
      }
    } else if (field === 'amount' && qTotal > 0 && value !== "") {
      const amt = parseFloat(value);
      if (!isNaN(amt)) {
        m.percentage = ((amt / qTotal) * 100).toFixed(2);
      }
    }

    updated[index] = m;
    setMilestones(updated);
  };

  const handleSaveMilestones = async () => {
    if (!selectedProject) return;

    // Validate
    let previousDate: Date | null = null;
    for (let i = 0; i < milestones.length; i++) {
      const m = milestones[i];
      if (!m.title.trim()) {
        toast.error("All milestones must have a title.");
        return;
      }
      if (Number(m.amount) < 0) {
        toast.error("Milestone amounts cannot be negative.");
        return;
      }
      if (!m.due_date) {
        toast.error(`Milestone "${m.title || `Row ${i + 1}`}" is missing a due date.`);
        return;
      }

      const currentDate = new Date(m.due_date);
      if (previousDate && currentDate < previousDate) {
        toast.error(`Due date for milestone "${m.title || `Row ${i + 1}`}" cannot be earlier than the previous milestone's date.`);
        return;
      }
      previousDate = currentDate;
    }

    const qTotal = selectedProject?.contract_value ? Number(selectedProject.contract_value) : 0;
    const totalAmount = milestones.reduce((acc: number, curr: any) => acc + (Number(curr.amount) || 0), 0);
    const totalPercentage = milestones.reduce((acc: number, curr: any) => acc + (Number(curr.percentage) || 0), 0);

    if (qTotal > 0) {
      // Adding a small margin (0.1) to account for JavaScript floating point precision issues
      if (totalAmount > qTotal + 0.1) {
        toast.error("Total milestone amount cannot exceed the project commercial amount.");
        return;
      }
      if (totalPercentage > 100.01) {
        toast.error("Total milestone percentage cannot exceed 100%.");
        return;
      }
    }

    try {
      setSaving(true);

      // If user filled the visit fields but clicked Save Configuration instead of Schedule, save it automatically
      if (newVisitDate) {
        const priceVal = newVisitPrice ? Number(newVisitPrice) : 0;
        const visitRes = await logFieldVisitAction(
          selectedProject.id,
          newVisitDate.toISOString(),
          "Scheduled from Milestones Portal",
          priceVal
        );
        if (visitRes?.success) {
          toast.success("Field visit scheduled.");
        } else {
          toast.error(visitRes?.error || "Failed to schedule field visit.");
        }
      }

      const payload = milestones.map((m: any) => ({
        id: m.id || undefined,
        title: m.title,
        description: m.description || "",
        amount: Number(m.amount) || 0,
        due_date: m.due_date || undefined,
        linked_stage: m.linked_stage || undefined,
        is_activation_gate: Boolean(m.is_activation_gate)
      }));

      const res = await createMilestonesAction(selectedProject.id, payload);

      if (res?.success) {
        toast.success("Milestones saved successfully.");

        if (planParam === "true") {
          toast.info("Awaiting payment. Project set to Payment Pending stage.");
          const dispatchRes = await transitionWorkflowAction(
            selectedProject.id,
            "payment_pending",
            "Milestones configured. Project awaiting initial milestone payment."
          );
          if (dispatchRes?.success) {
            toast.success("Project set to Payment Pending.");
            setTimeout(() => {
              router.push("/accounts/billing");
              router.refresh();
            }, 1000);
          } else {
            toast.error(dispatchRes?.error || "Failed to update project status.");
          }
        } else {
          // Fetch the updated milestones immediately to show them in the panel
          handleOpenPanel(selectedProject);
        }

        // Server Action's revalidatePath automatically invalidates server cache.
      } else {
        const errorMsg = res?.error || "Failed to save milestones.";
        toast.error(errorMsg);
        alert(errorMsg); // Fallback to ensure the message is seen
      }
    } catch(err) {
      toast.error("An unexpected error occurred.");
      alert("An unexpected error occurred.");
    } finally {
      setSaving(false);
    }
  };

  const handleHoldProject = (e: React.MouseEvent, project: any) => {
    e.stopPropagation();
    setProjectToHold(project);
  };

  const confirmHoldProject = async () => {
    if (!projectToHold) return;
    const isCurrentlyHeld = projectToHold.status === "on_hold" || projectToHold.is_frozen;

    try {
      if (isCurrentlyHeld) {
        if (projectToHold.is_frozen) {
          const res = await unfreezeProjectAction(projectToHold.id, "Resumed from Accountant Portal");
          if (!res?.success) { toast.error(res?.error || "Failed to unfreeze."); return; }
        }
        if (projectToHold.status === "on_hold") {
          const res = await transitionWorkflowAction(projectToHold.id, "project_created", "Resumed from Accountant Portal");
          if (!res?.success) { toast.error(res?.error || "Failed to transition workflow."); return; }
        }
        toast.success("Project resumed successfully.");
      } else {
        const res = await freezeProjectAction(projectToHold.id, "financial_hold", "Put on hold from Accountant Portal");
        if (res?.success) {
          toast.success("Project put on hold.");
        } else {
          toast.error(res?.error || "Failed to put project on hold.");
          return;
        }
      }
      
      // Optimistically update local project state
      setProjects(prev => prev.map(p => {
        if (p.id === projectToHold.id) {
          if (isCurrentlyHeld) {
             return { ...p, status: projectToHold.is_frozen ? p.status : "active", is_frozen: false }; 
          } else {
             return { ...p, is_frozen: true };
          }
        }
        return p;
      }));
    } catch (err: any) {
      toast.error(err.message || "Unexpected error.");
    } finally {
      setProjectToHold(null);
    }
  };

  const handleScheduleVisit = async () => {
    if (!newVisitDate || !selectedProject) return;
    try {
      const priceVal = newVisitPrice ? Number(newVisitPrice) : 0;
      const res = await logFieldVisitAction(
        selectedProject.id,
        newVisitDate.toISOString(),
        "Scheduled from Milestones Portal",
        priceVal
      );
      if (res?.success && res.data) {
        toast.success("Field visit scheduled.");
        setFieldVisits([...fieldVisits, res.data]);
        setNewVisitDate(undefined);
        setNewVisitPrice("");
      } else {
        toast.error("Failed to schedule: " + (res?.error || "Unknown error."));
      }
    } catch (err: any) {
      toast.error("Unexpected error: " + (err.message || String(err)));
    }
  };

  if (loading) return <DashboardLoading />;

  const filteredProjects = projects.filter((p) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      p.name?.toLowerCase().includes(q) ||
      p.client_name?.toLowerCase().includes(q) ||
      p.id?.toLowerCase().includes(q)
    );
  });

  const totalPages = Math.max(1, Math.ceil(filteredProjects.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedProjects = filteredProjects.slice((safeCurrentPage - 1) * PAGE_SIZE, safeCurrentPage * PAGE_SIZE);

  return (
    <div className="space-y-8 pb-20 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200/60 dark:border-white/5 pb-6">
        <div className="space-y-1.5">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
            Project <span className="text-indigo-600 dark:text-indigo-400">Milestones</span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Manage custom payment milestones for all active projects dispatched to survey operations.
          </p>
        </div>

        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by project name or client..."
            className="w-full pl-9 pr-4 h-10 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-xs outline-none focus:bg-white dark:focus:bg-slate-950 focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all text-slate-900 dark:text-white placeholder:text-slate-400"
          />
        </div>
      </div>

      {filteredProjects.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 border border-dashed border-slate-200 dark:border-white/10 rounded-2xl bg-white/30 dark:bg-white/[0.01]">
          <Target className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-3" />
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
            No active survey projects found.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <AnimatePresence mode="popLayout">
              {paginatedProjects.map((p) => (
              <motion.div
                key={p.id}
                layout
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="bg-white dark:bg-white/[0.02] border border-slate-200/60 dark:border-white/5 rounded-2xl p-6 shadow-sm hover:shadow-md transition-all duration-300 relative group overflow-hidden"
              >
                <div className="flex flex-col h-full justify-between gap-6">

                  {/* Top Section */}
                  <div className="flex items-start gap-4 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20 flex items-center justify-center flex-shrink-0 text-indigo-600 dark:text-indigo-400">
                      <Target className="w-5 h-5" />
                    </div>
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <h3 className="text-base font-semibold text-slate-900 dark:text-white truncate">
                        {p.name}
                      </h3>
                      <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 font-medium flex-wrap">
                        <span className="flex items-center gap-1.5 bg-slate-100 dark:bg-white/5 px-2 py-0.5 rounded-md text-slate-700 dark:text-slate-300">
                          <Building className="w-3.5 h-3.5 text-slate-400" />
                          {p.client_name || "Direct Client"}
                        </span>
                        <span className="flex items-center gap-1.5 min-w-0">
                          <Activity className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                          <span className="truncate">Stage:</span> <span className="text-indigo-600 dark:text-indigo-400 uppercase tracking-widest text-[9px] font-bold bg-indigo-50 dark:bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-100 dark:border-indigo-500/20 whitespace-nowrap">{p.status.replace(/_/g, ' ')}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Middle Section (Financials) */}
                  <div className="grid grid-cols-3 gap-4 bg-slate-50 dark:bg-white/[0.02] rounded-xl p-4 border border-slate-100 dark:border-white/5">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Total Amount</p>
                      <p className="text-base font-bold text-slate-900 dark:text-white nums truncate">
                        {formatCurrency(p.contract_value || 0)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Received</p>
                      <p className="text-base font-bold text-emerald-600 dark:text-emerald-400 nums truncate">
                        {formatCurrency(p.received_amount || 0)}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Pending</p>
                      <p className="text-base font-bold text-rose-600 dark:text-rose-400 nums truncate">
                        {formatCurrency(p.pending_amount || 0)}
                      </p>
                    </div>
                  </div>

                  {/* Bottom Action Row */}
                  <div className="flex items-center gap-3 mt-auto pt-2">
                    <button
                      onClick={() => handleOpenPanel(p)}
                      className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-sm transition-all flex items-center justify-center gap-2 active:scale-95"
                    >
                      <span>Manage</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => handleHoldProject(e, p)}
                      className="px-4 py-2.5 rounded-xl bg-amber-50 text-amber-700 hover:bg-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:hover:bg-amber-500/20 border border-amber-200/50 dark:border-amber-500/20 text-xs font-semibold shadow-sm transition-all flex items-center justify-center gap-2 active:scale-95 flex-shrink-0"
                    >
                      {p.status === "on_hold" || p.is_frozen ? (
                        <>
                          <Play className="w-3.5 h-3.5" />
                          Resume
                        </>
                      ) : (
                        <>
                          <Pause className="w-3.5 h-3.5" />
                          Hold
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              Showing {(safeCurrentPage - 1) * PAGE_SIZE + 1}–{Math.min(safeCurrentPage * PAGE_SIZE, filteredProjects.length)} of {filteredProjects.length}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safeCurrentPage === 1}
                className="flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-500 hover:text-indigo-600 hover:border-indigo-300 dark:hover:border-indigo-500/40 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`w-8 h-8 rounded-lg text-xs font-semibold transition-all border ${page === safeCurrentPage
                      ? "bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-500/20"
                      : "bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-500 hover:text-indigo-600 hover:border-indigo-300 dark:hover:border-indigo-500/40"
                    }`}
                >
                  {page}
                </button>
              ))}

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safeCurrentPage === totalPages}
                className="flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-500 hover:text-indigo-600 hover:border-indigo-300 dark:hover:border-indigo-500/40 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
      )}

      {/* Modal card */}
      {mounted && typeof document !== "undefined" && createPortal(
        <AnimatePresence>
          {selectedProject && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-slate-900/50 dark:bg-black/70 backdrop-blur-xl z-[100]"
                onClick={closePanel}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 20 }}
                transition={{ type: "spring", damping: 28, stiffness: 280 }}
                className="fixed inset-0 z-[9999] flex items-center justify-center p-4 pointer-events-none"
              >
                <div
                  className="pointer-events-auto w-full max-w-2xl max-h-[90vh] bg-white dark:bg-[#0f121b] rounded-2xl shadow-2xl border border-slate-200 dark:border-white/10 flex flex-col overflow-hidden"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-between p-6 border-b border-slate-200/60 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.01]">
                    <div>
                      <h2 className="text-lg font-bold text-slate-900 dark:text-white">Milestone Configuration</h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-1">{selectedProject.name}</p>
                    </div>
                    <button
                      onClick={closePanel}
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-200 dark:hover:bg-white/10 text-slate-500 transition-colors"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Tabs Header */}
                  <div className="flex items-center gap-6 px-6 border-b border-slate-200/60 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.01] overflow-x-auto scrollbar-hide pt-2">
                    <button
                      onClick={() => setActiveTab("milestones")}
                      className={cn(
                        "pb-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2",
                        activeTab === "milestones"
                          ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400"
                          : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                      )}
                    >
                      <Target className="w-4 h-4" />
                      Payment Milestones
                    </button>
                    <button
                      onClick={() => setActiveTab("visits")}
                      className={cn(
                        "pb-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2",
                        activeTab === "visits"
                          ? "border-indigo-600 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400"
                          : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                      )}
                    >
                      <MapPin className="w-4 h-4" />
                      Field Visits
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto scrollbar-hide p-6 space-y-6 bg-slate-50/30 dark:bg-transparent">
                    {loadingMilestones ? (
                      <div className="flex flex-col items-center justify-center h-40">
                        <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
                        <p className="text-xs font-medium text-slate-500 mt-3">Loading milestones...</p>
                      </div>
                    ) : activeTab === "milestones" ? (
                      <>
                        <div className="flex items-center justify-between">
                          <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                            <Target className="w-4 h-4 text-indigo-500" />
                            Payment Milestones
                          </h3>
                          <button
                            onClick={addMilestoneRow}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-bold hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Add Milestone
                          </button>
                        </div>

                        {milestones.length === 0 ? (
                          <div className="text-center py-10 border border-dashed border-slate-200 dark:border-white/10 rounded-xl bg-white dark:bg-white/[0.02]">
                            <p className="text-xs text-slate-500 dark:text-slate-400">No milestones configured yet.</p>
                          </div>
                        ) : (
                          <div className="space-y-4 pb-36">
                            <AnimatePresence mode="popLayout">
                              {milestones.map((m, idx) => (
                                <motion.div
                                  key={m.id || idx}
                                  layout
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, scale: 0.95 }}
                                  className="bg-white dark:bg-[#151923] border border-slate-200 dark:border-white/10 rounded-xl p-5 shadow-sm relative group"
                                >
                                  <button
                                    onClick={() => removeMilestone(idx)}
                                    className="absolute top-3 right-3 p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-lg transition-colors"
                                    title="Remove Milestone"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>

                                  <div className="space-y-4 pr-6">
                                    <div>
                                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">Milestone Title</label>
                                      <input
                                        type="text"
                                        value={m.title}
                                        onChange={(e) => updateMilestone(idx, 'title', e.target.value)}
                                        placeholder="e.g. 50% Advance Payment"
                                        className="w-full h-9 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg px-3 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 outline-none"
                                      />
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                      <div>
                                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">Percentage (%)</label>
                                        <input
                                          type="number"
                                          min="0"
                                          onKeyDown={(e) => {
                                            if (e.key === '-') e.preventDefault();
                                          }}
                                          value={m.percentage || ""}
                                          onChange={(e) => updateMilestone(idx, 'percentage', e.target.value)}
                                          placeholder="%"
                                          className="w-full h-9 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg px-3 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 outline-none nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                        />
                                      </div>
                                      <div>
                                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">Amount (₹)</label>
                                        <div className="relative">
                                          <IndianRupee className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                          <input
                                            type="number"
                                            min="0"
                                            onKeyDown={(e) => {
                                              if (e.key === '-') e.preventDefault();
                                            }}
                                            value={m.amount}
                                            onChange={(e) => updateMilestone(idx, 'amount', e.target.value)}
                                            className="w-full h-9 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg pl-8 pr-3 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 outline-none nums [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                          />
                                        </div>
                                      </div>
                                      <div>
                                        <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">Due Date</label>
                                        <PremiumDatePicker
                                          value={m.due_date?.split('T')[0] || ""}
                                          onChange={(date) => updateMilestone(idx, 'due_date', date)}
                                          side="left"
                                          triggerClassName="h-9 rounded-lg bg-slate-50 dark:bg-white/5 text-xs"
                                          minDate={idx > 0 && milestones[idx - 1].due_date ? milestones[idx - 1].due_date : undefined}
                                        />
                                      </div>
                                    </div>

                                    <div>
                                      <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">Linked Workflow Stage (Optional)</label>
                                      <Select
                                        value={m.linked_stage || ""}
                                        onValueChange={(val) => updateMilestone(idx, 'linked_stage', val)}
                                        placeholder="-- No linked stage --"
                                        buttonClassName="h-9 w-full bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10 rounded-lg px-3 text-xs text-slate-900 dark:text-white"
                                      >
                                        <SelectItem value="" className="text-xs py-2">-- No linked stage --</SelectItem>
                                        
                                        {fieldVisits.length > 0 && (
                                          <div className="px-3 py-1.5 mt-1 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Field Visits</div>
                                        )}
                                        {fieldVisits.map((v, vIdx) => (
                                          <SelectItem key={v.id} value={`visit:${v.id}`} className="text-xs py-2">
                                            Visit #{vIdx + 1} ({format(new Date(v.visit_date), "MMM d, yyyy")})
                                          </SelectItem>
                                        ))}

                                        <div className="px-3 py-1.5 mt-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider border-t border-slate-100 dark:border-white/5 pt-2">Workflow Stages</div>
                                        {WORKFLOW_STAGES.map((stg) => (
                                          <SelectItem key={stg.statusKey} value={stg.statusKey} className="text-xs py-2">
                                            {stg.id}. {stg.label} ({stg.responsibleLabel})
                                          </SelectItem>
                                        ))}
                                        {m.linked_stage && !WORKFLOW_STAGES.some((s) => s.statusKey === m.linked_stage) && !m.linked_stage.startsWith("visit:") && (
                                          <SelectItem value={m.linked_stage} className="text-xs py-2 text-amber-500">
                                            {m.linked_stage} (Legacy)
                                          </SelectItem>
                                        )}
                                      </Select>
                                    </div>


                                  </div>
                                </motion.div>
                              ))}
                            </AnimatePresence>
                          </div>
                        )}
                      </>
                    ) : (
                      // FIELD VISITS TAB
                      <>
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-indigo-500" />
                            Scheduled Visits
                          </h3>
                        </div>

                        <div className="bg-white dark:bg-[#151923] border border-slate-200 dark:border-white/10 rounded-xl p-5 shadow-sm mb-6">
                          <h4 className="text-xs font-bold text-slate-900 dark:text-white mb-3">Schedule New Visit</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                            <div>
                              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">Visit Date</label>
                              <PremiumDatePicker
                                value={newVisitDate ? format(newVisitDate, "yyyy-MM-dd") : ""}
                                onChange={(dateStr) => setNewVisitDate(dateStr ? new Date(dateStr) : undefined)}
                                side="right"
                                triggerClassName="h-9 rounded-lg bg-slate-50 dark:bg-white/5 text-xs"
                              />
                            </div>
                            <div>
                              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5 block">Visit Price (₹, Optional)</label>
                              <div className="relative">
                                <IndianRupee className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                <input
                                  type="number"
                                  value={newVisitPrice}
                                  onChange={(e) => setNewVisitPrice(e.target.value)}
                                  placeholder="e.g. 5000"
                                  className="w-full h-9 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg pl-8 pr-3 text-xs text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 outline-none nums"
                                />
                              </div>
                            </div>
                          </div>
                          <button
                            onClick={handleScheduleVisit}
                            disabled={!newVisitDate}
                            className="w-full py-2.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm active:scale-95"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Schedule Field Visit
                          </button>
                        </div>

                        {fieldVisits.length === 0 ? (
                          <div className="text-center py-10 border border-dashed border-slate-200 dark:border-white/10 rounded-xl bg-white dark:bg-white/[0.02]">
                            <p className="text-xs text-slate-500 dark:text-slate-400">No field visits logged yet.</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {fieldVisits.map((v, vIdx) => (
                              <div key={v.id} className="flex items-center justify-between p-4 bg-white dark:bg-[#151923] border border-slate-200 dark:border-white/10 rounded-xl">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-[10px]">
                                    #{vIdx + 1}
                                  </div>
                                  <div>
                                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                                      {format(new Date(v.visit_date), "MMMM d, yyyy")}
                                    </p>
                                    <div className="flex items-center gap-2 mt-0.5 text-[10px] font-medium text-slate-500 uppercase tracking-wider font-semibold">
                                      <span>Status: {v.status.replace(/_/g, " ")}</span>
                                      {v.price > 0 && (
                                        <>
                                          <span>•</span>
                                          <span className="text-indigo-600 dark:text-indigo-400 font-bold">Price: {formatCurrency(v.price)}</span>
                                        </>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  <div className="p-6 border-t border-slate-200/60 dark:border-white/5 bg-white dark:bg-[#0f121b] flex items-center justify-between">
                    <div className="text-xs font-semibold text-slate-500">
                      Total Milestones: <span className="text-slate-900 dark:text-white nums">{milestones.length}</span>
                    </div>
                    <div className="flex gap-3">
                      <button
                        onClick={closePanel}
                        className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-50 dark:hover:bg-white/5 text-slate-600 dark:text-slate-300 text-xs font-bold transition-all"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSaveMilestones}
                        disabled={saving || loadingMilestones}
                        className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
                      >
                        {saving ? (
                          <>
                            <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Saving...
                          </>
                        ) : (
                          <>
                            <Save className="w-4 h-4" />
                            Save Configuration
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body
      )}

      <AlertDialog open={!!projectToHold} onOpenChange={(open) => !open && setProjectToHold(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {projectToHold?.status === "on_hold" || projectToHold?.is_frozen ? "Resume Project" : "Put Project on Hold"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {projectToHold?.status === "on_hold" || projectToHold?.is_frozen
                ? `Are you sure you want to resume "${projectToHold?.name}"?`
                : `Are you sure you want to put "${projectToHold?.name}" on hold?`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmHoldProject}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
