"use client";

import { 
  Home, 
  FileText, 
  Inbox, 
  FileEdit, 
  CheckCircle2, 
  Scroll, 
  Users, 
  Megaphone, 
  Clock, 
  CalendarCheck, 
  PlaneTakeoff, 
  FolderKanban, 
  Target, 
  DollarSign,
  Landmark, 
  AlertCircle, 
  Scale, 
  BarChart2, 
  Settings, 
  Building2, 
  ShieldAlert,
  Printer
} from "lucide-react";
import { BaseSidebar } from "./BaseSidebar";
import { SidebarLink } from "./BaseSidebar";
import { useUser } from "@/hooks/useUser";

export function AccountsSidebar() {
  const { role } = useUser();

  const links: SidebarLink[] = [
    { title: "Dashboard", href: "/accounts", icon: Home },

    {
      title: "Projects",
      icon: FolderKanban,
      subLinks: [
        { title: "All Projects", href: "/projects", icon: FolderKanban },
        { title: "Print Desk", href: "/prints", icon: Printer },
        { title: "Milestones", href: "/accounts/milestones", icon: Target },
        { title: "Billing & Collections", href: "/accounts/billing", icon: DollarSign },
      ]
    },

    {
      title: "Banking",
      icon: Landmark,
      subLinks: [
        { title: "Bank Accounts", href: "/accounts/banks", icon: Landmark },
        { title: "Print Ledger", href: "/accounts/prints", icon: Printer },
        { title: "Ledger", href: "/accounts/ledger", icon: Scroll },
        { title: "Outstanding Payments", href: "/accounts/outstanding", icon: AlertCircle },
        { title: "Payroll", href: "/accounts/payroll", icon: FileText },
        { title: "Reconciliation", href: "/accounts/reconciliation", icon: Scale },
        { title: "Financial Reports", href: "/accounts/reports", icon: BarChart2 },
      ]
    },

    {
      title: "Workplace",
      icon: Users,
      subLinks: [
        { title: "Announcements", href: "/announcements", icon: Megaphone },
        { title: "EOD Reports", href: "/eod", icon: Clock },
        { title: "My Attendance", href: "/attendance", icon: CalendarCheck },
        { title: "Apply Leave", href: "/leaves", icon: PlaneTakeoff },
      ]
    },

    {
      title: "Company Settings",
      icon: Settings,
      subLinks: [
        { title: "Company Details", href: "/settings/details", icon: Building2 },
        ...(role === "admin" ? [{ title: "Audit Logs", href: "/accounts/audit", icon: ShieldAlert }] : [])
      ]
    }
  ];

  return <BaseSidebar links={links} />;
}
