"use client";

import React, { useState } from "react";
import { Clock, MapPin, Package, Upload, CheckCircle2, AlertCircle, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { markVisitCompletedAction, createMaterialRequestAction, submitMaterialToCompanyAction } from "@/actions/field.actions";
export function AttendanceWidget() {
  const [checkedIn, setCheckedIn] = useState(false);
  const [time, setTime] = useState<string | null>(null);

  const handleToggle = () => {
    if (!checkedIn) {
      setCheckedIn(true);
      setTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } else {
      setCheckedIn(false);
      setTime(null);
    }
  };

  return (
    <div className="glass-card border-white/10 p-5 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center transition-colors", checkedIn ? "bg-emerald-500/10 text-emerald-500" : "bg-slate-500/10 text-slate-500")}>
          <Clock className="w-6 h-6" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Daily Attendance</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {checkedIn ? `Checked in at ${time}` : "Not checked in yet"}
          </p>
        </div>
      </div>
      <button 
        onClick={handleToggle}
        className={cn(
          "px-4 py-2 rounded-xl text-sm font-bold transition-all",
          checkedIn 
            ? "bg-rose-500/10 text-rose-500 hover:bg-rose-500/20" 
            : "bg-emerald-500 text-white hover:bg-emerald-600 shadow-lg shadow-emerald-500/20"
        )}
      >
        {checkedIn ? "Check Out" : "Check In"}
      </button>
    </div>
  );
}

