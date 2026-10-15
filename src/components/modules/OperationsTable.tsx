'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Search, 
  ChevronRight, 
  User, 
  Activity,
  CheckCircle2,
  Clock,
  Hammer,
  MapPin,
  ClipboardCheck
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface OperationsTableProps {
  initialProjects: any[];
}

const operationalStages = [
  'project_created',
  'data_collection',
  'field_work',
  'data_sync',
  'final_review'
];

const stageConfig: Record<string, { label: string; icon: any; color: string }> = {
  project_created: { label: 'Initiated', icon: Activity, color: 'text-indigo-500 bg-indigo-500/10' },
  data_collection: { label: 'Data Collection', icon: Hammer, color: 'text-sky-500 bg-sky-500/10' },
  field_work: { label: 'Field Ops', icon: MapPin, color: 'text-teal-500 bg-teal-500/10' },
  data_sync: { label: 'Syncing', icon: Activity, color: 'text-cyan-500 bg-cyan-500/10' },
  final_review: { label: 'Final QC', icon: ClipboardCheck, color: 'text-rose-500 bg-rose-500/10' },
  completed: { label: 'Delivered', icon: CheckCircle2, color: 'text-emerald-500 bg-emerald-500/10' },
  delivered: { label: 'Delivered', icon: CheckCircle2, color: 'text-emerald-500 bg-emerald-500/10' },
  payment_done: { label: 'Ready', icon: Clock, color: 'text-slate-500 bg-slate-500/10' },
};

