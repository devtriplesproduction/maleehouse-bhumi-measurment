"use client";

import React, { useState, useTransition, useRef, useMemo, useEffect } from "react";
import { 
  MessageSquare, 
  Lock, 
  Send, 
  Edit2, 
  Trash2, 
  Reply, 
  X, 
  Check, 
  Loader2, 
  FileText, 
  ShieldAlert, 
  MessageCircle, 
  CornerDownRight, 
  Clock, 
  UserPlus, 
  History 
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { 
  addProjectCommentAction, 
  editProjectCommentAction, 
  deleteProjectCommentAction 
} from "@/actions/comment.actions";

type CommentType = "general" | "review" | "rejection" | "internal";
type Role = "admin" | "accountant" | "engineer" | "field" | "employee";

type CommentRow = {
  id: string;
  project_id: string;
  user_id: string;
  content: string;
  comment_type: CommentType;
  parent_comment_id: string | null;
  is_edited: boolean;
  edited_at: string | null;
  deleted_at: string | null;
  created_at: string;
  author_profile: {
    first_name: string | null;
    last_name: string | null;
    email: string;
    role: Role;
  } | null;
};

type HistoryRow = {
  id: string;
  from_stage: string | null;
  to_stage: string;
  comment: string | null;
  created_at: string;
  changed_by_profile: {
    first_name: string | null;
    last_name: string | null;
    email: string;
  } | null;
};

interface ProjectActivityFeedProps {
  projectId: string;
  workflowHistory: HistoryRow[];
  comments: CommentRow[];
  currentUserRole?: Role;
  currentUserId?: string;
  teamMembers: {
    userId: string;
    firstName: string | null;
    lastName: string | null;
    email: string;
    role: string;
  }[];
  allStaff?: any[];
}

// ── Icon and Colors for Different Comment & History Events ──────────────────────────

const COMMENT_META: Record<
  CommentType,
  { label: string; bg: string; text: string; border: string; icon: any }
> = {
  general: { 
    label: "General Discussion", 
    bg: "bg-blue-500/10 dark:bg-blue-500/5", 
    text: "text-blue-600 dark:text-blue-400", 
    border: "border-blue-500/20 dark:border-blue-500/10",
    icon: MessageSquare 
  },
  review: { 
    label: "QC Review Note", 
    bg: "bg-indigo-500/10 dark:bg-indigo-500/5", 
    text: "text-indigo-600 dark:text-indigo-400", 
    border: "border-indigo-500/20 dark:border-indigo-500/10",
    icon: FileText 
  },
  rejection: { 
    label: "QC Rejection Reason", 
    bg: "bg-rose-500/10 dark:bg-rose-500/5", 
    text: "text-rose-600 dark:text-rose-400", 
    border: "border-rose-500/20 dark:border-rose-500/10",
    icon: ShieldAlert 
  },
  internal: { 
    label: "Privileged Note", 
    bg: "bg-amber-500/10 dark:bg-amber-500/5", 
    text: "text-amber-600 dark:text-amber-400", 
    border: "border-amber-500/20 dark:border-amber-500/10",
    icon: Lock 
  },
};

// ── Mentions-Aware Textarea Component ───────────────────────────────────────────────

interface RichTextareaProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  teamMembers: any[];
  allStaff: any[];
  disabled?: boolean;
  autoFocus?: boolean;
  onSubmit?: () => void;
}

