"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Plus, Printer, Calendar, User, FileText, IndianRupee, Copy, Eye } from "lucide-react";
import { PageHeader } from "@/components/modules/PageHeader";
import NewPrintJobDialog from "./NewPrintJobDialog";
import ReceiptViewModal from "./ReceiptViewModal";

export default function PrintDeskClient({ 
  initialJobs, 
  userRole, 
  projects, 
  urlPrefill 
}: { 
  initialJobs: any[]; 
  userRole: string; 
  projects: any[]; 
  urlPrefill?: any; 
}) {
  const [jobs, setJobs] = useState<any[]>(initialJobs);
  const [isNewJobOpen, setIsNewJobOpen] = useState(!!urlPrefill?.projectId || !!urlPrefill?.clientName);
  const [receiptModalJob, setReceiptModalJob] = useState<any | null>(null);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const indexOfLastJob = currentPage * itemsPerPage;
  const indexOfFirstJob = indexOfLastJob - itemsPerPage;
  const currentJobs = jobs.slice(indexOfFirstJob, indexOfLastJob);
  const totalPages = Math.ceil(jobs.length / itemsPerPage);

  return (
    <div className="space-y-4">
      <PageHeader 
        title={<span className="text-3xl font-extrabold tracking-tight text-slate-900">Print <span className="text-indigo-600">Desk</span></span>} 
        subtitle={<span className="text-base text-slate-500 font-medium">Walk-in and project print jobs</span>} 
        icon={Printer}
        className="pb-4"
        actions={
          <button
            onClick={() => setIsNewJobOpen(true)}
            className="flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm"
          >
            <Plus className="h-4 w-4" />
            <span>New Print Job</span>
          </button>
        }
      />

      <div className="bg-white border border-slate-200 shadow-sm rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left text-slate-600">
            <thead className="text-xs text-slate-500 uppercase bg-slate-50/80 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 font-semibold text-slate-600">
                  <div className="flex items-center gap-2"><Calendar className="w-4 h-4 text-slate-400" /> ID / Date</div>
                </th>
                <th className="px-6 py-4 font-semibold text-slate-600">
                  <div className="flex items-center gap-2"><User className="w-4 h-4 text-slate-400" /> Client</div>
                </th>
                <th className="px-6 py-4 font-semibold text-slate-600">
                  <div className="flex items-center gap-2"><FileText className="w-4 h-4 text-slate-400" /> Details</div>
                </th>
                <th className="px-6 py-4 font-semibold text-slate-600">
                  <div className="flex items-center gap-2"><Copy className="w-4 h-4 text-slate-400" /> Copies</div>
                </th>
                <th className="px-6 py-4 font-semibold text-slate-600">
                  <div className="flex items-center gap-2"><IndianRupee className="w-4 h-4 text-slate-400" /> Amount</div>
                </th>
                <th className="px-6 py-4 font-semibold text-slate-600 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {currentJobs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-slate-500 bg-slate-50/50">
                    <div className="flex flex-col items-center justify-center space-y-3">
                      <Printer className="w-8 h-8 text-slate-300" />
                      <p className="text-sm font-medium text-slate-500">No print jobs found.</p>
                    </div>
                  </td>
                </tr>
              ) : currentJobs.map((job) => (
                <tr key={job.id} className="hover:bg-indigo-50/30 transition-colors group">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-semibold text-slate-900 group-hover:text-indigo-600 transition-colors">{job.id}</div>
                    <div className="text-xs text-slate-500 font-medium">{job.created_at ? format(new Date(job.created_at), "MMM d, yyyy") : "N/A"}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-semibold text-slate-800">{job.client_name}</div>
                    {job.client_phone && <div className="text-xs text-slate-500 font-medium">{job.client_phone}</div>}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-slate-700 truncate max-w-[200px]" title={job.file_name || "N/A"}>
                      {job.file_name || "Walk-in Document"}
                    </div>
                    <div className="text-[11px] text-slate-600 mt-1 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 font-medium">
                      {job.paper_size} {job.print_type?.toUpperCase() || "N/A"}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-semibold text-slate-700 bg-slate-50 px-2.5 py-1 rounded-md inline-block border border-slate-200">
                      {job.copies}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md inline-block border border-emerald-100 shadow-sm">
                      ₹{job.amount?.toLocaleString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center space-x-2">
                    {job.status !== 'cancelled' && (
                      <div className="flex items-center justify-center gap-3">
                        <button 
                          onClick={() => setReceiptModalJob(job)} 
                          className="h-8 px-4 rounded-full text-xs font-semibold bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition-all active:scale-95 flex items-center justify-center gap-1.5 whitespace-nowrap"
                          title="View receipt"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View receipt
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-slate-200 bg-slate-50">
            <div className="text-sm text-slate-500">
              Showing <span className="font-medium text-slate-900">{indexOfFirstJob + 1}</span> to <span className="font-medium text-slate-900">{Math.min(indexOfLastJob, jobs.length)}</span> of <span className="font-medium text-slate-900">{jobs.length}</span> results
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Previous
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      <NewPrintJobDialog
        isOpen={isNewJobOpen}
        onClose={() => setIsNewJobOpen(false)}
        projects={projects}
        urlPrefill={urlPrefill}
        onSuccess={(newJob) => setJobs([newJob, ...jobs])}
      />

      {receiptModalJob && (
        <ReceiptViewModal
          isOpen={!!receiptModalJob}
          onClose={() => setReceiptModalJob(null)}
          job={receiptModalJob}
        />
      )}
    </div>
  );
}
