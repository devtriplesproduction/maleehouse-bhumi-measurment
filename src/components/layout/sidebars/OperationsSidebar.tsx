"use client";

import { Activity, LayoutDashboard, PenTool, MapPin, ClipboardCheck, FileText, BookOpen, Clock, CalendarCheck, PlaneTakeoff, Megaphone } from "lucide-react";
import { BaseSidebar } from "./BaseSidebar";
import { useUser } from "@/hooks/useUser";

export function OperationsSidebar() {
  const { role } = useUser();

  const operationsLinks: any[] = [];

  if (role === "engineer") operationsLinks.push({ title: "Engineering", href: "/engineer", icon: LayoutDashboard });
  if (role === "field") operationsLinks.push({ title: "Field Operations", href: "/field", icon: MapPin });
  if (role === "engineer") operationsLinks.push({ title: "Review Queue", href: "/review", icon: ClipboardCheck });

  operationsLinks.push(
    { title: "Assigned Projects", href: "/projects", icon: FileText },
    { title: "Procedures (SOP)", href: "/sop", icon: BookOpen },
    { title: "EOD Reports", href: "/eod", icon: Clock },
    { title: "My Attendance", href: "/attendance", icon: CalendarCheck },
    { title: "Apply Leave", href: "/leaves", icon: PlaneTakeoff },
    { title: "Announcements", href: "/announcements", icon: Megaphone }
  );

  return <BaseSidebar links={operationsLinks} />;
}
