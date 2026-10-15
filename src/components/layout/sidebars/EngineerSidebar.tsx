"use client";

import { LayoutDashboard, FileText, BookOpen, Clock, CalendarCheck, PlaneTakeoff, Megaphone, Printer } from "lucide-react";
import { BaseSidebar } from "./BaseSidebar";

export function EngineerSidebar() {
  const engineerLinks = [
    { title: "Dashboard", href: "/engineer", icon: LayoutDashboard },
    { title: "Projects", href: "/projects", icon: FileText },
    { title: "Print Desk", href: "/prints", icon: Printer },
    { title: "SOP Library", href: "/sop", icon: BookOpen },
    { title: "EOD Reports", href: "/eod", icon: Clock },
    { title: "My Attendance", href: "/attendance", icon: CalendarCheck },
    { title: "Apply Leave", href: "/leaves", icon: PlaneTakeoff },
    { title: "Announcements", href: "/announcements", icon: Megaphone },
  ];

  return <BaseSidebar links={engineerLinks} />;
}