export function DailyVisitsWidget({ visits }: { visits: any[] }) {
  const router = useRouter();
  const [loadingId, setLoadingId] = useState<string | null>(null);

  const handleComplete = async (visitId: string) => {
    setLoadingId(visitId);
    const res = await markVisitCompletedAction(visitId);
    setLoadingId(null);
    if (res.success) {
      router.refresh();
    } else {
      alert("Failed to mark visit as completed: " + res.error);
    }
  };

  return (
    <div className="glass-card border-white/10 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-sky-500" />
          <h3 className="font-bold text-slate-900 dark:text-white">Assigned Project Visits</h3>
        </div>
        <span className="px-2.5 py-1 rounded-full bg-sky-500/10 text-xs font-bold text-sky-500">
          {visits.length} Visits
        </span>
      </div>
      
      <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
        {visits.length === 0 ? (
          <p className="text-sm text-slate-500 py-4 text-center">No visits scheduled today.</p>
        ) : (
          visits.map((visit, idx) => (
            <div key={idx} className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5">
              <div className="w-8 h-8 rounded-full bg-sky-500/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-xs font-bold text-sky-500">{idx + 1}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{visit.project_name}</p>
                <p className="text-xs text-slate-500 truncate">{visit.location}</p>
              </div>
              <div className="text-right flex-shrink-0 flex flex-col items-end gap-1">
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300">{visit.time}</p>
                {visit.status === 'completed' ? (
                  <div className="flex items-center justify-end gap-1 mt-1 text-[10px] uppercase tracking-wider font-bold text-emerald-500">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Visited Successfully</span>
                  </div>
                ) : (
                  <button 
                    onClick={() => handleComplete(visit.id)}
                    disabled={loadingId === visit.id}
                    className="px-2 py-1 mt-1 text-[10px] font-bold bg-emerald-500 hover:bg-emerald-600 text-white rounded uppercase tracking-wider disabled:opacity-50 transition-colors"
                  >
                    {loadingId === visit.id ? 'Updating...' : 'Mark Visited'}
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function MaterialRequirementsWidget({ materials, activeProjects = [] }: { materials: any[], activeProjects?: any[] }) {
  const router = useRouter();
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const handleSubmitToCompany = async (id: string) => {
    setSubmittingId(id);
    const res = await submitMaterialToCompanyAction(id);
    setSubmittingId(null);
    if (res.success) {
      router.refresh();
    } else {
      alert("Failed to submit material: " + res.error);
    }
  };

  const inPossessionCount = materials.filter(m => m.status === 'assigned' || m.status === 'requested').length;

  return (
    <div className="glass-card border-slate-200/60 dark:border-white/10 p-5 space-y-4 rounded-3xl shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
            <Package className="w-4 h-4" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-900 dark:text-white">Assigned Equipment & Materials</h3>
            <p className="text-[10px] text-slate-400">Allocated for active fieldwork</p>
          </div>
        </div>
        {inPossessionCount > 0 && (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            {inPossessionCount} in possession
          </span>
        )}
      </div>

      <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
        {materials.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            <Package className="w-6 h-6 mx-auto mb-1.5 opacity-40" />
            No equipment or materials currently assigned to your projects.
          </div>
        ) : (
          materials.map((mat, idx) => {
            const isSubmitted = mat.status === 'submitted' || mat.status === 'returned';
            return (
              <div
                key={mat.id || idx}
                className="p-3 rounded-2xl bg-white dark:bg-slate-900/50 border border-slate-200/70 dark:border-white/5 space-y-2 transition-all hover:border-indigo-500/30"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{mat.item}</p>
                    <p className="text-[11px] text-slate-400">{mat.project_name} &bull; Qty: <strong className="text-slate-700 dark:text-slate-300">{mat.quantity}</strong></p>
                    {mat.notes && (
                      <p className="text-[10px] text-slate-500 dark:text-slate-400 italic mt-0.5 truncate">{mat.notes}</p>
                    )}
                  </div>
                  <div className="shrink-0">
                    {isSubmitted ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" />
                        In Company
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        In Field
                      </span>
                    )}
                  </div>
                </div>

                {!isSubmitted && (
                  <button
                    type="button"
                    disabled={submittingId === mat.id}
                    onClick={() => handleSubmitToCompany(mat.id)}
                    className="w-full py-1.5 px-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold transition disabled:opacity-50 flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <CheckCircle2 className="w-3 h-3" />
                    {submittingId === mat.id ? "Submitting..." : "Submit to Company"}
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export function QuickUploadButton() {
  const [isOpen, setIsOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleUpload = () => {
    setUploading(true);
    setTimeout(() => {
      setUploading(false);
      setIsOpen(false);
      alert("File uploaded successfully!");
    }, 1500);
  };

  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="flex items-center justify-center gap-2 w-full p-4 rounded-xl border border-dashed border-sky-500/30 bg-sky-500/5 hover:bg-sky-500/10 text-sky-600 dark:text-sky-400 font-bold transition-all"
      >
        <Upload className="w-5 h-5" />
        Quick Upload (Photos/Reports)
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-md shadow-2xl border border-slate-200 dark:border-white/10 space-y-4">
            <h3 className="text-xl font-black text-slate-900 dark:text-white flex items-center gap-2">
              <Upload className="w-5 h-5 text-sky-500" />
              Upload Field Data
            </h3>
            <p className="text-sm text-slate-500">Select project and attach photos or reports.</p>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 block">Project</label>
                <select className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-transparent text-sm">
                  <option>Select a project...</option>
                  <option>Riverside Complex</option>
                  <option>Downtown Tower</option>
                </select>
              </div>
              
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 block">File</label>
                <div className="border-2 border-dashed border-slate-200 dark:border-white/10 rounded-xl p-8 flex flex-col items-center justify-center gap-2 text-slate-500">
                  <FileText className="w-8 h-8 opacity-50" />
                  <span className="text-sm font-medium">Click to select file</span>
                </div>
              </div>
              
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 block">Notes (Optional)</label>
                <textarea className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-transparent text-sm resize-none" rows={2} placeholder="Add any details here..."></textarea>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4">
              <button 
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 rounded-xl text-sm font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5"
              >
                Cancel
              </button>
              <button 
                onClick={handleUpload}
                disabled={uploading}
                className="px-4 py-2 rounded-xl text-sm font-bold bg-sky-500 text-white hover:bg-sky-600 disabled:opacity-50"
              >
                {uploading ? "Uploading..." : "Upload File"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export function SiteProgressButton({ projectId }: { projectId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  
  return (
    <>
      <button 
        onClick={() => setIsOpen(true)}
        className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 transition-colors tooltip-trigger"
        title="Update Progress"
      >
        <CheckCircle2 className="w-4 h-4" />
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white dark:bg-slate-900 rounded-3xl p-6 w-full max-w-sm shadow-2xl border border-slate-200 dark:border-white/10 space-y-4">
            <h3 className="text-lg font-black text-slate-900 dark:text-white">Update Progress</h3>
            
            <div className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 flex justify-between">
                  <span>Completion</span>
                  <span className="text-emerald-500">75%</span>
                </label>
                <input type="range" min="0" max="100" defaultValue="75" className="w-full mt-2 accent-emerald-500" />
              </div>
              
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300 mb-1 block">Status Update</label>
                <textarea className="w-full p-2.5 rounded-xl border border-slate-200 dark:border-white/10 bg-transparent text-sm resize-none" rows={3} placeholder="What was accomplished today?"></textarea>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button onClick={() => setIsOpen(false)} className="px-3 py-1.5 rounded-lg text-sm font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5">Cancel</button>
              <button onClick={() => setIsOpen(false)} className="px-3 py-1.5 rounded-lg text-sm font-bold bg-emerald-500 text-white hover:bg-emerald-600">Save Update</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
