'use client';

import React, { useState, useEffect, useTransition, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search,
  Download,
  LayoutList,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Select, SelectItem } from '@/components/ui/select';
import { ProjectDeleteButton } from './ProjectDeleteButton';
import {
  getProjectsListAction,
  type ProjectsListPage,
} from '@/actions/project.actions';

export interface Project {
  id: string;
  name: string;
  client_name: string;
  status: string;
  target_completion_date?: string | null;
  created_at: string;
  is_frozen?: boolean;
  client_contact?: string;
  client_address?: string;
  site_type?: string;
  services?: string | string[];
  creator?: { first_name?: string; last_name?: string } | null;
}

interface ProjectsTableProps {
  initialPage: ProjectsListPage;
  userRole?: string;
}

const statusConfig: Record<string, { label: string; dotColor: string; badgeClass: string }> = {
  lead_created:     { label: 'Lead',           dotColor: 'bg-indigo-500',  badgeClass: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/20' },
  payment_pending:  { label: 'Awaiting Payment',dotColor: 'bg-amber-500',   badgeClass: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20' },
  payment_done:     { label: 'Paid',            dotColor: 'bg-emerald-500', badgeClass: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20' },
  project_created:  { label: 'Started',         dotColor: 'bg-purple-500',  badgeClass: 'bg-purple-500/10 text-purple-700 dark:text-purple-300 border-purple-500/20' },
  data_collection:  { label: 'Data Collection', dotColor: 'bg-sky-500',     badgeClass: 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/20' },
  prototype:        { label: 'Prototype',        dotColor: 'bg-orange-500',  badgeClass: 'bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/20' },
  review:           { label: 'Under Review',     dotColor: 'bg-yellow-500',  badgeClass: 'bg-yellow-500/10 text-yellow-700 dark:text-yellow-300 border-yellow-500/20' },
  field_work:       { label: 'Field Work',       dotColor: 'bg-teal-500',    badgeClass: 'bg-teal-500/10 text-teal-700 dark:text-teal-300 border-teal-500/20' },
  data_sync:        { label: 'Data Sync',        dotColor: 'bg-cyan-500',    badgeClass: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 border-cyan-500/20' },
  final_review:     { label: 'Final Review',     dotColor: 'bg-rose-500',    badgeClass: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/20' },
  completed:        { label: 'Completed',        dotColor: 'bg-green-500',   badgeClass: 'bg-green-500/10 text-green-700 dark:text-green-300 border-green-500/20' },
  archived:         { label: 'Archived',         dotColor: 'bg-slate-400',   badgeClass: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20' },
};

const avatarColors = [
  'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/25',
  'bg-violet-500/15 text-violet-700 dark:text-violet-300 border-violet-500/25',
  'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/25',
  'bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/25',
  'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/25',
  'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/25',
];

function getAvatarColor(name: string) {
  const idx = (name?.charCodeAt(0) || 0) % avatarColors.length;
  return avatarColors[idx];
}

export function ProjectsTable({ initialPage, userRole = 'admin' }: ProjectsTableProps) {
  const router = useRouter();
  const pageSize = initialPage.pageSize || 10;

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [clientFilter, setClientFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(initialPage.page || 1);
  const [pageData, setPageData] = useState<ProjectsListPage>(initialPage);
  const [isPending, startTransition] = useTransition();
  const [exporting, setExporting] = useState(false);
  const skipNextFetch = React.useRef(true);

  // Sync initialPage when it changes due to router.refresh() or navigation
  useEffect(() => {
    setPageData(initialPage);
  }, [initialPage]);

  // Debounce search so we don't hit the server on every keystroke; reset page on change
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const fetchPage = useCallback(
    (page: number) => {
      startTransition(async () => {
        const res = await getProjectsListAction({
          page,
          pageSize,
          search: debouncedSearch || undefined,
          status: statusFilter,
          client: clientFilter,
        });
        if (res.success && res.data) {
          setPageData(res.data as ProjectsListPage);
        }
      });
    },
    [pageSize, debouncedSearch, statusFilter, clientFilter]
  );

  // Server pagination: fetch when page/filters change; skip first mount (SSR data)
  useEffect(() => {
    if (skipNextFetch.current) {
      skipNextFetch.current = false;
      return;
    }
    fetchPage(currentPage);
  }, [currentPage, debouncedSearch, statusFilter, clientFilter, fetchPage]);

  const projects = pageData.items || [];
  const total = pageData.total || 0;
  const clients = pageData.clients || [];
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const exportToExcel = async () => {
    try {
      setExporting(true);
      // Fetch up to 500 rows matching current filters (server-side), not only the page
      const res = await getProjectsListAction({
        page: 1,
        pageSize: 500,
        search: debouncedSearch || undefined,
        status: statusFilter,
        client: clientFilter,
      });
      const rows = (res.success && res.data ? (res.data as ProjectsListPage).items : []) as Project[];

      const exportData = rows.map((p: any) => {
        let phone = '';
        let email = '';
        if (p.client_contact) {
          const phoneMatch = p.client_contact.match(/Phone:\s*([^,]+)/i);
          const emailMatch = p.client_contact.match(/Email:\s*(.+)/i);
          if (phoneMatch) phone = phoneMatch[1].trim();
          if (emailMatch) email = emailMatch[1].trim();
          if (!phoneMatch && !emailMatch) phone = p.client_contact;
        }

        return {
          'Project ID': p.id,
          'Project Name': p.name,
          'Client Name': p.client_name,
          'Client Phone': phone,
          'Client Email': email,
          'Client Address': p.client_address || '',
          Status: p.status,
          'Site Type': p.site_type || '',
          Services: Array.isArray(p.services) ? p.services.join(', ') : p.services || '',
          'Created By': p.creator
            ? `${p.creator.first_name || ''} ${p.creator.last_name || ''}`.trim()
            : 'Unknown',
          'Created At': p.created_at ? new Date(p.created_at).toLocaleString() : '',
        };
      });

      const XLSX = await import('xlsx');
      const worksheet = XLSX.utils.json_to_sheet(exportData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Projects');
      XLSX.writeFile(workbook, `Projects_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (err) {
      console.error('Export failed:', err);
      alert('Failed to export Excel file.');
    } finally {
      setExporting(false);
    }
  };

  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const fromRow = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const toRow = Math.min(currentPage * pageSize, total);

  return (
    <div className="glass-card overflow-hidden relative">
      {isPending && (
        <div className="absolute inset-0 z-10 bg-white/40 dark:bg-slate-950/40 backdrop-blur-[1px] flex items-center justify-center pointer-events-none">
          <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
        </div>
      )}

      {/* ── Toolbar ── */}
      <div className="px-6 py-4 border-b border-slate-200/60 dark:border-white/5 flex flex-col sm:flex-row gap-3 sm:items-center justify-between bg-white/50 dark:bg-white/[0.02]">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search projects, IDs, or clients…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/8 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 outline-none transition-all text-xs font-medium placeholder:text-slate-400"
          />
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Select
            value={statusFilter}
            onValueChange={(v) => {
              setStatusFilter(v);
              setCurrentPage(1);
            }}
            className="w-40"
            buttonClassName="h-9 px-3.5"
            placeholder="All Stages"
          >
            <SelectItem value="all">All Stages</SelectItem>
            {userRole === 'sales' ? (
              <>
                <SelectItem value="lead_created">Lead</SelectItem>
                <SelectItem value="requirement_gathering">Followup</SelectItem>
                <SelectItem value="send_to_accountant">Send to Accountant</SelectItem>
              </>
            ) : (
              Object.entries(statusConfig).map(([key, val]) => (
                <SelectItem key={key} value={key}>
                  {val.label}
                </SelectItem>
              ))
            )}
          </Select>

          <Select
            value={clientFilter}
            onValueChange={(v) => {
              setClientFilter(v);
              setCurrentPage(1);
            }}
            className="w-40"
            buttonClassName="h-9 px-3.5"
            placeholder="All Clients"
          >
            <SelectItem value="all">All Clients</SelectItem>
            {clients.map((client: string) => (
              <SelectItem key={client} value={client}>
                {client}
              </SelectItem>
            ))}
          </Select>

          <button
            onClick={exportToExcel}
            disabled={exporting}
            className="flex items-center gap-2 px-3.5 py-2 h-9 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md shadow-indigo-500/20 transition-all active:scale-95 disabled:opacity-60"
          >
            {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
            Export Excel
          </button>
        </div>
      </div>

      {/* ── Table ── */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[700px]">
          <thead>
            <tr className="border-b border-slate-100 dark:border-white/5 bg-slate-50/20 dark:bg-white/[0.01]">
              <th className="px-6 py-3.5 text-xs font-bold text-slate-400 dark:text-slate-500">Project</th>
              <th className="px-6 py-3.5 text-xs font-bold text-slate-400 dark:text-slate-500">Status</th>
              <th className="px-6 py-3.5 text-xs font-bold text-slate-400 dark:text-slate-500">Client</th>
              <th className="px-6 py-3.5 text-xs font-bold text-slate-400 dark:text-slate-500">Created</th>
              <th className="px-4 py-3.5" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
            {projects.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-24 text-center">
                  <div className="flex flex-col items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-white/5 flex items-center justify-center">
                      <LayoutList className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-400 dark:text-slate-500">No projects found</p>
                      <p className="text-xs text-slate-400 dark:text-slate-600 mt-1">
                        Try adjusting your search or filter criteria.
                      </p>
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              projects.map((project: any) => {
                const status = statusConfig[project.status];
                return (
                  <tr
                    key={project.id}
                    onClick={() => {
                      if (userRole === 'sales') return;
                      router.push(`/projects/${project.id}`);
                    }}
                    className={cn(
                      'group border-b border-slate-50 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors',
                      userRole === 'sales' ? '' : 'cursor-pointer'
                    )}
                  >
                    <td className="px-6 py-3.5">
                      <div className="font-medium text-slate-800 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors leading-snug">
                        {project.name}
                      </div>
                      <div className="text-xs nums text-slate-400 mt-0.5">{project.id}</div>
                    </td>

                    <td className="px-6 py-3.5">
                      {userRole === 'sales' ? (
                        (() => {
                          const isLead = ['lead_created', 'requirement_gathering', 'follow_up_pending'].includes(
                            project.status
                          );
                          if (isLead) {
                            return (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border bg-slate-100 dark:bg-white/5 text-slate-500 border-slate-200 dark:border-white/10">
                                <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                Lead
                              </span>
                            );
                          }
                          return (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                              <span className="text-[10px] font-bold mr-0.5 text-emerald-500">✓</span>
                              Payment Pending
                            </span>
                          );
                        })()
                      ) : (
                        <span
                          className={cn(
                            'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border',
                            status?.badgeClass || 'bg-slate-100 text-slate-600 border-slate-200'
                          )}
                        >
                          <span className={cn('w-1.5 h-1.5 rounded-full', status?.dotColor || 'bg-slate-400')} />
                          {status?.label || project.status}
                        </span>
                      )}
                      {project.is_frozen && (
                        <span className="ml-2 inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20">
                          <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
                          On Hold
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-2">
                        <div
                          className={cn(
                            'w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black border flex-shrink-0',
                            getAvatarColor(project.client_name || '?')
                          )}
                        >
                          {(project.client_name || '?').charAt(0).toUpperCase()}
                        </div>
                        <span className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate max-w-[140px]">
                          {project.client_name}
                        </span>
                      </div>
                    </td>

                    <td className="px-6 py-3.5">
                      <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                        {formatDate(project.created_at)}
                      </span>
                    </td>

                    <td className="px-4 py-4 text-right">
                      <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
                        <ProjectDeleteButton
                          projectId={project.id}
                          iconOnly
                          disabled={!['admin', 'accountant'].includes(userRole)}
                        />
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Footer ── */}
      {total > 0 && (
        <div className="px-6 py-3 border-t border-slate-100 dark:border-white/5 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-50/50 dark:bg-white/[0.01]">
          <p className="text-xs text-slate-400 font-medium">
            Showing{' '}
            <span className="font-bold text-slate-600 dark:text-slate-300">{fromRow}</span> to{' '}
            <span className="font-bold text-slate-600 dark:text-slate-300">{toRow}</span> of{' '}
            <span className="font-bold text-slate-600 dark:text-slate-300">{total}</span> projects
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1 || isPending}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-white/10 transition-colors"
            >
              Previous
            </button>
            <span className="text-xs text-slate-500 font-medium px-2">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages || isPending}
              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50 dark:hover:bg-white/10 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProjectsTable;
