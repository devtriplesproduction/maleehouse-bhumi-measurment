"use client";

import {
  Settings,
  Users,
  Building2,
  FileText,
  Landmark,
  FolderKanban,
  Briefcase,
  DollarSign,
  UserCheck,
  Megaphone,
  BarChart3,
  Activity,
  ScrollText,
  CalendarCheck,
  PlaneTakeoff,
  AlertCircle,
  Scale,
  Coins,
  PackageX,
  Printer,
  Wrench,
} from "lucide-react";
import { BaseSidebar } from "./BaseSidebar";

const adminLinks = [
  { title: "Dashboard", href: "/admin", icon: Activity },
  { isSeparator: true, title: "sep-org" },
  {
    title: "Organization",
    icon: Building2,
    subLinks: [
      { title: "Employees", href: "/admin/users", icon: Users },
      { title: "Departments", href: "/admin/hr/employees", icon: UserCheck },
    ],
  },
  {
    title: "Projects",
    icon: FolderKanban,
    subLinks: [
      { title: "All Projects", href: "/projects", icon: FileText },
      { title: "Print Desk", href: "/prints", icon: Printer },
      { title: "Equipment Catalog", href: "/equipments", icon: Wrench },
      { title: "Lost Equipment", href: "/admin/lost-materials", icon: PackageX },
      { title: "Milestones", href: "/admin/milestones", icon: ScrollText },
      { title: "Clients", href: "/clients", icon: Briefcase },
    ],
  },
  {
    title: "Banking",
    icon: Landmark,
    subLinks: [
      { title: "Bank Accounts", href: "/accounts/banks", icon: Landmark },
      { title: "Ledger", href: "/accounts/ledger", icon: ScrollText },
      { title: "Outstanding Payments", href: "/accounts/outstanding", icon: AlertCircle },
      { title: "Reconciliation", href: "/accounts/reconciliation", icon: Scale },
    ],
  },
  {
    title: "Finance",
    icon: DollarSign,
    subLinks: [
      { title: "Billing & Collections", href: "/accounts/billing", icon: Coins },
      { title: "Print Ledger", href: "/accounts/prints", icon: Printer },
      { title: "Payroll", href: "/admin/hr/payroll", icon: DollarSign },
      { title: "Reports", href: "/accounts/reports", icon: BarChart3 },
    ],
  },
  {
    title: "HR",
    icon: UserCheck,
    subLinks: [
      { title: "Attendance", href: "/admin/hr/attendance", icon: CalendarCheck },
      { title: "Leave Management", href: "/leaves", icon: PlaneTakeoff },
      { title: "Announcements", href: "/announcements", icon: Megaphone },
    ],
  },
  {
    title: "Administration",
    icon: Settings,
    subLinks: [
      { title: "Company Settings", href: "/settings/details", icon: Building2 },
    ],
  },
];

export function AdminSidebar() {
  return <BaseSidebar links={adminLinks} />;
}
