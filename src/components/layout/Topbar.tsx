"use client";

import React from "react";
import Link from "next/link";
import { Menu, LogOut, ChevronDown, User } from "lucide-react";
import { useSidebarStore } from "@/store/useSidebarStore";
import { useUser } from "@/hooks/useUser";
import { NotificationBell } from "./NotificationBell";
import { UploadMonitor } from "./UploadMonitor";
import { GlobalSearch } from "./GlobalSearch";
import { ThemeToggle } from "./ThemeToggle";

export function Topbar() {
  const { toggleMobile } = useSidebarStore();
  const { user, role, signOut } = useUser();

  const initials = (user?.name || "U")
    .split(" ")
    .map((n: string) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between px-6 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200 dark:border-white/10">

      {/* ── Left: Mobile hamburger + Search ── */}
      <div className="flex items-center gap-4">
        {/* Mobile hamburger */}
        <button
          onClick={toggleMobile}
          aria-label="Open navigation"
          className="lg:hidden p-2 rounded-md text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Global search command palette */}
        <GlobalSearch />
      </div>

      {/* ── Right: Actions + User ── */}
      <div className="flex items-center gap-2">
        {/* Background Upload Monitor */}
        <UploadMonitor />

        {/* Theme Toggle */}
        <ThemeToggle />

        {/* Notifications */}
        <NotificationBell />

        {/* Divider */}
        <div className="w-px h-6 bg-slate-200 dark:bg-white/10 mx-2" />

        {/* User profile */}
        <div className="group relative flex items-center gap-2.5 cursor-pointer">
          {/* Avatar */}
          <div className="w-8 h-8 rounded-full bg-yellow-400 text-slate-950 flex items-center justify-center flex-shrink-0 shadow-[0_2px_12px_rgba(250,204,21,0.5)] font-black">
            <span className="text-xs">{initials}</span>
          </div>

          {/* Name + role (desktop) */}
          <div className="hidden md:flex flex-col items-start leading-none">
            <span className="text-sm font-bold text-slate-900 dark:text-white">
              {user?.name || "User"}
            </span>
            <span className="text-[10px] text-slate-400 dark:text-slate-500 font-black uppercase tracking-widest mt-0.5">
              {role?.replace("_", " ") || "Member"}
            </span>
          </div>

          <ChevronDown className="hidden md:block w-3.5 h-3.5 text-gray-400 group-hover:text-gray-600 transition-colors" />

          {/* Dropdown Menu Container */}
          <div className="absolute top-full right-0 pt-2 w-52 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none group-hover:pointer-events-auto z-50">
            <div className="glass-card border-yellow-400/30 shadow-2xl py-2 overflow-hidden bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl">
              <div className="px-4 py-3 border-b border-slate-100 dark:border-white/10 mb-1 bg-slate-50/50 dark:bg-white/5">
                <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{user?.name || "User"}</p>
                <p className="text-[10px] text-yellow-600 dark:text-yellow-400 font-extrabold uppercase tracking-widest truncate mt-0.5">{role?.replace("_", " ") || "Member"}</p>
              </div>
              
              <Link
                href="/profile"
                className="flex items-center gap-3 w-full text-left px-4 py-3 text-[13px] text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 transition-all font-bold group/profile"
              >
                <User className="w-4 h-4 text-slate-400 group-hover/profile:text-yellow-500 transition-colors" />
                My Profile
              </Link>

              <button
                onClick={() => signOut()}
                className="flex items-center gap-3 w-full text-left px-4 py-3 text-[13px] text-rose-500 hover:bg-rose-500/10 transition-all font-bold group/btn border-t border-slate-100 dark:border-white/5"
              >
                <LogOut className="w-4 h-4 transition-transform group-hover/btn:-translate-x-1" />
                Sign out
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
