'use client';

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
  User,
  Phone,
  MapPin,
  ExternalLink,
  Search,
  X,
  Calendar,
  FolderOpen,
  CheckCircle2,
  Clock,
  Building,
  ChevronRight,
  Grid,
  List,
  ArrowUpDown,
  Mail,
  UserCheck,
  Edit3,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { updateClientDetailsAction } from '../actions';
import { adminHardDeleteProjectAction, adminHardDeleteClientAction } from '@/actions/project.actions';
import { useToast } from '@/hooks/use-toast';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogFooter,
  AlertDialogAction,
  AlertDialogCancel
} from '@/components/ui/alert-dialog';

interface ProjectItem {
  id: string;
  name: string;
  status: string;
  stage: string;
  created_at: string;
}

interface Client {
  client_name: string;
  client_contact: string;
  client_address: string;
  created_at: string;
  projects: ProjectItem[];
}

interface ClientDirectoryProps {
  clients: Client[];
  userRole: string;
}

export function ClientDirectory({ clients, userRole }: ClientDirectoryProps) {
  const router = useRouter();
  const [localClients, setLocalClients] = React.useState(clients);
  React.useEffect(() => setLocalClients(clients), [clients]);

  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [filter, setFilter] = useState<'all' | 'active' | 'completed' | 'none'>('all');
  const [sortBy, setSortBy] = useState<'name-asc' | 'name-desc' | 'projects-desc' | 'recent'>('name-asc');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editForm, setEditForm] = useState({ client_name: '', client_contact: '', client_address: '' });
  const { toast } = useToast();

  // Delete confirmation dialog state
  type DeleteTarget = { type: 'project'; id: string; name: string } | { type: 'client'; name: string } | null;
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleEditClick = () => {
    if (selectedClient) {
      setEditForm({
        client_name: selectedClient.client_name,
        client_contact: selectedClient.client_contact,
        client_address: selectedClient.client_address
      });
      setIsEditing(true);
    }
  };

  const handleSaveClick = async () => {
    if (!selectedClient) return;
    setIsSaving(true);
    const res = await updateClientDetailsAction(selectedClient.client_name, editForm);
    setIsSaving(false);
    if (res.success) {
      const updated = { ...selectedClient, ...editForm };
      setSelectedClient(updated);
      setLocalClients(prev => prev.map(c => c.client_name === selectedClient.client_name ? updated : c));
      setIsEditing(false);
    } else {
      toast({ title: "Update Failed", description: res.error || "Failed to update client details.", variant: "error" });
    }
  };

  const handleCloseModal = () => {
    setSelectedClient(null);
    setIsEditing(false);
  };

  const handleDeleteProject = (projectId: string, projectName: string) => {
    setDeleteTarget({ type: 'project', id: projectId, name: projectName });
  };

  const handleDeleteClient = (clientName: string) => {
    setDeleteTarget({ type: 'client', name: clientName });
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    if (deleteTarget.type === 'project') {
      const res = await adminHardDeleteProjectAction(deleteTarget.id);
      if (res.success) {
        toast({ title: "Project Deleted", description: `"${deleteTarget.name}" and all related data have been permanently removed.` });
        if (selectedClient) {
          const newSelected = {
            ...selectedClient,
            projects: selectedClient.projects.filter((p: any) => p.id !== (deleteTarget as any).id)
          };
          setSelectedClient(newSelected);
          setLocalClients(prev => prev.map(c => 
            c.client_name === selectedClient.client_name ? newSelected : c
          ));
        }
      } else {
        toast({ title: "Delete Failed", description: res.error || "Failed to delete project.", variant: "error" });
      }
    } else {
      const res = await adminHardDeleteClientAction(deleteTarget.name);
      if (res.success) {
        toast({ title: "Client Deleted", description: `"${deleteTarget.name}" and all their projects have been permanently removed.` });
        handleCloseModal();
        setLocalClients(prev => prev.filter(c => c.client_name !== deleteTarget.name));
      } else {
        toast({ title: "Delete Failed", description: res.error || "Failed to delete client.", variant: "error" });
      }
    }
    setIsDeleting(false);
    setDeleteTarget(null);
  };

  const parseContact = (contact: string) => {
    const parts = contact.split(/,\s*Email:\s*|,\s*Email:|,/i);
    const phone = parts[0]?.replace(/Phone:\s*/i, '').trim() || contact;
    const email = parts[1]?.trim() || '';
    return { phone, email };
  };

  const statusColors: Record<string, string> = {
    lead_created: "text-indigo-500 bg-indigo-500/10 border-indigo-500/20",
    payment_pending: "text-amber-500 bg-amber-500/10 border-amber-500/20",
    payment_done: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20",
    project_created: "text-cyan-500 bg-cyan-500/10 border-cyan-500/20",
    data_collection: "text-violet-500 bg-violet-500/10 border-violet-500/20",
    prototype: "text-purple-500 bg-purple-500/10 border-purple-500/20",
    review: "text-orange-500 bg-orange-500/10 border-orange-500/20",
    field_work: "text-sky-500 bg-sky-500/10 border-sky-500/20",
    completed: "text-emerald-600 bg-indigo-600/10 border-emerald-600/20",
    archived: "text-slate-500 bg-slate-500/10 border-slate-500/20",
  };

  const getStatusLabel = (status: string) => {
    return status.split('_').map((w: any) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  const filteredClients = localClients
    .filter((c: any) => {
      const nameMatch = c.client_name.toLowerCase().includes(search.toLowerCase());
      const contactMatch = c.client_contact.toLowerCase().includes(search.toLowerCase());
      const searchMatch = nameMatch || contactMatch;

      if (!searchMatch) return false;

      const projects = c.projects || [];
      const ongoing = projects.filter((p: any) => p.status !== 'completed' && p.status !== 'archived');
      const completed = projects.filter((p: any) => p.status === 'completed' || p.status === 'archived');

      if (filter === 'active') return ongoing.length > 0;
      if (filter === 'completed') return completed.length > 0;
      if (filter === 'none') return projects.length === 0;
      return true;
    })
    .sort((a: any, b: any) => {
      if (sortBy === 'name-asc') {
        return a.client_name.localeCompare(b.client_name);
      }
      if (sortBy === 'name-desc') {
        return b.client_name.localeCompare(a.client_name);
      }
      if (sortBy === 'projects-desc') {
        return (b.projects?.length || 0) - (a.projects?.length || 0);
      }
      if (sortBy === 'recent') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      return 0;
    });

  return (
    <div className="space-y-6">
      {/* ── Minimalist Filter Control Deck ── */}
      <div className="glass-card p-3 flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-slate-200/60 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.01]">

        {/* Left Side: Search & Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 xl:gap-4 flex-1">
          {/* Search Field */}
          <div className="relative group w-full sm:w-80 lg:w-96 shrink-0">
            <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none">
              <Search className="w-4 h-4 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
            </div>
            <input
              type="text"
              placeholder="Search clients by name or contact..."
              className="w-full bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/5 rounded-xl py-2 pl-10 pr-4 text-sm font-medium focus:outline-none focus:border-indigo-550 transition-all text-slate-800 dark:text-slate-100 placeholder-slate-400"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Minimal Filters Chips */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${filter === 'all'
                  ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-600 dark:text-indigo-400'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-white/5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'
                }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('active')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${filter === 'active'
                  ? 'bg-blue-500/10 border-blue-500/20 text-blue-600 dark:text-blue-400'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-white/5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'
                }`}
            >
              Active
            </button>
            <button
              onClick={() => setFilter('completed')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${filter === 'completed'
                  ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-white/5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'
                }`}
            >
              Completed
            </button>
            <button
              onClick={() => setFilter('none')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all border ${filter === 'none'
                  ? 'bg-amber-500/10 border-amber-500/20 text-amber-600 dark:text-amber-400'
                  : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-white/5 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5'
                }`}
            >
              No Projects
            </button>
          </div>
        </div>

        {/* Right Side: Sorting & View Toggle */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end shrink-0 pt-3 xl:pt-0 border-t xl:border-none border-slate-100 dark:border-white/5">
          {/* Sort Dropdown */}
          <div className="relative flex items-center">
            <span className="text-xs font-semibold text-slate-400 flex items-center gap-1 mr-1">
              <ArrowUpDown className="w-3.5 h-3.5" />
            </span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as any)}
              className="bg-white dark:bg-slate-900 border border-slate-200/60 dark:border-white/5 text-xs font-semibold text-slate-600 dark:text-slate-300 px-3 py-1.5 rounded-xl focus:outline-none cursor-pointer appearance-none pr-8 relative"
              style={{
                backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 8px center',
                backgroundSize: '12px'
              }}
            >
              <option value="name-asc" className="dark:bg-slate-950">A-Z</option>
              <option value="name-desc" className="dark:bg-slate-950">Z-A</option>
              <option value="projects-desc" className="dark:bg-slate-950">Most Projects</option>
              <option value="recent" className="dark:bg-slate-950">Recent</option>
            </select>
          </div>

          <div className="w-px h-5 bg-slate-200 dark:bg-white/10 hidden sm:block" />

          {/* Grid/List View Toggle */}
          <div className="flex bg-slate-100 dark:bg-white/5 p-0.5 rounded-lg shrink-0">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md transition-all ${viewMode === 'grid'
                  ? 'bg-white dark:bg-white/10 text-indigo-500 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400'
                }`}
              title="Grid"
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-md transition-all ${viewMode === 'list'
                  ? 'bg-white dark:bg-white/10 text-indigo-500 shadow-sm'
                  : 'text-slate-500 dark:text-slate-400'
                }`}
              title="List"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
      {/* ── Main Clients Container ── */}
      {viewMode === 'grid' ? (
        /* GRID VIEW LAYOUT (Minimalist Cards) */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredClients.map((client, i) => {
            const projects = client.projects || [];
            const ongoing = projects.filter((p: any) => p.status !== 'completed' && p.status !== 'archived');
            const completed = projects.filter((p: any) => p.status === 'completed' || p.status === 'archived');

            return (
              <div
                key={i}
                onClick={() => setSelectedClient(client)}
                className="group bg-white dark:bg-slate-900/40 p-4 border border-slate-200 dark:border-white/5 rounded-2xl hover:border-indigo-500/30 hover:shadow-xl hover:shadow-indigo-500/5 transition-all duration-300 cursor-pointer flex flex-col justify-between"
              >
                <div className="flex flex-col">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-lg group-hover:scale-105 transition-transform shrink-0">
                        {client.client_name[0]?.toUpperCase()}
                      </div>
                      <h3 className="text-base font-bold text-slate-900 dark:text-white group-hover:text-indigo-500 transition-colors line-clamp-1" title={client.client_name}>
                        {client.client_name}
                      </h3>
                    </div>
                    <Badge variant="outline" className="bg-emerald-500/5 text-emerald-600 border-emerald-500/20 font-bold uppercase tracking-widest text-[8px] px-1.5 py-0.5 shrink-0 ml-2 mt-1">
                      Active
                    </Badge>
                  </div>

                  <div className="space-y-2 mt-4 bg-slate-50/50 dark:bg-white/[0.02] p-3 rounded-xl border border-slate-100 dark:border-white/5">
                    <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400" title={client.client_contact}>
                      <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      <span className="truncate">{client.client_contact.split(',')[0]}</span>
                    </div>
                    <div className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400" title={client.client_address}>
                      <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <span className="line-clamp-1">{client.client_address}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-3">
                    <div className="flex-1 flex items-center gap-1.5 bg-indigo-500/5 border border-indigo-500/10 px-2 py-1.5 rounded-lg justify-center">
                      <Clock className="w-3 h-3 text-indigo-500" />
                      <span className="text-[10px] font-semibold text-indigo-600 dark:text-indigo-400">{ongoing.length} Ongoing</span>
                    </div>
                    {completed.length > 0 && (
                      <div className="flex-1 flex items-center gap-1.5 bg-emerald-500/5 border border-emerald-500/10 px-2 py-1.5 rounded-lg justify-center">
                        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                        <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">{completed.length} Done</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-200/50 dark:border-white/5 flex items-center justify-between">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedClient(client);
                    }}
                    className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-500 transition-colors flex items-center gap-1.5"
                  >
                    View File
                    <ExternalLink className="w-3 h-3" />
                  </button>
                  <div className="text-[10px] text-slate-400 dark:text-slate-500 font-bold">
                    Since {new Date(client.created_at).getFullYear()}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* LIST VIEW LAYOUT (Minimalist Clean Table) */
        <div className="glass-card overflow-hidden border-slate-200/60 dark:border-white/5">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-white/[0.02] border-b border-slate-200/60 dark:border-white/5">
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-450">Client Identity</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-450">Contact & Address</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-450">Project Portfolio</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-450">Partnership Since</th>
                  <th className="px-6 py-4 text-xs font-bold uppercase tracking-wider text-slate-450 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200/60 dark:divide-white/5">
                {filteredClients.map((client, i) => {
                  const projects = client.projects || [];
                  const ongoing = projects.filter((p: any) => p.status !== 'completed' && p.status !== 'archived');
                  const completed = projects.filter((p: any) => p.status === 'completed' || p.status === 'archived');

                  return (
                    <tr
                      key={i}
                      onClick={() => setSelectedClient(client)}
                      className="group hover:bg-slate-50/40 dark:hover:bg-white/[0.01] transition-all cursor-pointer"
                    >
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-lg shrink-0">
                            {client.client_name[0]}
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-900 dark:text-white text-sm group-hover:text-indigo-500 transition-colors">
                              {client.client_name}
                            </h4>
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[8px] font-bold uppercase tracking-wider mt-0.5">
                              Active Partner
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            {client.client_contact}
                          </p>
                          <p className="text-xs text-slate-450 flex items-center gap-1.5 max-w-xs truncate">
                            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            {client.client_address}
                          </p>
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-indigo-500/5 text-indigo-600 dark:text-indigo-400 text-[10px] font-semibold border border-indigo-500/10">
                            <Clock className="w-3.5 h-3.5" />
                            {ongoing.length} Active
                          </span>
                          {completed.length > 0 && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-500/5 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold border border-emerald-500/10">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              {completed.length} Completed
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-4">
                        <span className="text-sm text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                          <Calendar className="w-4 h-4 text-indigo-500" />
                          {new Date(client.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })}
                        </span>
                      </td>

                      <td className="px-6 py-4 text-right">
                        <button className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-slate-500 dark:text-slate-400 transition-all inline-flex items-center justify-center">
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Empty State ── */}
      {filteredClients.length === 0 && (
        <div className="text-center py-20 bg-slate-50/50 dark:bg-white/[0.01] rounded-[2rem] border border-dashed border-slate-200 dark:border-white/5">
          <User className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
          <h4 className="text-sm font-bold text-slate-800 dark:text-slate-350">No clients found matching your search.</h4>
        </div>
      )}
      {/* ── Custom Theme UI Details Modal ── */}
      {selectedClient && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-[9999] bg-slate-100/95 dark:bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200"
          onClick={handleCloseModal}
        >
          <div
            className="w-full max-w-3xl bg-white dark:bg-slate-950 rounded-[2rem] shadow-2xl border border-slate-200/60 dark:border-white/[0.08] flex flex-col max-h-[90vh] overflow-y-auto animate-in zoom-in-95 slide-in-from-bottom-6 duration-300 custom-scrollbar"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-7 pt-7 pb-5 border-b border-slate-150 dark:border-white/[0.06] shrink-0">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 text-xl font-bold">
                  {selectedClient.client_name[0]}
                </div>
                <div>
                  {isEditing ? (
                    <input
                      type="text"
                      className="text-xl font-bold text-slate-900 dark:text-white tracking-tight leading-none bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-lg px-2 py-1 outline-none focus:border-indigo-500 min-w-[250px]"
                      value={editForm.client_name}
                      onChange={(e) => setEditForm({ ...editForm, client_name: e.target.value })}
                    />
                  ) : (
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight leading-none">
                      {selectedClient.client_name}
                    </h3>
                  )}
                  <p className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mt-1.5 flex items-center gap-1.5">
                    <Building className="w-3.5 h-3.5 text-indigo-500" />
                    Client Relationship Profile
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isEditing ? (
                  <>
                    <button
                      onClick={() => setIsEditing(false)}
                      className="px-4 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-white/5 dark:text-slate-400 dark:hover:bg-white/10 text-xs font-bold transition-all flex items-center gap-1.5"
                      disabled={isSaving}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSaveClick}
                      className="px-4 h-9 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
                      disabled={isSaving}
                    >
                      {isSaving ? <span className="animate-pulse">Saving...</span> : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Save
                        </>
                      )}
                    </button>
                  </>
                ) : (
                  <>
                    {userRole === 'admin' && (
                      <button
                        onClick={() => handleDeleteClient(selectedClient.client_name)}
                        className="px-4 h-9 rounded-xl bg-red-50/50 hover:bg-red-100 text-red-600 dark:bg-red-500/10 dark:text-red-400 dark:hover:bg-red-500/20 text-xs font-bold transition-all flex items-center gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete Client
                      </button>
                    )}
                    <button
                      onClick={handleEditClick}
                      className="px-4 h-9 rounded-xl bg-indigo-50/50 hover:bg-indigo-100 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400 dark:hover:bg-indigo-500/20 text-xs font-bold transition-all flex items-center gap-1.5"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      Edit Profile
                    </button>
                  </>
                )}
                <button
                  onClick={handleCloseModal}
                  className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-white/5 text-slate-500 hover:text-slate-800 dark:hover:text-white flex items-center justify-center transition-all hover:bg-slate-200 dark:hover:bg-white/10"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Client Info Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 px-7 py-6 border-b border-slate-150 dark:border-white/[0.06]">
              {/* Contact Direct */}
              <div className="space-y-2">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block">Contact Direct</span>
                {isEditing ? (
                  <input
                    type="text"
                    className="w-full text-sm font-semibold text-slate-700 dark:text-slate-350 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-lg px-2 py-1 outline-none focus:border-indigo-500"
                    value={editForm.client_contact}
                    onChange={(e) => setEditForm({ ...editForm, client_contact: e.target.value })}
                  />
                ) : (
                  (() => {
                    const { phone, email } = parseContact(selectedClient.client_contact);
                    return (
                      <div className="space-y-1.5">
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-350 flex items-center gap-2">
                          <Phone className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                          {phone}
                        </p>
                        {email && (
                          <p className="text-sm font-semibold text-slate-700 dark:text-slate-355 flex items-center gap-2">
                            <Mail className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                            {email}
                          </p>
                        )}
                      </div>
                    );
                  })()
                )}
              </div>

              {/* Billing Address */}
              <div className="space-y-2 md:border-l border-slate-150 dark:border-white/[0.06] md:pl-6">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block">Billing / Site Address</span>
                {isEditing ? (
                  <textarea
                    rows={2}
                    className="w-full text-sm font-semibold text-slate-700 dark:text-slate-355 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-lg px-2 py-1 outline-none focus:border-indigo-500 resize-none custom-scrollbar"
                    value={editForm.client_address}
                    onChange={(e) => setEditForm({ ...editForm, client_address: e.target.value })}
                  />
                ) : (
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-355 flex items-start gap-2 leading-relaxed">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0 mt-0.5" />
                    {selectedClient.client_address}
                  </p>
                )}
              </div>

              {/* Partnership Details */}
              <div className="space-y-2 md:border-l border-slate-150 dark:border-white/[0.06] md:pl-6">
                <span className="text-[10px] uppercase tracking-wider text-slate-400 font-bold block">Partnership Details</span>
                <div className="space-y-1.5">
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-350 flex items-center gap-2">
                    <Calendar className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 shrink-0" />
                    {new Date(selectedClient.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                  <div>
                    <Badge variant="outline" className="bg-emerald-500/5 text-emerald-600 border-emerald-500/20 font-bold uppercase tracking-widest text-[8px] px-2 py-0.5">
                      Active Partner
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

            {/* Projects Breakdown */}
            <div className="p-7 space-y-5">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200 flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 text-indigo-500" />
                  Project Portfolio
                </h4>
                <span className="text-[10px] font-bold text-indigo-655 dark:text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-lg border border-indigo-500/10">
                  {selectedClient.projects?.length || 0} Total Projects
                </span>
              </div>

              {/* 2-Column Split Portfolio Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">

                {/* Left Column: Ongoing & Active Projects */}
                <div className="space-y-3">
                  <h5 className="text-[10px] uppercase tracking-widest text-slate-400 font-bold flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-indigo-555" />
                    Ongoing & Active ({selectedClient.projects?.filter((p: any) => p.status !== 'completed' && p.status !== 'archived').length || 0})
                  </h5>

                  <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1 custom-scrollbar">
                    {(selectedClient.projects?.filter((p: any) => p.status !== 'completed' && p.status !== 'archived') || []).map((project) => (
                      <div
                        key={project.id}
                        className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-white/[0.02] hover:bg-slate-100/85 dark:hover:bg-white/[0.05] border border-slate-100 dark:border-white/[0.04] hover:border-indigo-500/20 dark:hover:border-indigo-500/20 transition-all group relative"
                      >
                        <Link
                          href={`/projects/${project.id}`}
                          className="flex-1 min-w-0 pr-2"
                        >
                          <div className="space-y-1">
                            <p className="text-xs font-bold text-slate-800 dark:text-slate-200 group-hover:text-indigo-500 transition-colors truncate">
                              {project.name}
                            </p>
                            <div className="flex items-center gap-1.5 text-[9px] text-slate-400 font-semibold">
                              <span className="truncate">ID: {project.id}</span>
                              <span>•</span>
                              <span>{new Date(project.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}</span>
                            </div>
                          </div>
                        </Link>

                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="outline" className={`${statusColors[project.status]} border font-bold uppercase tracking-widest text-[8px] px-1.5 py-0.5`}>
                            {getStatusLabel(project.status)}
                          </Badge>
                          {userRole === 'admin' ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteProject(project.id, project.name);
                              }}
                              className="p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                              title="Delete Project permanently"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <ChevronRight className="w-3 h-3 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                          )}
                        </div>
                      </div>
                    ))}

                    {selectedClient.projects?.filter((p: any) => p.status !== 'completed' && p.status !== 'archived').length === 0 && (
                      <div className="text-center py-8 rounded-xl border border-dashed border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.01]">
                        <p className="text-xs text-slate-400 italic">No active ongoing projects</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Right Column: Completed / Past Projects */}
                <div className="space-y-3">
                  <h5 className="text-[10px] uppercase tracking-widest text-slate-400 font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                    Completed & Past ({selectedClient.projects?.filter((p: any) => p.status === 'completed' || p.status === 'archived').length || 0})
                  </h5>

                  <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1 custom-scrollbar">
                    {(selectedClient.projects?.filter((p: any) => p.status === 'completed' || p.status === 'archived') || []).map((project) => (
                      <div
                        key={project.id}
                        className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50/30 dark:bg-white/[0.01] hover:bg-slate-100/55 dark:hover:bg-white/[0.03] border border-slate-100 dark:border-white/[0.03] hover:border-emerald-500/20 dark:hover:border-emerald-500/20 transition-all group relative"
                      >
                        <Link
                          href={`/projects/${project.id}`}
                          className="flex-1 min-w-0 pr-2"
                        >
                          <div className="space-y-1">
                            <p className="text-xs font-bold text-slate-755 dark:text-slate-300 group-hover:text-emerald-555 transition-colors truncate">
                              {project.name}
                            </p>
                            <div className="flex items-center gap-1.5 text-[9px] text-slate-400 font-semibold">
                              <span className="truncate">ID: {project.id}</span>
                              <span>•</span>
                              <span>{new Date(project.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}</span>
                            </div>
                          </div>
                        </Link>

                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="outline" className={`${statusColors[project.status]} border font-bold uppercase tracking-widest text-[8px] px-1.5 py-0.5`}>
                            {getStatusLabel(project.status)}
                          </Badge>
                          {userRole === 'admin' ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteProject(project.id, project.name);
                              }}
                              className="p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                              title="Delete Project permanently"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          ) : (
                            <ChevronRight className="w-3 h-3 text-slate-400 group-hover:translate-x-0.5 transition-transform" />
                          )}
                        </div>
                      </div>
                    ))}

                    {selectedClient.projects?.filter((p: any) => p.status === 'completed' || p.status === 'archived').length === 0 && (
                      <div className="text-center py-8 rounded-xl border border-dashed border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.01]">
                        <p className="text-xs text-slate-400 italic">No completed projects yet</p>
                      </div>
                    )}
                  </div>
                </div>

              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-7 py-5 border-t border-slate-150 dark:border-white/[0.06] flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-white/[0.01]">
              <span className="text-[9px] text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5 text-indigo-500" />
                Malee House CRM • Enterprise Database
              </span>
              <button
                onClick={handleCloseModal}
                className="px-5 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-white/5 dark:hover:bg-white/10 text-xs font-bold text-slate-600 dark:text-slate-350 transition-colors"
              >
                Close Profile
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* ── Custom Delete Confirmation Dialog ── */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <AlertDialogContent className="max-w-sm">
          <AlertDialogHeader className="items-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-2 mx-auto">
              <AlertTriangle className="w-7 h-7 text-red-500" />
            </div>
            <AlertDialogTitle className="text-slate-900 dark:text-white text-lg">
              {deleteTarget?.type === 'client' ? 'Delete Client?' : 'Delete Project?'}
            </AlertDialogTitle>
            <div className="text-sm text-slate-500 dark:text-slate-400 mt-1 space-y-2">
              {deleteTarget?.type === 'client' ? (
                <>
                  <p>You are about to permanently delete <span className="font-bold text-slate-700 dark:text-slate-200">&quot;{deleteTarget.name}&quot;</span> and all their projects.</p>
                  <p className="text-xs bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg px-3 py-2 text-red-600 dark:text-red-400 font-medium">
                    All projects, documents, invoices &amp; records will be permanently purged. This cannot be undone.
                  </p>
                </>
              ) : (
                <>
                  <p>You are about to permanently delete <span className="font-bold text-slate-700 dark:text-slate-200">&quot;{deleteTarget?.name}&quot;</span>.</p>
                  <p className="text-xs bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-lg px-3 py-2 text-red-600 dark:text-red-400 font-medium">
                    All documents, comments, invoices &amp; records will be permanently purged. This cannot be undone.
                  </p>
                </>
              )}
            </div>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row justify-center gap-3 pt-2">
            <AlertDialogCancel
              className="flex-1 text-slate-600 dark:text-slate-300"
              disabled={isDeleting}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={isDeleting}
              className="flex-1 bg-red-500 hover:bg-red-600 shadow-red-200/50 flex items-center justify-center gap-1.5"
            >
              {isDeleting ? (
                <span className="animate-pulse">Deleting...</span>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  {deleteTarget?.type === 'client' ? 'Delete Client' : 'Delete Project'}
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
