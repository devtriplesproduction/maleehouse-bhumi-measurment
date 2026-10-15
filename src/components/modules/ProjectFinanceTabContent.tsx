"use client";

import React, { useState } from "react";
import {
  DollarSign,
  UserPlus,
  Lock,
  Plus,
  FileText,
  TrendingUp,
  TrendingDown,
  Award,
  Loader2,
  Edit2,
  Trash2,
} from "lucide-react";
import { CreateInvoiceModal } from "@/features/accounts/CreateInvoiceModal";
import { LogPaymentModal } from "@/features/accounts/LogPaymentModal";
import { ExpenseEntryModal } from "@/features/accounts/ExpenseEntryModal";
import {
  assignAccountantAction,
  createMilestonesAction,
  freezeProjectAction,
  unfreezeProjectAction,
  updateProjectBudgetAction,
} from "@/actions/finance.actions";
import { deleteExpenseAction } from "@/actions/expense.actions";
import { createInvoiceAction } from "@/actions/finance.actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface Milestone {
  id: string;
  title: string;
  description?: string;
  amount: number;
  due_date?: string;
  linked_stage?: string;
  is_activation_gate: boolean;
  status:
  | "pending"
  | "invoice_generated"
  | "payment_verification_pending"
  | "paid"
  | "overdue";
}

interface Visit {
  id: string;
  visit_date: string;
  scheduled_date?: string;
  created_at?: string;
  completed_at?: string;
  status:
  | "scheduled"
  | "completed"
  | "invoice_generated"
  | "paid"
  | "cancelled";
  reported_by: string;
  description?: string;
  purpose?: string;
  is_billable?: boolean;
  visit_cost?: number;
}

interface ProjectFinanceTabContentProps {
  projectId: string;
  project: any;
  milestones: Milestone[];
  visits: Visit[];
  accountantOwner: any;
  role: string;
  theme: any;
  activityLogs?: any[];
  onRefresh?: () => void;
  profile?: any;
  projectExpenses?: any[];
}

// Mock Accountant list for assignment in Local JSON DB mode
const MOCK_ACCOUNTANTS = [
  {
    id: "ba635e03-0a19-4267-b5d8-bfa422aeb250",
    name: "Rohan Sharma",
    email: "rohan.sharma@maleehouse.in",
  },
  {
    id: "ac01b2cd-3e4f-5a6b-7c8d-9e0f1a2b3c4d",
    name: "Priya Iyer",
    email: "priya.iyer@maleehouse.in",
  },
  {
    id: "ba742e03-0a20-4389-c6e8-bfa533aeb360",
    name: "Vikram Malhotra",
    email: "vikram.m@maleehouse.in",
  },
];

const STAGE_LABELS: Record<string, string> = {
  lead_created: "Lead Created",
  payment_pending: "Payment Pending",
  payment_done: "Payment Done",
  project_created: "Project Created",
  data_collection: "Data Collection",
  prototype: "Technical Drafting",
  review: "Technical Review",
  field_work: "Field Work",
  data_sync: "Data Sync",
  final_review: "QC Review",
  completed: "Completed",
  archived: "Archived",
};

