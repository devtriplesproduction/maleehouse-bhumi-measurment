'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { 
  MessageSquare, 
  Lock, 
  Send, 
  Trash2, 
  AlertTriangle, 
  HelpCircle, 
  FileText,
  Loader2,
  Filter
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { addProjectCommentAction, deleteProjectCommentAction } from '@/actions/comment.actions';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

interface CommentProfile {
  first_name?: string;
  last_name?: string;
  email?: string;
  role?: string;
}

interface CommentItem {
  id: string;
  user_id: string;
  content: string;
  comment_type: 'general' | 'review' | 'rejection' | 'internal';
  created_at: string;
  author_profile?: CommentProfile;
}

interface ProjectCommunicationTabProps {
  projectId: string;
  comments: CommentItem[];
  userRole: string;
  currentUserId: string;
  onUpdateComments?: (updatedComments: CommentItem[]) => void;
}

const COMMENT_TYPES = [
  { value: 'general', label: 'General Update', badge: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-white/5 dark:text-slate-400 dark:border-white/5', border: 'border-l-slate-400', icon: FileText },
  { value: 'review', label: 'Clarification', badge: 'bg-blue-500/10 text-blue-500 border-blue-500/20', border: 'border-l-blue-500', icon: HelpCircle },
  { value: 'rejection', label: 'Revision Request', badge: 'bg-amber-500/10 text-amber-500 border-amber-500/20', border: 'border-l-amber-500', icon: AlertTriangle },
  { value: 'internal', label: 'Internal Note', badge: 'bg-purple-500/10 text-purple-500 border-purple-500/20', border: 'border-l-purple-500', icon: Lock }
];

export default function ProjectCommunicationTab({
  projectId,
  comments,
  userRole,
  currentUserId,
  onUpdateComments
}: ProjectCommunicationTabProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  // Form states
  const [content, setContent] = useState('');
  const [type, setType] = useState<'general' | 'review' | 'rejection' | 'internal'>('general');
  const [activeFilter, setActiveFilter] = useState<string>('all');

  const isAdmin = userRole === 'admin';
  const isEngineer = userRole === 'engineer';
  const hasInternalAccess = isAdmin || isEngineer;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    startTransition(async () => {
      const res = await addProjectCommentAction(projectId, content, type);
      if (res?.success) {
        toast({ title: 'Note Dispatched', description: 'Operational comment successfully logged.', variant: 'success' });
        setContent('');
        setType('general');
        if (onUpdateComments && res.data) {
          onUpdateComments([res.data, ...comments]);
        }
      } else {
        toast({ title: 'Submission Failed', description: res?.error || 'Unable to log note.', variant: 'error' });
      }
    });
  };

  const handleDelete = (commentId: string) => {
    if (!confirm('Are you sure you want to delete this log?')) return;

    startTransition(async () => {
      const res = await deleteProjectCommentAction(commentId, projectId);
      if (res?.success) {
        toast({ title: 'Note Deleted', description: 'Comment has been removed.', variant: 'success' });
        if (onUpdateComments) {
          onUpdateComments(comments.filter(c => c.id !== commentId));
        }
      } else {
        toast({ title: 'Delete Failed', description: res?.error || 'Failed to delete note.', variant: 'error' });
      }
    });
  };

  // Filter logic
  const filteredComments = comments.filter((c: any) => {
    // Hide internal comments from non-privileged roles
    if (c.comment_type === 'internal' && !hasInternalAccess) return false;

    if (activeFilter === 'all') return true;
    return c.comment_type === activeFilter;
  });

  return (
    <div className="space-y-6">
      
      {/* Discussion Tabs & Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 dark:border-white/5 pb-4">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-indigo-500" />
          <h3 className="text-base font-bold text-slate-900 dark:text-white tracking-wider">Operational Thread</h3>
        </div>

        {/* Filter Badges */}
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-xs font-bold text-slate-400 mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Filter:
          </span>
          {[
            { id: 'all', label: 'All Logs' },
            { id: 'general', label: 'General Updates' },
            { id: 'review', label: 'Clarifications' },
            { id: 'rejection', label: 'Revision Requests' },
            ...(hasInternalAccess ? [{ id: 'internal', label: 'Internal Notes' }] : [])
          ].map((f: any) => (
            <button
              key={f.id}
              onClick={() => setActiveFilter(f.id)}
              className={cn(
                "px-3 py-1.5 rounded-xl text-xs font-bold transition-all tracking-wider border",
                activeFilter === f.id
                  ? "bg-slate-900 text-white border-slate-950 dark:bg-white dark:text-slate-950 dark:border-white"
                  : "bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-900/40 dark:text-slate-400 dark:border-white/5 hover:text-slate-800 dark:hover:text-white"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Form & Feed grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* Comment Submission Form (1 Col) */}
        <div className="glass-card border-slate-200 dark:border-white/10 p-6 bg-gradient-to-br from-white/95 to-slate-50/50 dark:from-slate-900/40 dark:to-slate-900/10 rounded-2xl space-y-4">
          <h4 className="text-xs font-bold text-slate-950 dark:text-white tracking-wider border-b border-slate-100 dark:border-white/5 pb-2">Log Operational Note</h4>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Note Category</label>
              <select
                value={type}
                onChange={(e: any) => setType(e.target.value)}
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-2.5 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
              >
                <option value="general">General Note / Update</option>
                <option value="review">Clarification Request</option>
                <option value="rejection">Revision Request</option>
                {hasInternalAccess && <option value="internal">Privileged Internal Note</option>}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-500 dark:text-slate-400 font-sans">Details</label>
              <textarea
                required
                rows={4}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Log milestone notes, survey queries, or deliverable details..."
                className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all"
              />
            </div>

            <button
              type="submit"
              disabled={isPending}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-md shadow-indigo-600/15 transition-all hover:-translate-y-0.5 active:translate-y-0"
            >
              {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Publish Log Note
            </button>
          </form>
        </div>

        {/* Comment Thread (2 Cols) */}
        <div className="lg:col-span-2 space-y-3">
          {filteredComments.map((c) => {
            const config = COMMENT_TYPES.find((t: any) => t.value === c.comment_type) || COMMENT_TYPES[0];
            const TypeIcon = config.icon;
            
            const initials = `${c.author_profile?.first_name?.[0] || ''}${c.author_profile?.last_name?.[0] || ''}`.toUpperCase() || 'U';

            return (
              <div
                key={c.id}
                className={cn(
                  "relative glass-card border border-slate-200 dark:border-white/10 p-5 rounded-2xl bg-gradient-to-br from-white/95 to-slate-50/50 dark:from-slate-900/40 dark:to-slate-900/10 border-l-4 transition-all duration-300",
                  config.border
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex gap-3">
                    <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-950 border border-slate-250 dark:border-white/10 flex items-center justify-center text-xs font-black text-slate-500 shrink-0">
                      {initials}
                    </div>
                    
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-slate-900 dark:text-white">
                          {c.author_profile?.first_name} {c.author_profile?.last_name}
                        </span>
                        
                        <span className="px-1.5 py-0.5 rounded text-[8px] bg-slate-100 text-slate-500 border border-slate-200 dark:bg-white/5 dark:text-slate-400 dark:border-white/5 tracking-wider font-bold">
                          {c.author_profile?.role?.replace('_', ' ')}
                        </span>

                        <span className={cn("px-1.5 py-0.5 rounded text-[8px] tracking-wider border font-bold flex items-center gap-1", config.badge)}>
                          <TypeIcon className="w-2.5 h-2.5" />
                          {config.label}
                        </span>
                      </div>
                      
                      <p className="text-xs text-slate-400 dark:text-slate-555 font-medium">
                        {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>

                  {(isAdmin || c.user_id === currentUserId) && (
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="p-1.5 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg transition"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="mt-3 pl-11 text-xs text-slate-700 dark:text-slate-350 leading-relaxed font-medium whitespace-pre-line">
                  {c.content}
                </div>
              </div>
            );
          })}

          {filteredComments.length === 0 && (
            <div className="py-16 text-center glass-card border-slate-200 dark:border-white/10 rounded-2xl flex flex-col items-center justify-center bg-slate-50/20">
              <MessageSquare className="w-8 h-8 text-slate-200 dark:text-slate-800 mb-2" />
              <p className="text-xs text-slate-400 font-bold">No logs matching this category filter.</p>
            </div>
          )}
        </div>

      </div>

    </div>
  );
}
