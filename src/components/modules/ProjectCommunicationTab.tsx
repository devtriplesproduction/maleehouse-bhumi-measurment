'use client';

import React, { useState, useTransition, useRef, useMemo } from 'react';
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
  Filter,
  AtSign,
  Users
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { addProjectCommentAction, deleteProjectCommentAction } from '@/actions/comment.actions';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';
import { Select, SelectItem, SelectGroup, SelectLabel } from '@/components/ui/select';

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
  teamMembers?: any[];
  allUsers?: any[];
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
  teamMembers = [],
  allUsers = [],
  onUpdateComments
}: ProjectCommunicationTabProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();

  // Form states
  const [content, setContent] = useState('');
  const [type, setType] = useState<'general' | 'review' | 'rejection' | 'internal'>('general');
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isAdmin = userRole === 'admin';
  const isEngineer = userRole === 'engineer';
  const hasInternalAccess = isAdmin || isEngineer;

  // Normalize mentionable team members and staff
  const { assignedList, otherStaffList, allMentionable } = useMemo(() => {
    const assigned: { id: string; displayName: string; mentionTag: string; roleLabel: string; isAssigned: boolean }[] = [];
    const other: { id: string; displayName: string; mentionTag: string; roleLabel: string; isAssigned: boolean }[] = [];
    const seen = new Set<string>();

    (teamMembers || []).forEach((m: any) => {
      const id = m.userId || m.id;
      if (!id || seen.has(id)) return;
      seen.add(id);

      const fName = m.firstName || m.first_name || m.profiles?.first_name || '';
      const lName = m.lastName || m.last_name || m.profiles?.last_name || '';
      const email = m.email || m.profiles?.email || '';
      const fullName = `${fName} ${lName}`.trim();
      const displayName = fullName || (email ? email.split('@')[0] : 'Member');
      const role = m.role || m.profiles?.role || 'Staff';

      assigned.push({
        id,
        displayName,
        mentionTag: `@${displayName}`,
        roleLabel: role.replace(/_/g, ' '),
        isAssigned: true,
      });
    });

    (allUsers || []).forEach((u: any) => {
      const id = u.id || u.userId;
      if (!id || seen.has(id)) return;
      seen.add(id);

      const fName = u.first_name || u.firstName || '';
      const lName = u.last_name || u.lastName || '';
      const email = u.email || '';
      const fullName = `${fName} ${lName}`.trim();
      const displayName = fullName || (email ? email.split('@')[0] : 'Staff');
      const role = u.role || u.designation || 'Staff';

      other.push({
        id,
        displayName,
        mentionTag: `@${displayName}`,
        roleLabel: role.replace(/_/g, ' '),
        isAssigned: false,
      });
    });

    return {
      assignedList: assigned,
      otherStaffList: other,
      allMentionable: [...assigned, ...other],
    };
  }, [teamMembers, allUsers]);

  const handleMentionSelect = (mentionTag: string) => {
    if (!mentionTag) return;
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart ?? content.length;
      const end = textarea.selectionEnd ?? content.length;
      const before = content.slice(0, start);
      const after = content.slice(end);

      const atMatch = before.match(/@\w*$/);
      let newBefore = before;
      if (atMatch) {
        newBefore = before.slice(0, atMatch.index);
      } else if (before.length > 0 && !before.endsWith(' ')) {
        newBefore = `${before} `;
      }

      const nextContent = `${newBefore}${mentionTag} ${after}`;
      setContent(nextContent);

      setTimeout(() => {
        textarea.focus();
        const nextPos = newBefore.length + mentionTag.length + 1;
        textarea.setSelectionRange(nextPos, nextPos);
      }, 10);
    } else {
      setContent((prev) => {
        const trimmed = prev.trim();
        return trimmed ? `${trimmed} ${mentionTag} ` : `${mentionTag} `;
      });
    }
  };

  const removeMention = (tag: string) => {
    setContent((prev) => {
      return prev.replace(tag, '').replace(/\s{2,}/g, ' ').trim();
    });
  };

  const detectedMentions = useMemo(() => {
    if (!content) return [];
    return allMentionable.filter((m) =>
      content.toLowerCase().includes(m.mentionTag.toLowerCase())
    );
  }, [content, allMentionable]);

  const mentionHighlightRegex = useMemo(() => {
    const knownNames = allMentionable
      .map((m) => m.displayName)
      .filter(Boolean)
      .sort((a, b) => b.length - a.length);

    if (knownNames.length > 0) {
      const escaped = knownNames.map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
      return new RegExp(`(@(?:${escaped}|[a-zA-Z0-9_-]+))`, 'g');
    }
    return /(@[a-zA-Z0-9_-]+)/g;
  }, [allMentionable]);

  const renderCommentContent = (text: string) => {
    if (!text) return null;
    const parts = text.split(mentionHighlightRegex);
    return parts.map((part, i) => {
      if (part.startsWith('@')) {
        return (
          <span
            key={i}
            className="inline-flex items-center text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/15 font-bold px-1.5 py-0.5 rounded border border-indigo-200 dark:border-indigo-500/25"
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

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
        <div className="glass-card border-slate-200 dark:border-white/10 p-6 bg-gradient-to-br from-white/95 to-slate-50/50 dark:from-slate-900/40 dark:to-slate-900/10 rounded-2xl flex flex-col max-h-[550px] lg:max-h-[720px] lg:h-[calc(100vh-250px)] lg:min-h-[500px]">
          <h4 className="text-xs font-bold text-slate-950 dark:text-white tracking-wider border-b border-slate-100 dark:border-white/5 pb-2 shrink-0">
            Log Operational Note
          </h4>
          
          <div className="flex-1 overflow-y-auto pr-1 -mr-1 custom-scrollbar pt-2 min-h-0">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400">Note Category</label>
                <Select
                  value={type}
                  onValueChange={(val) => setType(val as any)}
                  buttonClassName="text-xs py-2 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
                >
                  <SelectItem value="general" className="text-xs py-2">
                    <div className="flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5 text-slate-400" />
                      <span>General Note / Update</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="review" className="text-xs py-2">
                    <div className="flex items-center gap-2">
                      <HelpCircle className="w-3.5 h-3.5 text-blue-500" />
                      <span>Clarification Request</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="rejection" className="text-xs py-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                      <span>Revision Request</span>
                    </div>
                  </SelectItem>
                  {hasInternalAccess && (
                    <SelectItem value="internal" className="text-xs py-2">
                      <div className="flex items-center gap-2">
                        <Lock className="w-3.5 h-3.5 text-purple-500" />
                        <span>Privileged Internal Note</span>
                      </div>
                    </SelectItem>
                  )}
                </Select>
              </div>

              {/* Mention Team Member */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                    <AtSign className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Mention Team Member</span>
                  </label>
                  <span className="text-[10px] font-medium text-slate-400">Optional</span>
                </div>
                
                <Select
                  value=""
                  onValueChange={(val) => {
                    if (val) handleMentionSelect(val);
                  }}
                  placeholder="Select a team member to mention..."
                  buttonClassName="text-xs py-2 bg-slate-50 dark:bg-slate-950 border-slate-200 dark:border-slate-800"
                >
                  {assignedList.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>Assigned Project Team</SelectLabel>
                      {assignedList.map((m) => (
                        <SelectItem key={m.id} value={m.mentionTag} className="text-xs py-2">
                          <div className="flex items-center justify-between w-full pr-1">
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              {m.displayName}{m.id === currentUserId ? ' (You)' : ''}
                            </span>
                            <span className="text-[10px] font-bold text-indigo-500 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-1.5 py-0.5 rounded uppercase tracking-wider">
                              {m.roleLabel}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                  {otherStaffList.length > 0 && (
                    <SelectGroup>
                      <SelectLabel>Organization Staff</SelectLabel>
                      {otherStaffList.map((m) => (
                        <SelectItem key={m.id} value={m.mentionTag} className="text-xs py-2">
                          <div className="flex items-center justify-between w-full pr-1">
                            <span className="font-semibold text-slate-800 dark:text-slate-200">
                              {m.displayName}{m.id === currentUserId ? ' (You)' : ''}
                            </span>
                            <span className="text-[10px] font-medium text-slate-400 capitalize">
                              {m.roleLabel}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                </Select>

                {/* Quick Tag Pills for Assigned Members */}
                {assignedList.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1 pt-0.5">
                    <span className="text-[10px] font-semibold text-slate-400 mr-0.5">Quick tag:</span>
                    {assignedList.slice(0, 4).map((m) => {
                      const isMentioned = content.toLowerCase().includes(m.mentionTag.toLowerCase());
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => handleMentionSelect(m.mentionTag)}
                          className={cn(
                            "px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-all flex items-center gap-1",
                            isMentioned
                              ? "bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border-indigo-500/30"
                              : "bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/5 hover:border-indigo-500/30 hover:text-indigo-500"
                          )}
                          title={`Mention ${m.displayName}`}
                        >
                          <AtSign className="w-2.5 h-2.5" />
                          <span>{m.displayName.split(' ')[0]}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 dark:text-slate-400 font-sans">Details</label>
                <textarea
                  ref={textareaRef}
                  required
                  rows={4}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder="Log milestone notes, survey queries, or @mention team members..."
                  className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-3 rounded-xl text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all font-medium leading-relaxed"
                />

                {/* Tagged members preview badges */}
                {detectedMentions.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mentioning:</span>
                    {detectedMentions.map((m) => (
                      <span
                        key={m.id}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20"
                      >
                        <AtSign className="w-2.5 h-2.5" />
                        {m.displayName}
                        <button
                          type="button"
                          onClick={() => removeMention(m.mentionTag)}
                          className="hover:text-rose-500 transition-colors ml-0.5 text-xs font-black"
                          title="Remove tag"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
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
        </div>

        {/* Comment Thread in Card (2 Cols) */}
        <div className="lg:col-span-2 glass-card border-slate-200 dark:border-white/10 p-6 bg-gradient-to-br from-white/95 to-slate-50/50 dark:from-slate-900/40 dark:to-slate-900/10 rounded-2xl flex flex-col max-h-[550px] lg:max-h-[720px] lg:h-[calc(100vh-250px)] lg:min-h-[500px]">
          {/* Card Header */}
          <div className="flex items-center justify-between border-b border-slate-100 dark:border-white/5 pb-3 shrink-0">
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold text-slate-950 dark:text-white tracking-wider">
                Thread Activity & Logs
              </h4>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-white/5">
                {filteredComments.length} {filteredComments.length === 1 ? 'Log' : 'Logs'}
              </span>
            </div>
          </div>

          {/* Scrollable Comments Feed */}
          <div className="flex-1 overflow-y-auto pr-1.5 custom-scrollbar space-y-3 pt-4 min-h-0">
            {filteredComments.map((c) => {
              const config = COMMENT_TYPES.find((t: any) => t.value === c.comment_type) || COMMENT_TYPES[0];
              const TypeIcon = config.icon;
              
              const initials = `${c.author_profile?.first_name?.[0] || ''}${c.author_profile?.last_name?.[0] || ''}`.toUpperCase() || 'U';

              return (
                <div
                  key={c.id}
                  className={cn(
                    "relative p-4 rounded-xl border border-slate-200/80 dark:border-white/10 bg-white/90 dark:bg-slate-950/40 hover:bg-white dark:hover:bg-slate-950/70 border-l-4 transition-all duration-200 shadow-sm hover:shadow",
                    config.border
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-white/10 flex items-center justify-center text-xs font-black text-slate-500 shrink-0">
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
                        
                        <p className="text-xs text-slate-400 dark:text-slate-500 font-medium">
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
                    {renderCommentContent(c.content)}
                  </div>
                </div>
              );
            })}

            {filteredComments.length === 0 && (
              <div className="py-16 text-center rounded-2xl flex flex-col items-center justify-center bg-slate-50/50 dark:bg-white/[0.02] border border-dashed border-slate-200 dark:border-white/5 my-auto">
                <MessageSquare className="w-8 h-8 text-slate-300 dark:text-slate-700 mb-2" />
                <p className="text-xs text-slate-400 font-bold">No logs matching this category filter.</p>
              </div>
            )}
          </div>
        </div>

      </div>

    </div>
  );
}