export function ProjectFinanceTabContent({
  projectId,
  project,
  milestones,
  visits,
  accountantOwner,
  role,
  theme,
  activityLogs = [],
  onRefresh,
  profile,
  projectExpenses = [],
}: ProjectFinanceTabContentProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Assignment State
  const [selectedAccountant, setSelectedAccountant] = useState(
    accountantOwner?.accountant_id || "",
  );

  // Milestone Form State
  const [showMilestoneForm, setShowMilestoneForm] = useState(false);
  const [milestoneItems, setMilestoneItems] = useState([
    {
      title: "Advance Staking Payment",
      description: "50% initial mobilization fee",
      percentage: "50",
      amount: "",
      due_date: "",
      linked_stage: "project_created",
      is_activation_gate: true,
    },
  ]);

  // Freeze Modal State
  const [showFreezeModal, setShowFreezeModal] = useState(false);
  const [freezeReason, setFreezeReason] = useState<"payment_pending" | "financial_hold" | "client_issue" | "approval_issue" | "manual_admin_hold">("payment_pending");
  const [freezeComment, setFreezeComment] = useState("");
  const [invoiceModalType, setInvoiceModalType] = useState("milestone");
  const [invoiceContext, setInvoiceContext] = useState<any>(null);
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [expenseModalOpen, setExpenseModalOpen] = useState(false);
  const [expenseCategory, setExpenseCategory] = useState<'labor' | 'material' | 'travel' | 'overhead' | 'other'>('labor');
  const [editingExpense, setEditingExpense] = useState<any>(null);
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [budgetInput, setBudgetInput] = useState(project.budget || 0);
  const [selectedPaymentMilestone, setSelectedPaymentMilestone] = useState<any>(null);
  const [expenseInvoiceModalOpen, setExpenseInvoiceModalOpen] = useState(false);
  const [selectedExpenseForInvoice, setSelectedExpenseForInvoice] = useState<any>(null);
  const [selectedVisitForInvoice, setSelectedVisitForInvoice] = useState<any>(null);
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<Set<string>>(new Set());

  const expenses = projectExpenses;
  const loadingExpenses = false;

  const isAdmin = role === "admin";
  const isAccountant = role === "accountant" || role === "admin";

  // Indian currency formatting helper (en-IN)
  const formatRupee = (value: number) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(value);
  };

  // Calculate Total Billed using Project Budget and Billable Field Visits
  const projectTotal = Number(project?.budget || 0);
  const visitsTotal = visits.filter(v => v.is_billable).reduce((sum, v) => sum + Number(v.visit_cost || 0), 0);
  const totalBilled = projectTotal + visitsTotal;

  const totalPaid = milestones
    .filter((m) => m.status === "paid")
    .reduce((sum, m) => sum + (m.amount || 0), 0);
  const totalExpenses = expenses.reduce(
    (sum, exp) => sum + (exp.amount || 0),
    0,
  ) + visits.reduce((sum, v) => sum + Number(v.visit_cost || 0), 0);
  const currentProfit = totalBilled - totalExpenses;

  // 1. Accountant Assignment Submit
  const handleAssignAccountant = async () => {
    if (!selectedAccountant) {
      toast.error("Selection Required", {
        description: "Please select an accountant.",
      });
      return;
    }
    setIsSubmitting(true);
    try {
      const res = await assignAccountantAction(projectId, selectedAccountant);
      if (res?.success) {
        toast.success("Accountant Assigned", {
          description: "Ownership successfully updated.",
        });
      } else {
        toast.error("Assignment Failed", { description: res?.error });
      }
    } catch (err: any) {
      toast.error("Unexpected Error", { description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Milestone Creation Submit
  const handleAddMilestoneItem = () => {
    setMilestoneItems([
      ...milestoneItems,
      {
        title: "",
        description: "",
        percentage: "",
        amount: "",
        due_date: "",
        linked_stage: "",
        is_activation_gate: false,
      },
    ]);
  };

  const handleRemoveMilestoneItem = (idx: number) => {
    setMilestoneItems(milestoneItems.filter((_, i) => i !== idx));
  };

  const handleMilestoneFieldChange = (idx: number, field: string, val: any) => {
    const updated = [...milestoneItems];
    let item = { ...updated[idx], [field]: val };

    const budgetTotal = Number(project?.budget || 0);

    if (field === 'percentage' && budgetTotal > 0 && val !== "") {
      const pct = parseFloat(val);
      if (!isNaN(pct)) {
        item.amount = (budgetTotal * (pct / 100)).toFixed(2);
      }
    } else if (field === 'amount' && budgetTotal > 0 && val !== "") {
      const amt = parseFloat(val);
      if (!isNaN(amt)) {
        item.percentage = ((amt / budgetTotal) * 100).toFixed(2);
      }
    }

    updated[idx] = item;
    setMilestoneItems(updated);
  };

  const handleMilestoneSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const budgetTotal = Number(project?.budget || 0);
    const totalAmount = milestoneItems.reduce((acc: number, curr: any) => acc + (parseFloat(curr.amount) || 0), 0);
    const totalPercentage = milestoneItems.reduce((acc: number, curr: any) => acc + (parseFloat(curr.percentage) || 0), 0);
    
    if (budgetTotal > 0) {
      // Adding a small margin (0.1) to account for JavaScript floating point precision issues
      if (totalAmount > budgetTotal + 0.1) {
        toast.error("Validation Failed", { description: "Total milestone amount cannot exceed project budget." });
        return;
      }
      if (totalPercentage > 100.01) {
        toast.error("Validation Failed", { description: "Total milestone percentage cannot exceed 100%." });
        return;
      }
    }

    // Validate amount sum maps to quote total if required
    const payload = milestoneItems.map((item: any) => ({
      id: item.id || undefined,
      title: item.title,
      description: item.description,
      amount: parseFloat(item.amount) || 0,
      due_date: item.due_date
        ? new Date(item.due_date).toISOString()
        : undefined,
      linked_stage: item.linked_stage || undefined,
      is_activation_gate: item.is_activation_gate,
    }));

    if (payload.some((item: any) => !item.title || item.amount <= 0)) {
      toast.error("Validation Failed", {
        description:
          "All milestones require a valid title and positive amount.",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await createMilestonesAction(projectId, payload);
      if (res?.success) {
        toast.success("Milestones Structured", {
          description: "Custom payment milestone gates are active.",
        });
        setShowMilestoneForm(false);
        onRefresh?.();
      } else {
        const errorMsg = res?.error || "Failed to Create";
        toast.error("Failed to Create", { description: errorMsg });
        alert(errorMsg);
      }
    } catch (err: any) {
      toast.error("Unexpected Error", { description: err.message });
      alert("Unexpected Error: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGenerateInvoice = async (
    targetId: string,
    type: "milestone" | "visit",
    title: string,
    amount: number,
    dueDate?: string,
  ) => {
    if (
      !confirm(
        `Generate tax invoice for "${title}" of ${formatRupee(amount)} + GST (18%)?`,
      )
    )
      return;

    setIsSubmitting(true);
    try {
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const invoiceNo = `INV-2026-${randomSuffix}`;

      const res = await createInvoiceAction({
        project_id: projectId,
        invoice_number: invoiceNo,
        amount: amount,
        gst_rate: 18,
        due_date: dueDate,
        notes: `Milestone/Visit specific tax invoice.`,
        milestone_id: type === "milestone" ? targetId : undefined,
        visit_id: type === "visit" ? targetId : undefined,
      });

      if (res?.success) {
        toast.success("Invoice Dispatched", {
          description: `Invoice ${invoiceNo} generated successfully.`,
        });
        onRefresh?.();
      } else {
        toast.error("Invoice Generation Failed", { description: res?.error });
      }
    } catch (err: any) {
      toast.error("Unexpected Error", { description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  // 5. Freeze & Unfreeze Submits (Manual, no auto-freeze as per Indian standards request)
  const handleFreezeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await freezeProjectAction(
        projectId,
        freezeReason,
        freezeComment,
      );
      if (res?.success) {
        toast.success("Project Locked", {
          description: "All technical departments blockades are active.",
        });
        setShowFreezeModal(false);
        onRefresh?.();
      } else {
        toast.error("Action Failed", { description: res?.error });
      }
    } catch (err: any) {
      toast.error("Unexpected Error", { description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUnfreeze = async () => {
    if (
      !confirm(
        "Are you sure you want to lift this financial lock? Operations will resume immediately.",
      )
    )
      return;
    setIsSubmitting(true);
    try {
      const res = await unfreezeProjectAction(
        projectId,
        "Outstanding cleared by client. Manual unfreeze.",
      );
      if (res?.success) {
        toast.success("Project Unlocked", {
          description: "Full technical operations restored.",
        });
        onRefresh?.();
      } else {
        toast.error("Action Failed", { description: res?.error });
      }
    } catch (err: any) {
      toast.error("Unexpected Error", { description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateBudget = async () => {
    if (isNaN(budgetInput) || budgetInput < 0) return;
    setIsSubmitting(true);
    try {
      const res = await updateProjectBudgetAction(projectId, budgetInput);
      if (res.success) {
        toast.success("Budget Updated");
        setIsEditingBudget(false);
        onRefresh?.();
      } else {
        toast.error("Failed to update budget", { description: res.error });
      }
    } catch (err: any) {
      toast.error("Unexpected Error", { description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (!confirm("Are you sure you want to delete this expense? This action cannot be undone.")) return;
    setIsSubmitting(true);
    try {
      const res = await deleteExpenseAction(id);
      if (res.success) {
        toast.success("Expense Deleted");
        onRefresh?.();
      } else {
        toast.error("Failed to delete expense", { description: res.error });
      }
    } catch (err: any) {
      toast.error("Unexpected Error", { description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">


      {/* ── Top Finance Actions Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Accountant Ownership Box (Admin Only) */}
        {isAdmin && (
          <div className="p-6 bg-gradient-to-br from-indigo-50 to-indigo-100/50 dark:from-indigo-950/40 dark:to-indigo-900/20 border border-indigo-200/60 dark:border-indigo-500/20 rounded-3xl flex flex-col justify-between shadow-sm relative overflow-hidden group hover:shadow-md transition-all duration-300">
            <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
              <UserPlus className="w-16 h-16 text-indigo-600" />
            </div>
            <div className="space-y-3 relative z-10">
              <div className="w-10 h-10 rounded-2xl bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center mb-2">
                <UserPlus className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h4 className="text-sm font-black text-indigo-950 dark:text-indigo-100">
                Assign Accountant Owner
              </h4>
              <p className="text-xs text-indigo-700/80 dark:text-indigo-300/80 leading-relaxed pr-8">
                Appoint the dedicated financial accountant responsible for
                verifying receipts, billing milestones, and setting up GST logs.
              </p>
            </div>

            <div className="mt-4 flex gap-2">
              <select
                value={selectedAccountant}
                onChange={(e) => setSelectedAccountant(e.target.value)}
                className="flex-1 bg-white/60 dark:bg-slate-950/60 backdrop-blur-md border border-indigo-200 dark:border-indigo-500/30 p-3 rounded-2xl text-xs text-indigo-950 dark:text-indigo-100 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all"
              >
                <option value="">Select Accountant...</option>
                {MOCK_ACCOUNTANTS.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.email})
                  </option>
                ))}
              </select>
              <button
                onClick={handleAssignAccountant}
                disabled={isSubmitting}
                className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-2xl text-xs transition-all disabled:opacity-50 shadow-md shadow-indigo-500/20"
              >
                Assign
              </button>
            </div>
          </div>
        )}



      </div>

      {/* ── Project Milestones Ledger ── */}
      <div className="glass-card p-6 md:p-8 bg-gradient-to-br from-white/95 to-slate-50/50 dark:from-slate-900/40 dark:to-slate-900/10 border border-slate-200/60 dark:border-white/5 rounded-2xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white">
              Structured Payment Milestones
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Setup stage gates where technical completion requires verified
              Indian GST (18%) invoices.
            </p>
          </div>

          {isAccountant && !showMilestoneForm && (
            <button
              onClick={() => {
                if (milestones.length > 0) {
                  const budgetTotal = Number(project?.budget || 0);
                  setMilestoneItems(milestones.map((m: any) => {
                    const mAmount = Number(m.amount) || 0;
                    return {
                      id: m.id,
                      title: m.title,
                      description: m.description || "",
                      percentage: budgetTotal > 0 ? ((mAmount / budgetTotal) * 100).toFixed(2) : "",
                      amount: m.amount || "",
                      due_date: m.due_date ? new Date(m.due_date).toISOString().split('T')[0] : "",
                      linked_stage: m.linked_stage || "",
                      is_activation_gate: m.is_activation_gate || false,
                    };
                  }));
                }
                setShowMilestoneForm(true);
              }}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition"
            >
              <Plus className="w-4 h-4" /> {milestones.length === 0 ? "Structure Milestones" : "Edit Milestones"}
            </button>
          )}
        </div>

        {/* Milestone Configuration Form Panel */}
        {showMilestoneForm && (
          <form
            onSubmit={handleMilestoneSubmit}
            className="p-6 bg-slate-50 dark:bg-slate-950/60 rounded-2xl border border-slate-200 dark:border-slate-800 space-y-6 animate-in slide-in-from-top duration-300"
          >
            <h4 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-indigo-500" /> Configure
              Milestone Schedule (INR, 18% GST Compliance)
            </h4>

            <div className="space-y-4">
              {milestoneItems.map((item, idx) => (
                <div
                  key={idx}
                  className="grid grid-cols-1 md:grid-cols-7 gap-3 items-end p-4 bg-white dark:bg-slate-900/40 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm"
                >
                  <div className="md:col-span-2 space-y-1">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-500">
                      Milestone Title
                    </label>
                    <input
                      type="text"
                      required
                      value={item.title}
                      onChange={(e) =>
                        handleMilestoneFieldChange(idx, "title", e.target.value)
                      }
                      placeholder="e.g., Deliverable Approval"
                      className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-2.5 rounded-xl text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-500">
                      Percentage (%)
                    </label>
                    <input
                      type="number"
                      value={item.percentage || ""}
                      onChange={(e) =>
                        handleMilestoneFieldChange(
                          idx,
                          "percentage",
                          e.target.value,
                        )
                      }
                      placeholder="%"
                      className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-2.5 rounded-xl text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-500">
                      Base Cost (INR)
                    </label>
                    <input
                      type="number"
                      required
                      value={item.amount}
                      onChange={(e) =>
                        handleMilestoneFieldChange(
                          idx,
                          "amount",
                          e.target.value,
                        )
                      }
                      placeholder="₹ Base cost"
                      className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-2.5 rounded-xl text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-500">
                      Due Date
                    </label>
                    <input
                      type="date"
                      value={item.due_date}
                      onChange={(e) =>
                        handleMilestoneFieldChange(
                          idx,
                          "due_date",
                          e.target.value,
                        )
                      }
                      className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-2.5 rounded-xl text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-600 dark:text-slate-500">
                      Linked Stage
                    </label>
                    <select
                      value={item.linked_stage}
                      onChange={(e) =>
                        handleMilestoneFieldChange(
                          idx,
                          "linked_stage",
                          e.target.value,
                        )
                      }
                      className="w-full bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-2.5 rounded-xl text-xs text-slate-900 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                    >
                      <option value="">None (Unrestricted)</option>
                      {Object.keys(STAGE_LABELS)
                        .filter((stg) => !["prototype", "review"].includes(stg) || item.linked_stage === stg)
                        .map((stg: any) => (
                          <option key={stg} value={stg}>
                            {STAGE_LABELS[stg]}
                          </option>
                        ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-3 justify-between p-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        id={`act-gate-${idx}`}
                        checked={item.is_activation_gate}
                        onChange={(e) =>
                          handleMilestoneFieldChange(
                            idx,
                            "is_activation_gate",
                            e.target.checked,
                          )
                        }
                        className="rounded bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-800 text-indigo-600 w-4 h-4 focus:ring-2 focus:ring-indigo-500"
                      />
                      <label
                        htmlFor={`act-gate-${idx}`}
                        className="text-xs font-bold text-slate-600 dark:text-slate-400 select-none"
                      >
                        Activates
                      </label>
                    </div>
                    {idx > 0 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveMilestoneItem(idx)}
                        className="text-xs text-red-500 font-bold hover:text-red-400"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                type="button"
                onClick={handleAddMilestoneItem}
                className="flex items-center gap-1 text-xs font-bold text-indigo-500 hover:text-indigo-400"
              >
                <Plus className="w-3.5 h-3.5" /> Add Milestone Item
              </button>

              <div className="flex gap-3">
                {isAccountant && (
                  <button
                    onClick={() => setExpenseModalOpen(true)}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-500/20 text-white rounded-xl text-xs font-semibold shadow-sm transition flex items-center gap-2"
                  >
                    <Award className="w-4 h-4" />
                    record Expense
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setShowMilestoneForm(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs flex items-center gap-1 shadow-md shadow-indigo-500/10"
                >
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : null}
                  Structure Payment Gates
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Milestones List Ledger */}
        <div className="overflow-x-auto rounded-xl border border-slate-200/60 dark:border-white/10 bg-white/50 dark:bg-slate-950/20 shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-slate-900/50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 dark:border-slate-800">
                <th className="p-4">Milestone Title</th>
                <th className="p-4">Base Cost</th>
                <th className="p-4">GST (18%)</th>
                <th className="p-4">Total Amount</th>
                <th className="p-4">Due Date</th>
                <th className="p-4">Stage Guard</th>
                <th className="p-4">Status</th>
                {isAccountant && <th className="p-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {milestones.map((m) => {
                const cgst = (m.amount * 9) / 100;
                const sgst = (m.amount * 9) / 100;
                const gstAmount = cgst + sgst;
                const totalAmount = m.amount + gstAmount;

                return (
                  <tr
                    key={m.id}
                    className="border-b border-slate-100 dark:border-slate-800/60 hover:bg-slate-50/80 dark:hover:bg-white/[0.02] text-sm transition duration-200"
                  >
                    <td className="p-4">
                      <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        {m.is_activation_gate && (
                          <span title="Project Activation Milestone">
                            <Award className="w-4 h-4 text-indigo-500" />
                          </span>
                        )}
                        <span className="max-w-[140px] leading-tight block">{m.title}</span>
                      </div>
                      {m.description && (
                        <span className="text-xs text-slate-500 mt-1 block">
                          {m.description}
                        </span>
                      )}
                    </td>
                    <td className="p-4 nums font-medium text-slate-400 dark:text-slate-500">
                      {formatRupee(m.amount)}
                    </td>
                    <td className="p-4 nums text-slate-500 dark:text-slate-400">
                      <div className="font-semibold text-slate-500 dark:text-slate-400">{formatRupee(gstAmount)}</div>
                      <div className="text-[10px] text-slate-400 dark:text-slate-500 mt-0.5 font-medium">
                        (9% CGST + 9% SGST)
                      </div>
                    </td>
                    <td className="p-4 nums font-semibold text-indigo-600 dark:text-indigo-400">
                      {formatRupee(totalAmount)}
                    </td>
                    <td className="p-4 nums font-medium text-slate-400 dark:text-slate-500">
                      {m.due_date
                        ? new Date(m.due_date).toLocaleDateString()
                        : "N/A"}
                    </td>
                    <td className="p-4">
                      {m.linked_stage ? (
                        <span className="inline-flex px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800/50 text-[11px] font-bold text-slate-700 dark:text-slate-300 border border-slate-200/80 dark:border-slate-700/50 shadow-sm whitespace-nowrap">
                          {STAGE_LABELS[m.linked_stage]}
                        </span>
                      ) : (
                        <span className="text-slate-400 font-medium text-xs">None</span>
                      )}
                    </td>
                    <td className="p-4">
                      <span
                        className={cn(
                          "px-3.5 py-1.5 rounded-full text-[11px] font-bold tracking-wider uppercase shadow-sm border",
                          m.status === "paid"
                            ? "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20"
                            : m.status === "overdue"
                              ? "bg-rose-100 text-rose-700 border-rose-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20"
                              : m.status === "invoice_generated"
                                ? "bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-500/10 dark:text-cyan-400 dark:border-cyan-500/20"
                                : "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/60 dark:text-slate-300 dark:border-slate-700"
                        )}
                      >
                        {m.status.replace("_", " ")}
                      </span>
                    </td>
                    {isAccountant && (
                      <td className="p-4 text-right">
                        {m.status === "pending" ? (
                          <button
                            onClick={() =>
                              handleGenerateInvoice(
                                m.id,
                                "milestone",
                                m.title,
                                m.amount,
                                m.due_date
                              )
                            }
                            disabled={isSubmitting}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-all disabled:opacity-50 shadow-md shadow-indigo-500/20 hover:-translate-y-0.5"
                          >
                            Bill
                          </button>
                        ) : m.status === "invoice_generated" ? (
                          <button
                            onClick={() => {
                              setSelectedPaymentMilestone(m);
                              setPaymentModalOpen(true);
                            }}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition-all shadow-md shadow-indigo-500/20 hover:-translate-y-0.5"
                          >
                            Log Payment
                          </button>
                        ) : m.status === "payment_verification_pending" ? (
                          <span className="text-xs text-amber-600 dark:text-amber-500 font-bold">
                            Pending Verification
                          </span>
                        ) : m.status === "paid" ? (
                          <span className="text-sm text-emerald-600 dark:text-emerald-500 font-bold tracking-tight">
                            Paid ✓
                          </span>
                        ) : m.status === "overdue" ? (
                          <div className="flex gap-2 justify-end">
                            <span className="text-xs text-rose-600 dark:text-red-500 font-bold self-center">
                              Payment Overdue
                            </span>
                          </div>
                        ) : null}
                      </td>
                    )}
                  </tr>
                );
              })}
              {milestones.length === 0 && (
                <tr>
                  <td
                    colSpan={isAccountant ? 8 : 7}
                    className="p-8 text-center text-slate-500 italic"
                  >
                    No structure formulated yet. Standard Indian GST invoice
                    schedules are ready to build.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Project Costs & Expenses Ledger ── */}
      <div className="glass-card p-6 md:p-8 bg-gradient-to-br from-white/95 to-slate-50/50 dark:from-slate-900/40 dark:to-slate-900/10 border border-slate-200/60 dark:border-white/5 rounded-2xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white font-sans">
              Project Costs & Expenses
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Log and track labor allocations, material purchases, and field visits.
            </p>
          </div>
          {isAccountant && (
            <div className="flex gap-3 items-center">
              <button
                onClick={() => setExpenseModalOpen(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs transition shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Record Expense
              </button>
            </div>
          )}
        </div>

        {/* Expense Summary Header */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
          {/* Billed Revenue Card */}
          <div className="glass-card p-6 dark:bg-white/[0.03] group hover:bg-white/[0.08] transition-all duration-500 relative overflow-hidden shadow-xl shadow-black/[0.02]">
            <div className="absolute top-0 right-0 -mr-8 -mt-8 w-24 h-24 bg-indigo-500/5 rounded-full blur-2xl group-hover:bg-indigo-500/15 transition-all duration-500 pointer-events-none" />
            <div className="flex items-start justify-between relative z-10">
              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Total Billed Revenue</p>
                <h3 className="text-3xl font-extrabold tracking-tight text-indigo-950 dark:text-indigo-100 leading-none">
                  {formatRupee(totalBilled)}
                </h3>
              </div>
              <div className="p-3 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 shadow-inner group-hover:scale-110 transition-transform duration-500">
                <TrendingUp className="w-5 h-5 text-indigo-500" />
              </div>
            </div>
          </div>

          {/* Expenses Card */}
          <div className="glass-card p-6 dark:bg-white/[0.03] group hover:bg-white/[0.08] transition-all duration-500 relative overflow-hidden shadow-xl shadow-black/[0.02]">
            <div className="absolute top-0 right-0 -mr-8 -mt-8 w-24 h-24 bg-rose-500/5 rounded-full blur-2xl group-hover:bg-rose-500/15 transition-all duration-500 pointer-events-none" />
            <div className="flex items-start justify-between relative z-10">
              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Total Expenses</p>
                <h3 className="text-3xl font-extrabold tracking-tight text-rose-950 dark:text-rose-100 leading-none">
                  {formatRupee(totalExpenses)}
                </h3>
              </div>
              <div className="p-3 bg-rose-500/10 rounded-2xl border border-rose-500/20 shadow-inner group-hover:scale-110 transition-transform duration-500">
                <TrendingDown className="w-5 h-5 text-rose-500" />
              </div>
            </div>
          </div>

          {/* Profitability Card */}
          <div className="glass-card p-6 dark:bg-white/[0.03] group hover:bg-white/[0.08] transition-all duration-500 relative overflow-hidden shadow-xl shadow-black/[0.02]">
            <div className="absolute top-0 right-0 -mr-8 -mt-8 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl group-hover:bg-emerald-500/15 transition-all duration-500 pointer-events-none" />
            <div className="flex items-start justify-between relative z-10">
              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest">Current Profitability</p>
                <h3 className={cn(
                  "text-3xl font-extrabold tracking-tight leading-none",
                  currentProfit >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-500"
                )}>
                  {formatRupee(currentProfit)}
                </h3>
              </div>
              <div className="p-3 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 shadow-inner group-hover:scale-110 transition-transform duration-500">
                <DollarSign className="w-5 h-5 text-emerald-500" />
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-slate-200/60 dark:border-white/10 bg-white/50 dark:bg-slate-950/20 shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-slate-900/50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 dark:border-slate-800">

                <th className="p-4">Date</th>
                <th className="p-4">Category</th>
                <th className="p-4">Description</th>
                <th className="p-4 text-right">Amount</th>
                <th className="p-4 text-center">Receipt</th>
                <th className="p-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loadingExpenses ? (
                <tr>
                  <td colSpan={5} className="p-8 text-center text-slate-500">
                    <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                  </td>
                </tr>
              ) : expenses.map((exp) => (
                <tr key={exp.id} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-white/[0.02] text-xs transition duration-200">

                  <td className="p-4 text-slate-700 dark:text-slate-300 nums font-bold">
                    {new Date(exp.expense_date).toLocaleDateString()}
                  </td>
                  <td className="p-4">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-widest bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 uppercase">
                      {exp.category === 'travel' ? 'Travel / Field Visit' : exp.category}
                    </span>
                  </td>
                  <td className="p-4 text-slate-600 dark:text-slate-300 max-w-[200px] truncate" title={exp.description}>
                    {exp.description}
                  </td>
                  <td className="p-4 text-right font-bold text-rose-400 nums">
                    {formatRupee(exp.amount)}
                  </td>
                  <td className="p-4 text-center">
                    {exp.receipt_url ? (
                      <a href={exp.receipt_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 transition-colors">
                        <FileText className="w-3.5 h-3.5" />
                        View
                      </a>
                    ) : (
                      <span className="text-slate-600">-</span>
                    )}
                  </td>
                  <td className="p-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => {
                          setEditingExpense(exp);
                          setExpenseModalOpen(true);
                        }}
                        className="p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-indigo-400/10 rounded-lg transition-colors"
                        title="Edit Expense"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteExpense(exp.id)}
                        disabled={isSubmitting}
                        className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-400/10 rounded-lg transition-colors"
                        title="Delete Expense"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              
              {/* Inject visits as expenses */}
              {visits.filter(v => Number(v.visit_cost || 0) > 0).map((v) => (
                <tr key={`visit-${v.id}`} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-white/[0.02] text-xs transition duration-200 bg-slate-50/30 dark:bg-slate-900/10">

                  <td className="p-4 text-slate-700 dark:text-slate-300 nums font-bold">
                    {new Date(v.scheduled_date || v.created_at || new Date()).toLocaleDateString()}
                  </td>
                  <td className="p-4">
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black tracking-widest bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-300 dark:border-slate-700 uppercase">
                      Field Visit
                    </span>
                  </td>
                  <td className="p-4 text-slate-600 dark:text-slate-300 max-w-[200px] truncate" title={v.purpose || 'Field Visit'}>
                    {v.purpose || 'Scheduled from Milestones Portal'}
                  </td>
                  <td className="p-4 text-right font-bold text-rose-400 nums">
                    {formatRupee(Number(v.visit_cost || 0))}
                  </td>
                  <td className="p-4 text-center">
                    <span className="text-slate-400">-</span>
                  </td>
                  <td className="p-4 text-center">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Added by System</span>
                  </td>
                  <td className="p-4 text-right">
                    <div className="flex justify-end gap-2">
                      {isAccountant && v.status !== 'paid' && v.status !== 'invoice_generated' && (
                        <button
                          onClick={() => {
                            setSelectedVisitForInvoice(v);
                            setExpenseInvoiceModalOpen(true);
                          }}
                          className="px-3 py-1 bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-600 dark:bg-blue-500/10 dark:hover:bg-blue-500/20 dark:text-indigo-400 font-semibold rounded-lg text-xs transition-all shadow-sm"
                          title="Generate Invoice for this Field Visit"
                        >
                          Bill
                        </button>
                      )}
                      {(v.status === 'paid' || v.status === 'invoice_generated') && (
                        <span className="text-[10px] font-bold text-emerald-500 uppercase">
                          {v.status === 'paid' ? 'Paid' : 'Billed'}
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}

              {!loadingExpenses && expenses.length === 0 && visits.filter(v => Number(v.visit_cost || 0) > 0).length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500 italic">
                    No expenses logged for this project yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Visit-Based Ledger Panel ── */}
      {project.billing_type === "visit_based" && (
        <div className="glass-card p-6 md:p-8 bg-gradient-to-br from-white/95 to-slate-50/50 dark:from-slate-900/40 dark:to-slate-900/10 border border-slate-200/60 dark:border-white/5 rounded-2xl space-y-4">
          <div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white font-sans">
              Indian SAC 9983 Survey Visit Ledger
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Rolling visits ledger. Invoiced per-visit at standard rates,
              guarding technical stage movements.
            </p>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200/60 dark:border-white/10 bg-white/50 dark:bg-slate-950/20 shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-slate-900/50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 dark:border-slate-800">
                  <th className="p-4">Visit Date</th>
                  <th className="p-4">Field Task Log Details</th>
                  <th className="p-4">Completion Status</th>
                  <th className="p-4">Billing Status</th>
                  {isAccountant && (
                    <th className="p-4 text-right">Invoice Generation</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {visits.map((v) => (
                  <tr
                    key={v.id}
                    className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-white/[0.02] text-xs transition duration-200"
                  >
                    <td className="p-4 nums font-bold text-slate-700 dark:text-slate-300">
                      {new Date(v.visit_date).toLocaleDateString()}
                    </td>
                    <td className="p-4">
                      <div className="font-bold text-slate-900 dark:text-slate-200">
                        Logged by: Field Crew
                      </div>
                      {v.description && (
                        <span className="text-xs text-slate-500">
                          {v.description}
                        </span>
                      )}
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-bold tracking-widest ${v.completed_at
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                          }`}
                      >
                        {v.completed_at ? "Completed" : "Scheduled"}
                      </span>
                    </td>
                    <td className="p-4">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-bold tracking-widest ${v.status === "paid"
                          ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                          : v.status === "invoice_generated"
                            ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                            : "bg-slate-855 text-slate-440 border border-slate-800"
                          }`}
                      >
                        {v.status}
                      </span>
                    </td>
                    {isAccountant && (
                      <td className="p-4 text-right">
                        {v.status === "completed" ? (
                          <button
                            onClick={() =>
                              handleGenerateInvoice(
                                v.id,
                                "visit",
                                `Field Visit - ${new Date(v.visit_date).toLocaleDateString()}`,
                                15000,
                              )
                            } // Standard visit cost ₹15,000 + GST
                            disabled={isSubmitting}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-full text-xs transition-all disabled:opacity-50 shadow-md shadow-indigo-500/20 hover:-translate-y-0.5"
                          >
                            Bill Visit
                          </button>
                        ) : v.status === "invoice_generated" ? (
                          <span className="text-xs text-slate-500 italic">
                            Invoice Sent
                          </span>
                        ) : v.status === "paid" ? (
                          <span className="text-sm text-emerald-600 dark:text-emerald-500 font-black tracking-tight">
                            Paid ✓
                          </span>
                        ) : (
                          <span className="text-xs text-slate-550 italic">
                            Scheduled
                          </span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
                {visits.length === 0 && (
                  <tr>
                    <td
                      colSpan={isAccountant ? 5 : 4}
                      className="p-8 text-center text-slate-500 italic"
                    >
                      No visits recorded under this billing ledger.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Manual Freeze Modal Panel ── */}
      <Dialog open={showFreezeModal} onOpenChange={setShowFreezeModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-red-500" />
              Manual Operations Freeze
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleFreezeSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500">
                Lockout Category
              </label>
              <select
                value={freezeReason}
                onChange={(e: any) => setFreezeReason(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-2.5 rounded-xl text-xs text-slate-900 dark:text-slate-300 focus:outline-none focus:border-red-500"
              >
                <option value="payment_pending">
                  Payment Pending (Outstanding Milestones)
                </option>
                <option value="financial_hold">General Financial Hold</option>
                <option value="client_issue">
                  Client Inactivity / Relationship Issue
                </option>
                <option value="approval_issue">
                  Regulatory / Approval Complication
                </option>
                <option value="manual_admin_hold">
                  Manual Administrator Override Hold
                </option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500">
                Explanatory Comments (Logs in Audit Trail)
              </label>
              <textarea
                required
                rows={3}
                value={freezeComment}
                onChange={(e) => setFreezeComment(e.target.value)}
                placeholder="Specify milestone details, GST payment details, or override logs..."
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 rounded-xl text-xs text-slate-900 dark:text-slate-200 focus:outline-none focus:border-red-500"
              />
            </div>

            <DialogFooter>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1 shadow-lg shadow-red-500/10"
              >
                {isSubmitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : null}
                Apply Operations Freeze
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Freeze History Panel ── */}
      <div className="glass-card p-6 md:p-8 bg-gradient-to-br from-white/95 to-slate-50/50 dark:from-slate-900/40 dark:to-slate-900/10 border border-slate-200/60 dark:border-white/5 rounded-2xl space-y-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900 dark:text-white font-sans">
            Freeze & Lockout History
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Audit log of all manual and automated project lockouts applied or
            lifted.
          </p>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-200/60 dark:border-white/10 bg-white/50 dark:bg-slate-950/20 shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 dark:bg-slate-900/50 text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-200 dark:border-slate-800">
                <th className="p-4">Timestamp</th>
                <th className="p-4">Action</th>
                <th className="p-4">Details / Reason</th>
                <th className="p-4">Comments</th>
              </tr>
            </thead>
            <tbody>
              {(activityLogs || []).filter((a: any) =>
                ["PROJECT_FROZEN", "PROJECT_UNFROZEN"].includes(a.action),
              ).length > 0 ? (
                (activityLogs || [])
                  .filter((a: any) =>
                    ["PROJECT_FROZEN", "PROJECT_UNFROZEN"].includes(a.action),
                  )
                  .map((h: any) => (
                    <tr
                      key={h.id}
                      className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50/50 dark:hover:bg-white/[0.02] text-xs transition duration-200"
                    >
                      <td className="p-4 nums text-slate-600 dark:text-slate-400">
                        {new Date(h.created_at).toLocaleString()}
                      </td>
                      <td className="p-4 font-bold">
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded text-xs font-bold tracking-widest",
                            h.action === "PROJECT_FROZEN"
                              ? "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                              : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20",
                          )}
                        >
                          {h.action === "PROJECT_FROZEN"
                            ? "Locked / Frozen"
                            : "Unlocked / Active"}
                        </span>
                      </td>
                      <td className="p-4 text-slate-500 dark:text-slate-350">
                        {h.details?.reason
                          ? h.details.reason.replace("_", " ").toUpperCase()
                          : "Manual Trigger"}
                      </td>
                      <td className="p-4 text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                        {h.details?.comment || "Hold action completed."}
                      </td>
                    </tr>
                  ))
              ) : (
                <tr>
                  <td
                    colSpan={4}
                    className="p-8 text-center text-slate-500 italic"
                  >
                    No financial lock history recorded for this project.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}


      <LogPaymentModal
        isOpen={paymentModalOpen}
        onClose={() => {
          setPaymentModalOpen(false);
          setSelectedPaymentMilestone(null);
        }}
        milestoneId={selectedPaymentMilestone?.id || ""}
        projectId={project.id}
        milestoneTitle={selectedPaymentMilestone?.title || ""}
        amount={selectedPaymentMilestone?.amount || 0}
        onSuccess={() => onRefresh?.()}
      />

      <ExpenseEntryModal
        isOpen={expenseModalOpen}
        onClose={() => {
          setExpenseModalOpen(false);
          setEditingExpense(null);
        }}
        projects={[]}
        defaultProjectId={projectId}
        initialCategory={expenseCategory}
        expenseToEdit={editingExpense}
        onSuccess={() => {
          onRefresh?.();
        }}
      />

      <CreateInvoiceModal
        isOpen={expenseInvoiceModalOpen}
        onOpenChange={(open) => {
          setExpenseInvoiceModalOpen(open);
          if (!open) {
            setSelectedExpenseForInvoice(null);
            setSelectedVisitForInvoice(null);
          }
        }}
        projectId={project.id}
        projectName={project.name}
        clientName={project.client_name}
        expenseId={selectedExpenseForInvoice?.id}
        expenseTitle={selectedExpenseForInvoice?.description}
        visitId={selectedVisitForInvoice?.id}
        visitTitle={selectedVisitForInvoice ? (selectedVisitForInvoice.purpose || 'Field Visit Services') : undefined}
        initialAmount={selectedExpenseForInvoice?.amount || Number(selectedVisitForInvoice?.visit_cost || 0)}
        onSuccess={() => {
          setSelectedExpenseIds(new Set());
          onRefresh?.();
        }}
      />
    </div>
  );
}
