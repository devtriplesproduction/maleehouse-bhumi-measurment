"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import {
  PackageX,
  AlertTriangle,
  CheckCircle2,
  Search,
  Download,
  Building2,
  Clock,
  ArrowUpRight,
  Wallet,
  FileText,
  Phone,
  Mail,
  ChevronDown,
  Loader2
} from "lucide-react";
import * as XLSX from "xlsx";
import { PageHeader } from "@/components/modules/PageHeader";
import { updateLostMaterialResolutionAction } from "@/actions/field.actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export interface LostMaterialRecord {
  id: string;
  project_id: string;
  project_name: string;
  client_name: string;
  project_status?: string;
  item_name: string;
  quantity: number;
  status: string;
  notes?: string;
  lost_reason?: string;
  lost_reported_at: string;
  responsible_person_id?: string;
  responsible_person_name: string;
  responsible_role: string;
  responsible_email?: string;
  responsible_phone?: string;
  reporter_name: string;
  resolution_status: 'unresolved' | 'recovered' | 'deducted_from_pay' | 'written_off';
  resolution_notes?: string;
  created_at: string;
}

interface LostMaterialsDashboardProps {
  initialMaterials: LostMaterialRecord[];
}

const RESOLUTION_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  unresolved: {
    label: "Unresolved",
    color: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
    icon: AlertTriangle
  },
  recovered: {
    label: "Recovered & Returned",
    color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    icon: CheckCircle2
  },
  deducted_from_pay: {
    label: "Deducted from Pay",
    color: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
    icon: Wallet
  },
  written_off: {
    label: "Written Off (Absorbed)",
    color: "bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20",
    icon: FileText
  }
};