function RichTextarea({
  value,
  onChange,
  placeholder,
  teamMembers,
  allStaff,
  disabled,
  autoFocus,
  onSubmit,
}: RichTextareaProps) {
  const [mentionSearch, setMentionSearch] = useState<string | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus on mount if autoFocus set
  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [autoFocus]);

  // Combine & filter mention targets based on search query
  const filteredMentions = useMemo(() => {
    if (mentionSearch === null) return [];
    const search = mentionSearch.toLowerCase();
    
    // Create combined list (with unique IDs, prioritising assigned members)
    const combined = [...teamMembers.map((m: any) => ({ ...m, isAssigned: true }))];
    allStaff.forEach((s: any) => {
      if (!combined.some((c: any) => c.userId === s.id)) {
        combined.push({
          userId: s.id,
          firstName: s.first_name,
          lastName: s.last_name,
          email: s.email,
          role: s.role,
          isAssigned: false
        });
      }
    });

    return combined.filter((m: any) => {
      const fullName = `${m.firstName || ""} ${m.lastName || ""}`.toLowerCase();
      const email = (m.email || "").toLowerCase();
      return fullName.includes(search) || email.includes(search);
    }).slice(0, 5); // Limit to top 5 results for sleek overlay
  }, [mentionSearch, teamMembers, allStaff]);

  // Handle textarea change to trigger mention popover
  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    onChange(text);

    const selectionStart = e.target.selectionStart;
    const beforeCursor = text.slice(0, selectionStart);
    
    // Match '@' followed by non-whitespace characters up to the cursor
    const mentionMatch = beforeCursor.match(/@(\w*)$/);
    if (mentionMatch) {
      setMentionSearch(mentionMatch[1]);
      setSelectedIndex(0);
    } else {
      setMentionSearch(null);
    }
  };

  // Complete a mention selection
  const selectMention = (member: any) => {
    if (!textareaRef.current) return;
    const text = value;
    const selectionStart = textareaRef.current.selectionStart;
    const beforeCursor = text.slice(0, selectionStart);
    const afterCursor = text.slice(selectionStart);

    // Replace the '@search' substring before cursor with selected user mention
    const prefix = beforeCursor.replace(/@\w*$/, `@${member.firstName || (member.email || "").split("@")[0]} `);
    const newVal = prefix + afterCursor;
    
    onChange(newVal);
    setMentionSearch(null);

    // Set cursor position right after mention
    setTimeout(() => {
      if (textareaRef.current) {
        textareaRef.current.focus();
        const pos = prefix.length;
        textareaRef.current.setSelectionRange(pos, pos);
      }
    }, 10);
  };

  // Key navigation in mention popover
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mentionSearch !== null && filteredMentions.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filteredMentions.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredMentions.length) % filteredMentions.length);
      } else if (e.key === "Enter") {
        e.preventDefault();
        selectMention(filteredMentions[selectedIndex]);
      } else if (e.key === "Escape") {
        e.preventDefault();
        setMentionSearch(null);
      }
    } else if (e.key === "Enter" && e.ctrlKey && onSubmit) {
      // Allow Ctrl+Enter to submit
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <div className="relative w-full">
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full min-h-[90px] px-3.5 py-3 text-[13px] bg-white/40 dark:bg-slate-900/40 border border-slate-200 dark:border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500/80 text-slate-800 dark:text-slate-100 placeholder-slate-400 backdrop-blur-md resize-y transition-all font-medium leading-relaxed"
      />

      {/* Mention Dropdown Overlay */}
      {mentionSearch !== null && filteredMentions.length > 0 && (
        <div className="absolute left-2 bottom-full mb-2 w-72 glass-card border-indigo-500/20 shadow-2xl p-1 z-50 flex flex-col gap-0.5 overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-150">
          <div className="px-2.5 py-1.5 border-b border-white/5 mb-1 bg-white/5 flex items-center justify-between">
            <span className="text-xs font-black text-indigo-400 uppercase tracking-widest">Mention Employee</span>
            <span className="text-xs text-slate-500 font-bold">Use ↑↓ and Enter</span>
          </div>
          {filteredMentions.map((member, idx) => (
            <button
              key={member.userId}
              onClick={() => selectMention(member)}
              className={cn(
                "flex items-center justify-between w-full text-left px-2.5 py-2 rounded-lg text-xs font-bold transition-all",
                idx === selectedIndex 
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-600/20" 
                  : "text-slate-700 dark:text-slate-300 hover:bg-white/10 hover:text-white"
              )}
            >
              <div className="flex flex-col truncate leading-tight">
                <span>{member.firstName || ""} {member.lastName || ""}</span>
                <span className={cn(
                  "text-xs font-bold truncate mt-0.5",
                  idx === selectedIndex ? "text-indigo-200" : "text-slate-400 dark:text-slate-500"
                )}>
                  {member.role?.replace("_", " ")} · {member.email}
                </span>
              </div>

              {/* Tag Badges */}
              {member.isAssigned && (
                <span className={cn(
                  "text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md ml-2 border flex-shrink-0",
                  idx === selectedIndex 
                    ? "bg-white/10 text-white border-white/20" 
                    : "bg-indigo-500/10 text-indigo-400 border-indigo-500/20"
                )}>
                  Team
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main Activity Feed Component ──────────────────────────────────────────────────

export function ProjectActivityFeed({
  projectId,
  workflowHistory = [],
  comments = [],
  currentUserRole,
  currentUserId,
  teamMembers = [],
  allStaff = [],
}: ProjectActivityFeedProps) {
  // ── State Variables ──
  const [activeTab, setActiveTab] = useState<"heartbeat" | "notes">("heartbeat");
  const [commentContent, setCommentContent] = useState("");
  const [commentType, setCommentType] = useState<CommentType>("general");

  // Action Pending loaders
  const [isPending, startTransition] = useTransition();
  const [savingEditId, setSavingEditId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Thread controls
  const [activeReplyCommentId, setActiveReplyCommentId] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");

  const [activeEditCommentId, setActiveEditCommentId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");


  // Privilege guard for writing internal notes
  const isPrivileged = currentUserRole === "admin" || currentUserRole === "engineer";

  // ── Action Handlers ──

  // Add Comment (top-level or reply)
  const handleAddComment = async (parentCommentId?: string) => {
    const content = parentCommentId ? replyContent : commentContent;
    const type = parentCommentId ? "general" : commentType;

    if (!content.trim()) return;

    startTransition(async () => {
      const result = await addProjectCommentAction(projectId, content, type, parentCommentId);
      if (result?.success) {
        if (parentCommentId) {
          setReplyContent("");
          setActiveReplyCommentId(null);
          toast.success("Reply posted successfully!");
        } else {
          setCommentContent("");
          toast.success("Comment added!");
        }
      } else {
        toast.error(result?.error || "Failed to add comment.");
      }
    });
  };

  // Edit Comment
  const handleSaveEdit = async (commentId: string) => {
    if (!editContent.trim()) return;
    setSavingEditId(commentId);
    
    const result = await editProjectCommentAction(commentId, projectId, editContent);
    setSavingEditId(null);

    if (result?.success) {
      setActiveEditCommentId(null);
      setEditContent("");
      toast.success("Comment updated!");
    } else {
      toast.error(result?.error || "Failed to edit comment.");
    }
  };

  // Delete Comment (soft-delete)
  const handleDeleteComment = async (commentId: string) => {
    if (!confirm("Are you sure you want to delete this comment? Replies will remain visible but this message content will be hidden.")) return;
    setDeletingId(commentId);
    
    const result = await deleteProjectCommentAction(commentId, projectId);
    setDeletingId(null);

    if (result?.success) {
      toast.success("Comment deleted.");
    } else {
      toast.error(result?.error || "Failed to delete comment.");
    }
  };

  // ── Comment Thread Structuring ──
  // Separate top-level comments and map replies (chronological sorting)
  const topLevelComments = useMemo(() => {
    return comments.filter((c) => !c.parent_comment_id);
  }, [comments]);

  const repliesMap = useMemo(() => {
    const map = new Map<string, CommentRow[]>();
    comments.forEach((c) => {
      if (c.parent_comment_id) {
        const list = map.get(c.parent_comment_id) || [];
        list.push(c);
        map.set(c.parent_comment_id, list);
      }
    });
    // Sort replies oldest-to-newest inside each thread for natural reading
    map.forEach((list) => {
      list.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    });
    return map;
  }, [comments]);

  // ── Heartbeat Combined Timeline Structuring ──
  // Merges workflow status transitions and comments into a single chronological timeline
  const combinedTimeline = useMemo(() => {
    const events: Array<
      | { type: "history"; date: Date; data: HistoryRow }
      | { type: "comment"; date: Date; data: CommentRow }
    > = [];

    workflowHistory.forEach((h) => {
      events.push({ type: "history", date: new Date(h.created_at), data: h });
    });

    comments.forEach((c) => {
      events.push({ type: "comment", date: new Date(c.created_at), data: c });
    });

    return events.sort((a: any, b: any) => b.date.getTime() - a.date.getTime()); // Newest first
  }, [workflowHistory, comments]);

  // Helpers to fetch initials
  const getInitials = (firstName: string | null, lastName: string | null, email: string) => {
    if (firstName || lastName) {
      return `${(firstName || "")[0] || ""}${(lastName || "")[0] || ""}`.toUpperCase();
    }
    return email.slice(0, 2).toUpperCase();
  };

  // ── Render Helpers ──

  // Renders a Single Comment Card
  const renderCommentCard = (comment: CommentRow, isReply = false) => {
    const meta = COMMENT_META[comment.comment_type] ?? COMMENT_META.general;
    const Icon = meta.icon;
    const isAuthor = comment.user_id === currentUserId;
    const isAdmin = currentUserRole === "admin";
    const canManage = !comment.deleted_at && (isAuthor || isAdmin);

    const authorName = comment.author_profile 
      ? `${comment.author_profile.first_name || ""} ${comment.author_profile.last_name || ""}`.trim() || comment.author_profile.email
      : "Unknown Employee";

    const initials = comment.author_profile 
      ? getInitials(comment.author_profile.first_name, comment.author_profile.last_name, comment.author_profile.email)
      : "??";

    return (
      <div 
        key={comment.id} 
        className={cn(
          "relative flex items-start gap-3 p-3.5 rounded-xl border transition-all hover:bg-slate-50/10",
          isReply ? "bg-white/10" : "glass-card border-white/5",
          comment.comment_type === "internal" ? "border-amber-500/20" : "border-white/5"
        )}
      >
        {/* Author Avatar Bubble */}
        <div className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-semibold shadow-inner",
          comment.deleted_at 
            ? "bg-slate-300 dark:bg-slate-700" 
            : comment.comment_type === "internal" 
              ? "bg-indigo-600 dark:bg-amber-500" 
              : "bg-indigo-600 dark:bg-indigo-500"
        )}>
          {comment.deleted_at ? "∅" : initials}
        </div>

        {/* Comment Core Content */}
        <div className="flex-1 min-w-0">
          {/* Metadata Row */}
          <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[13px] font-bold text-slate-800 dark:text-slate-100">
                {comment.deleted_at ? "System Log" : authorName}
              </span>
              
              {!comment.deleted_at && comment.author_profile?.role && (
                <span className="text-xs font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 bg-white/5 px-1.5 py-0.5 rounded-md border border-white/5">
                  {comment.author_profile.role.replace("_", " ")}
                </span>
              )}

              {/* Comment Type Tag */}
              {!comment.deleted_at && (
                <span className={cn(
                  "text-xs font-black uppercase tracking-widest px-1.5 py-0.5 rounded-md border flex items-center gap-1",
                  meta.bg,
                  meta.text,
                  meta.border
                )}>
                  <Icon className="w-2.5 h-2.5" />
                  {meta.label}
                </span>
              )}
            </div>

            {/* Time Stamp */}
            <span className="text-sm text-slate-400 dark:text-slate-600 font-medium flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
            </span>
          </div>

          {/* Comment Body / Text Editor */}
          <div className="mt-2.5 text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
            {comment.deleted_at ? (
              <span className="text-xs italic text-slate-400 dark:text-slate-500 flex items-center gap-1.5 bg-slate-50 dark:bg-white/5 px-3 py-2 rounded-lg border border-slate-100 dark:border-white/5 w-fit">
                <Trash2 className="w-3.5 h-3.5 opacity-50" />
                This note has been deleted.
              </span>
            ) : activeEditCommentId === comment.id ? (
              // Inline edit form
              <div className="flex flex-col gap-2 mt-1">
                <RichTextarea
                  value={editContent}
                  onChange={setEditContent}
                  teamMembers={teamMembers}
                  allStaff={allStaff}
                  onSubmit={() => handleSaveEdit(comment.id)}
                  autoFocus
                />
                <div className="flex items-center gap-2 justify-end">
                  <button
                    onClick={() => {
                      setActiveEditCommentId(null);
                      setEditContent("");
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-bold text-slate-500 hover:text-slate-200 hover:bg-white/5 border border-white/5 rounded-lg transition-all"
                  >
                    <X className="w-3.5 h-3.5" />
                    Cancel
                  </button>
                  <button
                    onClick={() => handleSaveEdit(comment.id)}
                    disabled={savingEditId === comment.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg transition-all shadow-md shadow-indigo-600/10"
                  >
                    {savingEditId === comment.id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    Save Updates
                  </button>
                </div>
              </div>
            ) : (
              // Render formatted comment content with @mention styling
              <p className="whitespace-pre-wrap">
                {(comment.content || "").split(/(@\w+)/g).map((word, i) => {
                  if (word.startsWith("@")) {
                    return (
                      <span 
                        key={i} 
                        className="text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20 font-black cursor-help"
                        title="Mentioned Employee"
                      >
                        {word}
                      </span>
                    );
                  }
                  return word;
                })}
                {comment.is_edited && (
                  <span className="text-xs text-slate-400 dark:text-slate-500 font-medium italic ml-2 cursor-help" title={`Edited on ${new Date(comment.edited_at || "").toLocaleString()}`}>
                    (edited)
                  </span>
                )}
              </p>
            )}
          </div>

          {/* Action Row */}
          {canManage && activeEditCommentId !== comment.id && (
            <div className="flex items-center gap-4 mt-3 pt-2.5 border-t border-white/5">
              {/* Reply Button (Only allowed on top-level comments to prevent infinite indentation) */}
              {!isReply && (
                <button
                  onClick={() => {
                    setActiveReplyCommentId(activeReplyCommentId === comment.id ? null : comment.id);
                    setReplyContent("");
                  }}
                  className="flex items-center gap-1 text-sm font-bold text-slate-400 hover:text-slate-200 transition-colors"
                >
                  <Reply className="w-3 h-3" />
                  Reply
                </button>
              )}

              {/* Edit Action */}
              <button
                onClick={() => {
                  setActiveEditCommentId(comment.id);
                  setEditContent(comment.content);
                }}
                className="flex items-center gap-1 text-sm font-bold text-slate-400 hover:text-amber-400 transition-colors"
              >
                <Edit2 className="w-3 h-3" />
                Edit
              </button>

              {/* Delete Action */}
              <button
                onClick={() => handleDeleteComment(comment.id)}
                disabled={deletingId === comment.id}
                className="flex items-center gap-1 text-sm font-bold text-slate-400 hover:text-rose-500 transition-colors ml-auto disabled:opacity-50"
              >
                <Trash2 className="w-3 h-3" />
                Delete
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full flex flex-col gap-6">
      
      {/* ── Tabs Navigation ── */}
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-white/10 pb-1">
        <div className="flex items-center gap-1.5 w-full">
          <button
            onClick={() => setActiveTab("heartbeat")}
            className={cn(
              "flex-1 py-2 text-xs font-black uppercase tracking-wider border-b-2 transition-all flex items-center justify-center gap-1.5",
              activeTab === "heartbeat"
                ? "border-indigo-500 text-indigo-500"
                : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            )}
          >
            <History className="w-3.5 h-3.5" />
            Activity
          </button>
          
          <button
            onClick={() => setActiveTab("notes")}
            className={cn(
              "flex-1 py-2 text-xs font-black uppercase tracking-wider border-b-2 transition-all flex items-center justify-center gap-1.5",
              activeTab === "notes"
                ? "border-indigo-500 text-indigo-500"
                : "border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            )}
          >
            <MessageCircle className="w-3.5 h-3.5" />
            Discussions
            {comments.length > 0 && (
              <span className="px-1.5 py-0.5 text-xs bg-slate-100 dark:bg-white/5 text-slate-500 rounded font-black border border-white/5">
                {comments.length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* ── Tab: DISCUSSIONS & COMMENTS ── */}
      {activeTab === "notes" && (
        <div className="flex flex-col gap-6 animate-in fade-in duration-200">
          
          {/* Main Discussion Writer Composer */}
          <div className="glass-card border-white/5 p-4 flex flex-col gap-3.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-indigo-400" />
                Add a new note
              </span>

              {/* Discussion Type Selector */}
              <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-white/5 p-1 rounded-lg border border-white/5">
                <button
                  type="button"
                  onClick={() => setCommentType("general")}
                  className={cn(
                    "px-2.5 py-1 text-xs font-black uppercase tracking-widest rounded-md transition-all",
                    commentType === "general"
                      ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/10"
                      : "text-slate-400 hover:text-slate-200"
                  )}
                >
                  General
                </button>

                {isPrivileged && (
                  <button
                    type="button"
                    onClick={() => setCommentType("internal")}
                    className={cn(
                      "px-2.5 py-1 text-xs font-black uppercase tracking-widest rounded-md transition-all flex items-center gap-1",
                      commentType === "internal"
                        ? "bg-indigo-600 text-white shadow-md shadow-amber-600/10"
                        : "text-slate-400 hover:text-amber-400"
                    )}
                  >
                    <Lock className="w-2.5 h-2.5" />
                    Internal
                  </button>
                )}
              </div>
            </div>

            {/* Rich input with Mentions support */}
            <RichTextarea
              value={commentContent}
              onChange={setCommentContent}
              placeholder={commentType === "internal" ? "Write a highly secure team note (only Admins & Engineers)..." : "Ask a question, @mention someone, or leave updates..."}
              teamMembers={teamMembers}
              allStaff={allStaff}
              disabled={isPending}
              onSubmit={() => handleAddComment()}
            />

            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-400 font-bold tracking-tight">
                Use <code className="bg-slate-100 dark:bg-white/5 px-1 py-0.5 rounded border border-white/5">Ctrl+Enter</code> to submit
              </span>
              
              <button
                onClick={() => handleAddComment()}
                disabled={isPending || !commentContent.trim()}
                className="flex items-center gap-2 px-4 py-2 text-xs font-black uppercase tracking-widest bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-600/10 transition-all disabled:opacity-50"
              >
                {isPending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                Post Note
              </button>
            </div>
          </div>

          {/* Comments List Section */}
          <div className="space-y-4">
            {topLevelComments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
                <div className="w-12 h-12 rounded-full bg-slate-50 dark:bg-white/5 flex items-center justify-center border border-white/5 shadow-inner">
                  <MessageSquare className="w-5 h-5 text-slate-400" />
                </div>
                <p className="text-sm font-bold text-slate-700 dark:text-slate-400">No discussions yet</p>
                <p className="text-xs text-slate-400 dark:text-slate-500 max-w-xs">Be the first to share a note or ask a question under this project workflow!</p>
              </div>
            ) : (
              topLevelComments.map((comment) => {
                const commentReplies = repliesMap.get(comment.id) || [];
                const isReplyBoxOpen = activeReplyCommentId === comment.id;

                return (
                  <div key={comment.id} className="space-y-2">
                    {/* Render Top Level Comment Card */}
                    {renderCommentCard(comment, false)}

                    {/* Replies Sub-Thread Tree */}
                    {(commentReplies.length > 0 || isReplyBoxOpen) && (
                      <div className="border-l-2 border-indigo-500/10 ml-6 pl-4 space-y-3 mt-2">
                        {/* Nested Replies list */}
                        {commentReplies.map((reply) => renderCommentCard(reply, true))}

                        {/* Threaded inline reply textbox composer */}
                        {isReplyBoxOpen && (
                          <div className="flex flex-col gap-2 p-3 bg-white/5 rounded-xl border border-white/5 animate-in slide-in-from-top-1 duration-150">
                            <span className="text-xs font-black uppercase tracking-widest text-indigo-400 flex items-center gap-1 leading-none mb-1">
                              <CornerDownRight className="w-3 h-3" />
                              Write Thread Reply
                            </span>
                            <RichTextarea
                              value={replyContent}
                              onChange={setReplyContent}
                              placeholder="Add replies, @mention collaborators..."
                              teamMembers={teamMembers}
                              allStaff={allStaff}
                              disabled={isPending}
                              onSubmit={() => handleAddComment(comment.id)}
                              autoFocus
                            />
                            <div className="flex items-center gap-2 justify-end">
                              <button
                                onClick={() => {
                                  setActiveReplyCommentId(null);
                                  setReplyContent("");
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-bold text-slate-500 hover:text-slate-200 hover:bg-white/5 border border-white/5 rounded-lg transition-all"
                              >
                                <X className="w-3.5 h-3.5" />
                                Cancel
                              </button>
                              <button
                                onClick={() => handleAddComment(comment.id)}
                                disabled={isPending || !replyContent.trim()}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-bold bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg transition-all shadow-md shadow-indigo-600/10"
                              >
                                {isPending ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Send className="w-3.5 h-3.5" />
                                )}
                                Reply
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ── Tab: OPERATIONAL HEARTBEAT (Combined History & Comment feed) ── */}
      {activeTab === "heartbeat" && (
        <div className="flex flex-col gap-4 animate-in fade-in duration-200">
          {combinedTimeline.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
              <div className="w-12 h-12 rounded-full bg-slate-50 dark:bg-white/5 flex items-center justify-center border border-white/5 shadow-inner">
                <History className="w-5 h-5 text-slate-400" />
              </div>
              <p className="text-sm font-bold text-slate-700 dark:text-slate-400">No heartbeat logs</p>
              <p className="text-xs text-slate-400 dark:text-slate-500">Wait for transition activity to appear here.</p>
            </div>
          ) : (
            <div className="relative border-l border-slate-200 dark:border-white/10 ml-4 pl-6 space-y-6 py-2">
              {combinedTimeline.map((event, idx) => {
                const date = event.date;

                // ── Case 1: Stage Transition History Event ──
                if (event.type === "history") {
                  const h = event.data;
                  const authorName = h.changed_by_profile 
                    ? `${h.changed_by_profile.first_name || ""} ${h.changed_by_profile.last_name || ""}`.trim() || h.changed_by_profile.email
                    : "System Controller";

                  const fromLabel = h.from_stage ? h.from_stage.replace("_", " ") : "initial state";
                  const toLabel = h.to_stage.replace("_", " ");

                  return (
                    <div key={`hist-${h.id || idx}`} className="relative group">
                      {/* Timeline Bullet Anchor */}
                      <span className="absolute -left-[31px] top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-indigo-500 border-2 border-white dark:border-slate-900 shadow" />

                      <div className="flex flex-col gap-1 bg-white/5 border border-white/5 rounded-xl p-3.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-sm font-black uppercase tracking-widest text-indigo-400 flex items-center gap-1.5 bg-indigo-500/10 px-2 py-0.5 border border-indigo-500/20 rounded-md">
                            <UserPlus className="w-3.5 h-3.5" />
                            Workflow Stage Transition
                          </span>
                          
                          <time className="text-xs text-slate-400 dark:text-slate-600 font-medium">
                            {formatDistanceToNow(date, { addSuffix: true })}
                          </time>
                        </div>

                        <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-2">
                          {authorName} updated workflow stage:
                        </p>
                        
                        <p className="text-xs font-semibold text-slate-600 dark:text-slate-400 mt-1 flex items-center gap-2">
                          <span className="capitalize px-1.5 py-0.5 bg-slate-100 dark:bg-white/5 rounded border border-white/5 font-black">{fromLabel}</span> 
                          → 
                          <span className="capitalize px-1.5 py-0.5 bg-indigo-500/10 text-indigo-400 rounded border border-indigo-500/20 font-black">{toLabel}</span>
                        </p>

                        {h.comment && (
                          <blockquote className="mt-2 text-xs italic text-slate-500 border-l border-indigo-500/20 pl-3">
                            &quot;{h.comment}&quot;
                          </blockquote>
                        )}
                      </div>
                    </div>
                  );
                }

                // ── Case 2: Comment Discussion Event ──
                const c = event.data;
                const authorName = c.author_profile 
                  ? `${c.author_profile.first_name || ""} ${c.author_profile.last_name || ""}`.trim() || c.author_profile.email
                  : "Collaborator";

                const isReply = c.parent_comment_id !== null;
                const meta = COMMENT_META[c.comment_type] ?? COMMENT_META.general;
                const Icon = meta.icon;

                return (
                  <div key={`comm-${c.id || idx}`} className="relative group">
                    {/* Timeline Bullet Anchor */}
                    <span className={cn(
                      "absolute -left-[31px] top-1.5 flex h-4 w-4 items-center justify-center rounded-full border-2 border-white dark:border-slate-900 shadow",
                      c.deleted_at 
                        ? "bg-slate-400" 
                        : c.comment_type === "internal" 
                          ? "bg-amber-500" 
                          : "bg-emerald-500"
                    )} />

                    <div className={cn(
                      "flex flex-col gap-1 bg-white/5 border border-white/5 rounded-xl p-3.5",
                      c.comment_type === "internal" && "border-amber-500/20"
                    )}>
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className={cn(
                          "text-xs font-black uppercase tracking-widest px-2 py-0.5 border rounded-md flex items-center gap-1",
                          meta.bg,
                          meta.text,
                          meta.border
                        )}>
                          <Icon className="w-3.5 h-3.5" />
                          {isReply ? "Reply Note" : meta.label}
                        </span>
                        
                        <time className="text-xs text-slate-400 dark:text-slate-600 font-medium">
                          {formatDistanceToNow(date, { addSuffix: true })}
                        </time>
                      </div>

                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-2">
                        {c.deleted_at ? "System" : authorName} posted a comment:
                      </p>

                      <div className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-1">
                        {c.deleted_at ? (
                          <span className="text-xs italic text-slate-400 dark:text-slate-500 py-1 flex items-center gap-1.5 bg-slate-50 dark:bg-white/5 px-3 py-2 rounded-lg border border-slate-100 dark:border-white/5 w-fit">
                            <Trash2 className="w-3.5 h-3.5 opacity-50" />
                            This note has been deleted.
                          </span>
                        ) : (
                          <p className="whitespace-pre-wrap leading-relaxed mt-1">
                            {c.content.split(/(@\w+)/g).map((word, i) => {
                              if (word.startsWith("@")) {
                                return (
                                  <span key={i} className="text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded border border-indigo-500/20 font-black">
                                    {word}
                                  </span>
                                );
                              }
                              return word;
                            })}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

    </div>
  );
}
