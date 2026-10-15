"use client";

import React, { useState, useTransition } from "react";
import { 
  File, 
  Image as ImageIcon, 
  FileText, 
  Layers, 
  Download, 
  Trash2, 
  Edit3, 
  FolderOpen,
  Search,
  Loader2
} from "lucide-react";
import { cn } from "@/lib/utils";
import { deleteFileAction, renameFileAction } from "@/actions/vault.actions";
import { useToast } from "@/hooks/use-toast";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from "@/components/ui/dialog";

interface ProjectFile {
  id: string;
  file_name: string;
  category: string;
  file_url: string;
  storage_path: string;
  uploaded_at: string;
  size?: number;
}

interface ProjectFileLibraryProps {
  projectId: string;
  files: ProjectFile[];
}

const CATEGORY_MAP: Record<string, { label: string, icon: any, color: string }> = {
  photos:       { label: "Photos", icon: ImageIcon, color: "text-emerald-500" },
  final_file:   { label: "Deliverables", icon: Layers, color: "text-blue-500" },
  field_notes:  { label: "Field Notes", icon: Edit3, color: "text-amber-500" },
  legal_doc:    { label: "Legal Documents", icon: FileText, color: "text-rose-500" },
  other:        { label: "General Files", icon: File, color: "text-slate-500" },
};

export function ProjectFileLibrary({ projectId, files }: ProjectFileLibraryProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  // Dialog states
  const [renamingFile, setRenamingFile] = useState<ProjectFile | null>(null);
  const [newName, setNewName] = useState("");

  const filteredFiles = files.filter((f: any) => {
    const matchesSearch = f.file_name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = activeCategory ? f.category === activeCategory : true;
    return matchesSearch && matchesCategory;
  });

  const groupedCount = files.reduce((acc: any, f) => {
    acc[f.category] = (acc[f.category] || 0) + 1;
    return acc;
  }, {});

  const handleDelete = async (file: ProjectFile) => {
    if (!confirm("Are you sure you want to permanently delete this file?")) return;
    
    startTransition(async () => {
      const result = await deleteFileAction(file.id, projectId, file.storage_path);
      if (result?.success) {
        toast({ title: "File Deleted", description: "The file has been removed from the vault." });
      } else {
        toast({ title: "Error", description: result?.error || "Deletion failed", variant: "error" });
      }
    });
  };

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renamingFile || !newName) return;

    startTransition(async () => {
      const result = await renameFileAction(renamingFile.id, projectId, newName);
      if (result?.success) {
        toast({ title: "File Renamed", description: "Vault record updated." });
        setRenamingFile(null);
      } else {
        toast({ title: "Error", description: result?.error || "Rename failed", variant: "error" });
      }
    });
  };

  return (
    <div className="space-y-6">
      {/* Search & Category Filter */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="relative w-full md:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input 
            type="text" 
            placeholder="Search vault..." 
            className="flat-input pl-10 h-10 text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex gap-2 overflow-x-auto pb-2 w-full md:w-auto scrollbar-hide">
          <button 
            onClick={() => setActiveCategory(null)}
            className={cn(
              "px-4 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap",
              !activeCategory ? "bg-indigo-600 text-white shadow-md" : "bg-white/50 text-slate-500 hover:bg-white"
            )}
          >
            All Files ({files.length})
          </button>
          {Object.entries(CATEGORY_MAP).map(([key, config]) => (
            groupedCount[key] > 0 && (
              <button 
                key={key}
                onClick={() => setActiveCategory(key)}
                className={cn(
                  "px-4 py-1.5 rounded-full text-xs font-bold transition-all whitespace-nowrap",
                  activeCategory === key ? "bg-indigo-600 text-white shadow-md" : "bg-white/50 text-slate-500 hover:bg-white"
                )}
              >
                {config.label} ({groupedCount[key]})
              </button>
            )
          ))}
        </div>
      </div>

      {/* Grid View */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredFiles.map((file) => {
          const config = CATEGORY_MAP[file.category] || CATEGORY_MAP.other;
          return (
            <div 
              key={file.id} 
              className="group glass-card p-4 border-white/20 hover:border-indigo-500/30 transition-all flex flex-col gap-3 relative"
            >
              <div className="flex items-start justify-between">
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", config.color.replace('text', 'bg') + '/10')}>
                  <config.icon className={cn("w-5 h-5", config.color)} />
                </div>
                
                {/* Actions Trigger */}
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <a 
                    href={file.file_url} 
                    download={file.file_name}
                    className="p-1.5 rounded-lg bg-white/50 hover:bg-indigo-50 text-slate-400 hover:text-indigo-600 transition-all"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                  <button 
                    onClick={() => { setRenamingFile(file); setNewName(file.file_name); }}
                    className="p-1.5 rounded-lg bg-white/50 hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-all"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => handleDelete(file)}
                    className="p-1.5 rounded-lg bg-white/50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="mt-1">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate mb-1" title={file.file_name}>
                  {file.file_name}
                </h4>
                <div className="flex items-center justify-between text-xs text-slate-400 font-bold uppercase tracking-wider">
                  <span>{config.label}</span>
                  <span>{new Date(file.uploaded_at).toLocaleDateString()}</span>
                </div>
              </div>

              {/* Decorative indicator */}
              <div className={cn("absolute bottom-0 left-0 right-0 h-1 rounded-full opacity-30", config.color.replace('text', 'bg'))} />
            </div>
          );
        })}

        {filteredFiles.length === 0 && (
          <div className="col-span-full py-16 flex flex-col items-center justify-center text-center glass-card border-dashed bg-transparent border-slate-200">
            <FolderOpen className="w-12 h-12 text-slate-200 mb-4" />
            <p className="text-slate-400 font-medium">No files matching your selection in the vault.</p>
          </div>
        )}
      </div>

      {/* Rename Dialog */}
      <Dialog open={!!renamingFile} onOpenChange={(open) => !open && setRenamingFile(null)}>
        <DialogContent className="glass-card border-white/10 max-w-sm">
          <DialogHeader>
            <DialogTitle>Rename Vault Item</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleRename} className="space-y-6 pt-4">
            <input 
              type="text" 
              className="flat-input h-12 text-lg font-bold"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
            />
            <DialogFooter>
              <button 
                type="submit" 
                disabled={isPending}
                className="w-full btn-primary h-12 gap-2"
              >
                {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                Confirm Rename
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