export function LostMaterialsDashboard({ initialMaterials }: LostMaterialsDashboardProps) {
  const [materials, setMaterials] = useState<LostMaterialRecord[]>(initialMaterials);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  React.useEffect(() => {
    setMaterials(initialMaterials);
  }, [initialMaterials]);

  const handleStatusChange = async (
    recordId: string,
    newResolution: 'unresolved' | 'recovered' | 'deducted_from_pay' | 'written_off',
    existingNotes?: string
  ) => {
    setUpdatingId(recordId);
    try {
      const res = await updateLostMaterialResolutionAction(recordId, newResolution, existingNotes);
      if (res.success) {
        toast.success(res.message || "Resolution status updated.");
        setMaterials(prev =>
          prev.map(m => {
            if (m.id === recordId) {
              return {
                ...m,
                resolution_status: newResolution,
                status: newResolution === 'recovered' ? 'submitted' : m.status
              };
            }
            return m;
          })
        );
      } else {
        toast.error(res.error || "Failed to update resolution status.");
      }
    } catch (err: any) {
      toast.error(err.message || "An error occurred.");
    } finally {
      setUpdatingId(null);
    }
  };

  // KPI metrics
  const stats = useMemo(() => {
    const totalRecords = materials.length;
    const totalQuantity = materials.reduce((acc, m) => acc + (m.quantity || 1), 0);
    const unresolved = materials.filter(m => m.resolution_status === 'unresolved').length;
    const recovered = materials.filter(m => m.resolution_status === 'recovered').length;
    const deducted = materials.filter(m => m.resolution_status === 'deducted_from_pay').length;
    const uniqueProjects = new Set(materials.map(m => m.project_id)).size;

    return { totalRecords, totalQuantity, unresolved, recovered, deducted, uniqueProjects };
  }, [materials]);

  // Filtering
  const filteredMaterials = useMemo(() => {
    return materials.filter(item => {
      if (statusFilter !== "all" && item.resolution_status !== statusFilter) {
        return false;
      }

      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchItem = item.item_name?.toLowerCase().includes(query);
        const matchProject = item.project_name?.toLowerCase().includes(query);
        const matchClient = item.client_name?.toLowerCase().includes(query);
        const matchResponsible = item.responsible_person_name?.toLowerCase().includes(query);
        const matchReporter = item.reporter_name?.toLowerCase().includes(query);
        const matchReason = item.lost_reason?.toLowerCase().includes(query);

        if (!matchItem && !matchProject && !matchClient && !matchResponsible && !matchReporter && !matchReason) {
          return false;
        }
      }

      return true;
    });
  }, [materials, searchQuery, statusFilter]);

  const handleExportExcel = () => {
    if (filteredMaterials.length === 0) {
      toast.error("No records to export.");
      return;
    }

    const exportRows = filteredMaterials.map(m => ({
      "Equipment Name": m.item_name,
      "Quantity": m.quantity,
      "Project Name": m.project_name,
      "Client": m.client_name,
      "Responsible Member": m.responsible_person_name,
      "Responsible Role": m.responsible_role,
      "Responsible Email": m.responsible_email || "N/A",
      "Responsible Phone": m.responsible_phone || "N/A",
      "Reason for Loss": m.lost_reason || "Unspecified",
      "Reported By": m.reporter_name,
      "Reported At": m.lost_reported_at ? new Date(m.lost_reported_at).toLocaleString() : "N/A",
      "Resolution Status": RESOLUTION_CONFIG[m.resolution_status]?.label || m.resolution_status,
      "Resolution Notes": m.resolution_notes || "N/A"
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Lost Equipment");
    XLSX.writeFile(wb, `Lost_Materials_Report_${new Date().toISOString().split("T")[0]}.xlsx`);
    toast.success("Excel export downloaded.");
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <PageHeader
        title="Lost & Missing Materials"
        subtitle="Audit and view details of missing equipment across all projects and accountable staff members"
        icon={PackageX}
        iconClassName="text-rose-500"
        actions={
          <button
            type="button"
            onClick={handleExportExcel}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/10 transition shadow-sm"
          >
            <Download className="w-3.5 h-3.5 text-slate-400" />
            <span>Export Report</span>
          </button>
        }
      />

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card p-4 rounded-2xl border border-slate-200/70 dark:border-white/5 bg-white dark:bg-slate-900/60">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total Lost Items</span>
            <div className="w-8 h-8 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500">
              <PackageX className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">{stats.totalQuantity}</span>
            <span className="text-xs text-slate-400">units ({stats.totalRecords} incidents)</span>
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl border border-slate-200/70 dark:border-white/5 bg-white dark:bg-slate-900/60">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-500">Unresolved Issues</span>
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-amber-600 dark:text-amber-400">{stats.unresolved}</span>
            <span className="text-xs text-slate-400">pending resolution</span>
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl border border-slate-200/70 dark:border-white/5 bg-white dark:bg-slate-900/60">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-500">Recovered Equipment</span>
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-500">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{stats.recovered}</span>
            <span className="text-xs text-slate-400">returned to stock</span>
          </div>
        </div>

        <div className="glass-card p-4 rounded-2xl border border-slate-200/70 dark:border-white/5 bg-white dark:bg-slate-900/60">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-indigo-500">Impacted Projects</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-500">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900 dark:text-white">{stats.uniqueProjects}</span>
            <span className="text-xs text-slate-400">survey projects</span>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3.5 rounded-2xl bg-white dark:bg-slate-900/80 border border-slate-200/70 dark:border-white/10 shadow-sm">
        {/* Search Input */}
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search material, project, responsible person..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full text-xs pl-9 pr-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-white/10 focus:outline-none focus:border-indigo-500 font-medium text-slate-800 dark:text-white"
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
          {[
            { id: "all", label: "All Items" },
            { id: "unresolved", label: "Unresolved" },
            { id: "recovered", label: "Recovered" },
            { id: "deducted_from_pay", label: "Deducted" },
            { id: "written_off", label: "Written Off" }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all",
                statusFilter === tab.id
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Table / Card List */}
      <div className="glass-card rounded-2xl border border-slate-200/70 dark:border-white/10 overflow-hidden bg-white dark:bg-slate-900/80 shadow-sm">
        {filteredMaterials.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-slate-800 dark:text-white">No Lost Equipment Recorded</h3>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              {materials.length === 0
                ? "All assigned materials and equipment across projects have been submitted back to the company safely."
                : "No lost items match your current search or status filter."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 dark:bg-slate-950/60 border-b border-slate-200/70 dark:border-white/10 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="py-3 px-4">Equipment & Quantity</th>
                  <th className="py-3 px-4">Project</th>
                  <th className="py-3 px-4">Responsible Member</th>
                  <th className="py-3 px-4">Loss Details & Reason</th>
                  <th className="py-3 px-4">Reported By / Date</th>
                  <th className="py-3 px-4">Resolution Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                {filteredMaterials.map((mat) => {
                  const resCfg = RESOLUTION_CONFIG[mat.resolution_status] || RESOLUTION_CONFIG.unresolved;
                  const ResIcon = resCfg.icon;

                  return (
                    <tr key={mat.id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors">
                      {/* Equipment */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center shrink-0">
                            <PackageX className="w-4 h-4" />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-slate-900 dark:text-white">
                                {mat.item_name}
                              </span>
                              <span className="text-[10px] font-black px-1.5 py-0.2 rounded bg-slate-200/80 dark:bg-white/10 text-slate-700 dark:text-slate-300">
                                x{mat.quantity}
                              </span>
                            </div>
                            {mat.notes && (
                              <p className="text-[11px] text-slate-400 truncate max-w-xs mt-0.5">
                                {mat.notes}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Project */}
                      <td className="py-3.5 px-4">
                        <div>
                          <Link
                            href={`/projects/${mat.project_id}`}
                            className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 group"
                          >
                            <span>{mat.project_name}</span>
                            <ArrowUpRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </Link>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            Client: {mat.client_name || "N/A"}
                          </p>
                        </div>
                      </td>

                      {/* Responsible Member */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <div className="w-6 h-6 rounded-full bg-slate-200 dark:bg-white/10 flex items-center justify-center text-[10px] font-bold text-slate-700 dark:text-slate-200">
                              {(mat.responsible_person_name || 'U').substring(0, 2).toUpperCase()}
                            </div>
                            <span className="font-bold text-slate-800 dark:text-slate-200">
                              {mat.responsible_person_name}
                            </span>
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-400">
                            <span className="px-1.5 py-0.2 rounded bg-slate-100 dark:bg-white/5 uppercase font-semibold">
                              {mat.responsible_role}
                            </span>
                            {mat.responsible_phone && (
                              <a
                                href={`tel:${mat.responsible_phone}`}
                                className="flex items-center gap-0.5 hover:text-indigo-500 transition-colors"
                              >
                                <Phone className="w-2.5 h-2.5" />
                                {mat.responsible_phone}
                              </a>
                            )}
                            {mat.responsible_email && (
                              <a
                                href={`mailto:${mat.responsible_email}`}
                                className="flex items-center gap-0.5 hover:text-indigo-500 transition-colors"
                              >
                                <Mail className="w-2.5 h-2.5" />
                                {mat.responsible_email}
                              </a>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Reason */}
                      <td className="py-3.5 px-4 max-w-xs">
                        <p className="text-slate-700 dark:text-slate-300 font-medium italic">
                          &ldquo;{mat.lost_reason || "No explanation provided"}&rdquo;
                        </p>
                      </td>

                      {/* Reporter / Date */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div>
                          <span className="font-semibold text-slate-700 dark:text-slate-300">
                            {mat.reporter_name}
                          </span>
                          <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {mat.lost_reported_at
                              ? new Date(mat.lost_reported_at).toLocaleDateString("en-IN", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric"
                                })
                              : "N/A"}
                          </p>
                        </div>
                      </td>

                      {/* Resolution Status */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <div className="relative inline-flex items-center group">
                            <div className="pointer-events-none absolute left-2.5 flex items-center text-current">
                              <ResIcon className="w-3 h-3" />
                            </div>
                            <select
                              value={mat.resolution_status || 'unresolved'}
                              disabled={updatingId === mat.id}
                              onChange={(e) =>
                                handleStatusChange(
                                  mat.id,
                                  e.target.value as 'unresolved' | 'recovered' | 'deducted_from_pay' | 'written_off',
                                  mat.resolution_notes
                                )
                              }
                              className={cn(
                                "text-[10px] font-bold pl-7 pr-6 py-1 rounded-full border appearance-none cursor-pointer transition shadow-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/30",
                                resCfg.color,
                                updatingId === mat.id && "opacity-60 cursor-wait"
                              )}
                              title="Click to change resolution status"
                            >
                              <option value="unresolved" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-white font-medium">
                                Unresolved
                              </option>
                              <option value="recovered" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-white font-medium">
                                Recovered & Returned
                              </option>
                              <option value="deducted_from_pay" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-white font-medium">
                                Deducted from Pay
                              </option>
                              <option value="written_off" className="bg-white dark:bg-slate-900 text-slate-800 dark:text-white font-medium">
                                Written Off (Absorbed)
                              </option>
                            </select>
                            <div className="pointer-events-none absolute right-2 flex items-center text-current opacity-70">
                              {updatingId === mat.id ? (
                                <Loader2 className="w-2.5 h-2.5 animate-spin" />
                              ) : (
                                <ChevronDown className="w-2.5 h-2.5 transition-transform group-hover:translate-y-0.5" />
                              )}
                            </div>
                          </div>
                          {mat.resolution_notes && (
                            <p className="text-[10px] text-slate-400 italic max-w-xs truncate" title={mat.resolution_notes}>
                              Note: {mat.resolution_notes}
                            </p>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