export function OperationsTable({ initialProjects }: OperationsTableProps) {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const filteredProjects = useMemo(() => {
    return initialProjects.filter((project: any) => {
      const matchesSearch = 
        project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        project.client_name.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = statusFilter === 'all' || project.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [initialProjects, searchTerm, statusFilter]);

  const getAssignment = (project: any, role: string) => {
    return project.project_assignments?.find((a: any) => a.role === role);
  };

  const getFileStatus = (project: any, category: string) => {
    return project.files?.some((f: any) => f.category === category);
  };

  return (
    <div className="space-y-6">
      {/* Search and Filters Bar */}
      <div className="flex flex-col lg:flex-row gap-4 items-center justify-between px-2">
        <div className="relative w-full lg:max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search active operations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-11 pr-4 py-2.5 rounded-2xl bg-white/50 dark:bg-black/20 border border-white/40 dark:border-white/10 focus:ring-2 focus:ring-indigo-500 outline-none transition-all text-sm"
          />
        </div>

        <div className="flex items-center gap-3 w-full lg:w-auto overflow-x-auto pb-1 no-scrollbar">
           <button 
             onClick={() => setStatusFilter('all')}
             className={cn(
               "px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap",
               statusFilter === 'all' ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20" : "bg-white/50 dark:bg-white/5 text-slate-500 hover:bg-white/80 dark:hover:bg-white/10"
             )}
           >
             All Projects
           </button>
           {operationalStages.map((stage: any) => (
             <button 
               key={stage}
               onClick={() => setStatusFilter(stage)}
               className={cn(
                 "px-4 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap",
                 statusFilter === stage ? "bg-indigo-600 text-white shadow-lg shadow-indigo-500/20" : "bg-white/50 dark:bg-white/5 text-slate-500 hover:bg-white/80 dark:hover:bg-white/10"
               )}
             >
               {stageConfig[stage]?.label || stage.replace('_', ' ')}
             </button>
           ))}
        </div>
      </div>

      {/* Operations Table Container */}
      <div className="glass-card shadow-lg bg-gradient-to-br from-white/95 to-slate-50/50 dark:from-slate-900/40 dark:to-slate-900/10 overflow-hidden relative border-slate-200 dark:border-white/10">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[1100px]">
            <thead>
              <tr className="bg-white/40 dark:bg-white/5 backdrop-blur-md border-b border-gray-200/50 dark:border-gray-700/50 text-xs font-black text-slate-400 uppercase tracking-[0.2em]">
                <th className="px-8 py-6">Project & Stage</th>
                <th className="px-6 py-6 text-center">Engineering</th>
                <th className="px-6 py-6 text-center">Field Ops</th>
                <th className="px-6 py-6 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200/30 dark:divide-white/5">
              {filteredProjects.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-32 text-center">
                    <div className="flex flex-col items-center justify-center space-y-4">
                      <div className="w-20 h-20 rounded-full bg-slate-500/5 flex items-center justify-center">
                        <Activity className="w-10 h-10 text-slate-500/20" />
                      </div>
                      <p className="text-xs font-black uppercase tracking-widest text-slate-400">No projects in this pipeline</p>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredProjects.map((project) => {
                  const StageIcon = stageConfig[project.status]?.icon || Activity;
                  const engineer = getAssignment(project, 'engineer');
                  const field = getAssignment(project, 'field');

                  return (
                    <tr 
                      key={project.id}
                      onClick={() => router.push(`/projects/${project.id}`)}
                      className="group cursor-pointer hover:bg-white/50 dark:hover:bg-white/5 transition-all duration-500"
                    >
                      <td className="px-8 py-6">
                        <div className="flex flex-col gap-3">
                          <div>
                            <div className="text-sm font-black text-slate-900 dark:text-white group-hover:text-indigo-600 transition-colors">
                              {project.name}
                            </div>
                            <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                              {project.client_name}
                            </div>
                          </div>
                          <div className={cn(
                            "flex items-center gap-2 px-3 py-1 rounded-full text-xs font-black uppercase tracking-widest border border-current w-fit",
                            stageConfig[project.status]?.color || 'text-slate-500 bg-slate-500/10'
                          )}>
                            <StageIcon className="w-3 h-3" />
                            {stageConfig[project.status]?.label || project.status.replace('_', ' ')}
                          </div>
                        </div>
                      </td>

                      {/* Engineering Column */}
                      <td className="px-6 py-6">
                        <div className="flex flex-col items-center gap-2">
                           {engineer ? (
                             <>
                               <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20">
                                 <span className="text-xs font-bold text-indigo-600">{engineer.profiles.first_name[0]}{engineer.profiles.last_name[0]}</span>
                               </div>
                               <span className="text-xs font-bold text-slate-600 dark:text-slate-400">{engineer.profiles.first_name}</span>
                             </>
                           ) : (
                             <div className="w-10 h-10 rounded-full border-2 border-dashed border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-300">
                               <User className="w-4 h-4" />
                             </div>
                           )}
                        </div>
                      </td>

                      {/* Field Ops Column */}
                      <td className="px-6 py-6">
                        <div className="flex flex-col items-center gap-2">
                           {field ? (
                             <>
                               <div className="w-10 h-10 rounded-full bg-sky-500/10 flex items-center justify-center border border-sky-500/20">
                                 <span className="text-xs font-bold text-sky-600">{field.profiles.first_name[0]}{field.profiles.last_name[0]}</span>
                               </div>
                               <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-bold text-slate-600 dark:text-slate-400">{field.profiles.first_name}</span>
                                  {getFileStatus(project, 'survey_data') && <CheckCircle2 className="w-3 h-3 text-emerald-500" />}
                               </div>
                             </>
                           ) : (
                             <div className="w-10 h-10 rounded-full border-2 border-dashed border-slate-200 dark:border-white/10 flex items-center justify-center text-slate-300">
                               <MapPin className="w-4 h-4" />
                             </div>
                           )}
                        </div>
                      </td>

                      <td className="px-8 py-6 text-right">
                        <div className="flex justify-end opacity-0 group-hover:opacity-100 transition-all duration-300">
                           <div className="p-3 rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-500/20 scale-90 group-hover:scale-100 transition-transform">
                             <ChevronRight className="w-5 h-5" />
                           </div>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
