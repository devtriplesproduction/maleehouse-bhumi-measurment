"use client";

import React, { useEffect, useRef, useState } from "react";
import { Bell, Check, CheckCheck, Loader2, X } from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";
import { useNotificationContext } from "@/providers/NotificationProvider";

type NotificationType = "assignment" | "stage_update" | "approval" | "rejection" | "deadline_warning" | "system" | "payroll";

// ── Icon + colour per type ────────────────────────────────────────────────────

const TYPE_META: Record<
  NotificationType,
  { emoji: string; dotColor: string }
> = {
  assignment:       { emoji: "📋", dotColor: "bg-indigo-500" },
  stage_update:     { emoji: "⚡", dotColor: "bg-blue-500"   },
  approval:         { emoji: "✅", dotColor: "bg-emerald-500" },
  rejection:        { emoji: "❌", dotColor: "bg-rose-500"    },
  deadline_warning: { emoji: "⚠️", dotColor: "bg-amber-500"  },
  system:           { emoji: "🔔", dotColor: "bg-gray-400"   },
  payroll:          { emoji: "💰", dotColor: "bg-emerald-500" },
};

// ── Component ─────────────────────────────────────────────────────────────────

const getNotificationPriority = (title: string, message: string, type: string) => {
  const t = title.toLowerCase();
  const m = message.toLowerCase();

  // 0. Upcoming/Material Requests
  if (t.includes('material request') || m.includes('material request') || t.includes('upcoming') || m.includes('upcoming')) {
    return 0;
  }
  // 1. Draft Deliverable Submitted
  if (t.includes('draft deliverable submitted') || m.includes('draft deliverable submitted') || t.includes('draft deliverable uploaded') || m.includes('draft deliverable uploaded')) {
    return 1;
  }
  // 2. QC Returned Project
  if (type === 'rejection' || t.includes('qc rejected') || m.includes('qc rejected') || t.includes('qc returned') || m.includes('qc returned')) {
    return 2;
  }
  // 3. Survey Data Uploaded
  if (t.includes('survey data') || m.includes('survey data') || t.includes('raw data') || m.includes('raw data') || t.includes('control point') || m.includes('control point')) {
    return 3;
  }
  // 4. Deliverables Ready
  if (t.includes('qc approved') || m.includes('qc approved') || t.includes('passed qc') || m.includes('passed qc') || t.includes('deliverable') || m.includes('deliverable')) {
    return 4;
  }
  // 5. Client Documents Uploaded
  if (t.includes('client documents') || m.includes('client documents') || t.includes('intake document') || m.includes('intake document')) {
    return 5;
  }
  // 6. Project Assignment
  if (type === 'assignment' || t.includes('assigned') || m.includes('assigned')) {
    return 6;
  }
  
  return 7;
};

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const { notifications, isLoading, markAsRead, clearAll } = useNotificationContext();

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  // ── Close dropdown on outside click ──
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const sortedNotifications = [...notifications].sort((a: any, b: any) => {
    if (a.is_read !== b.is_read) {
      return a.is_read ? 1 : -1;
    }
    
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        onClick={() => setIsOpen((o) => !o)}
        className={cn(
          "relative p-2 rounded-lg transition-all duration-200",
          isOpen
            ? "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
            : "text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-600 dark:hover:text-slate-200"
        )}
      >
        <Bell className="w-[18px] h-[18px]" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-0.5 text-[10px] font-bold text-white leading-none shadow-sm">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute top-full right-[-20px] sm:right-0 mt-2 w-[320px] sm:w-96 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-2xl rounded-2xl z-50 flex flex-col overflow-hidden animate-in slide-in-from-top-2 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-slate-950/20">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Notifications</h3>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 text-[10px] font-black bg-indigo-500 text-white rounded-md uppercase tracking-widest">
                  {unreadCount} New
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {notifications.length > 0 && (
                <button
                  onClick={clearAll}
                  title="Clear all"
                  className="flex items-center gap-1 px-2 py-1 text-xs font-bold text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors disabled:opacity-50"
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  Clear All
                </button>
              )}
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Notification List */}
          <div className="overflow-y-auto max-h-[420px] divide-y divide-white/5">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
              </div>
            ) : sortedNotifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-center px-6">
                <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                  <Bell className="w-5 h-5 text-gray-400" />
                </div>
                <p className="text-sm font-medium text-gray-500">
                  You&apos;re all caught up!
                </p>
                <p className="text-xs text-gray-400">
                  New notifications will appear here.
                </p>
              </div>
            ) : (
              sortedNotifications.map((notification) => {
                  const meta =
                  TYPE_META[notification.type as NotificationType] ?? TYPE_META.system;

                let targetUrl = null;
                let viewText = null;

                if ((notification.type as string) === 'payroll') {
                  targetUrl = '/employee/salary';
                  viewText = '· View Salary';
                } else if (notification.related_project_id) {
                  targetUrl = `/projects/${notification.related_project_id}`;
                  viewText = '· View Project';
                }

                const notificationContent = (
                  <>
                    {/* Type emoji */}
                    <div className="flex-shrink-0 text-xl leading-none mt-0.5">
                      {meta.emoji}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p
                          className={cn(
                            "text-sm leading-snug tracking-tight",
                            !notification.is_read
                              ? "font-bold text-slate-900 dark:text-white"
                              : "font-medium text-slate-600 dark:text-slate-400"
                          )}
                        >
                          {notification.title}
                        </p>
                        {!notification.is_read && (
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              markAsRead(notification.id);
                            }}
                            title="Mark as read"
                            className="flex-shrink-0 p-1 rounded-md text-gray-300 hover:text-indigo-500 hover:bg-indigo-50 opacity-0 group-hover:opacity-100 transition-all"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      <p className="text-xs text-slate-500 dark:text-slate-500 mt-1 leading-relaxed">
                        {notification.message}
                      </p>

                      <div className="flex items-center gap-2 mt-1.5">
                        {/* Unread dot */}
                        {!notification.is_read && (
                          <span
                            className={cn(
                              "w-1.5 h-1.5 rounded-full flex-shrink-0",
                              meta.dotColor
                            )}
                          />
                        )}
                        <time className="text-[11px] text-slate-400 dark:text-slate-600 font-medium">
                          {formatDistanceToNow(
                            new Date(notification.created_at),
                            { addSuffix: true }
                          )}
                        </time>
                        {viewText && (
                          <span className="text-[11px] text-indigo-500 font-black uppercase tracking-widest">
                            {viewText}
                          </span>
                        )}
                      </div>
                    </div>
                  </>
                );

                if (targetUrl) {
                  return (
                    <Link
                      key={notification.id}
                      href={targetUrl}
                      onClick={() => {
                        markAsRead(notification.id);
                        setIsOpen(false);
                      }}
                      className={cn(
                        "flex items-start gap-3 px-4 py-4 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group cursor-pointer text-left",
                        !notification.is_read && "bg-indigo-50/30 dark:bg-indigo-500/5"
                      )}
                    >
                      {notificationContent}
                    </Link>
                  );
                }

                return (
                  <div
                    key={notification.id}
                    className={cn(
                      "flex items-start gap-3 px-4 py-4 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors group text-left",
                      !notification.is_read && "bg-indigo-50/30 dark:bg-indigo-500/5"
                    )}
                  >
                    {notificationContent}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
