"use client";

import React, { useState, useTransition, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";
import {
  Users, UserPlus, Mail, Search, Calendar, Key, Eye, AlertCircle, RefreshCw, Shield, ShieldCheck, Lock, Unlock, Wallet, Loader2, FileText,
  EyeOff, ChevronLeft, ChevronRight, ArrowUpRight, Gift
} from "lucide-react";
import * as XLSX from "xlsx";
import { cn } from "@/lib/utils";
import {
  toggleUserActiveAction,
  offboardEmployeeAction,
  deleteEmployeeAction,
  getAdminAuditLogsAction,
  getAllUsersAction
} from "@/actions/admin.actions";
import {
  calculateMonthlyPayrollAction,
  lockPayrollCycleAction,
  unlockPayrollCycleAction
} from "@/actions/payroll.actions";
import { OnboardUserModal } from "@/components/modules/OnboardUserModal";
import { EmployeeProfileModal } from "@/components/modules/EmployeeProfileModal";
import { PageHeader } from "@/components/modules/PageHeader";
import { useToast } from "@/hooks/use-toast";
import { DEPARTMENTS } from "@/config/departments";
import { Button } from "@/components/ui/button";
import { Select, SelectItem } from "@/components/ui/select";

interface UserProfile {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
  phone_number?: string;
  employee_id?: string;
  department?: string;
  designation?: string;
  dob?: string;
  gender?: string;
  personal_email?: string;
  address?: string;
  emergency_contact?: string;
  profile_photo?: string;
  employment_type?: string;
  salary?: number;
  experience?: number;
  location?: string;
  reporting_manager_id?: string;
  department_head_id?: string;
  branch?: string;
  office_location?: string;
  operational_zone?: string;
  approval_authority?: boolean;
  escalation_chain?: any[];
  status?: string;
  documents?: any[];
  joining_date?: string;
}

interface UserManagementTableProps {
  initialUsers: UserProfile[];
  initialAuditLogs?: any[];
  defaultTab?: "directory" | "payroll" | "security" | "birthdays";
}


export function UserManagementTable({ initialUsers, initialAuditLogs = [], defaultTab = "directory" }: UserManagementTableProps) {
  const [users, setUsers] = useState<UserProfile[]>(initialUsers);
  const [activeTab, setActiveTab] = useState<"directory" | "payroll" | "security" | "birthdays">(defaultTab);

  // Filtering & Search state
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDept, setSelectedDept] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");

  const [currentPage, setCurrentPage] = useState(1);
  const [currentPayrollPage, setCurrentPayrollPage] = useState(1);
  const [currentBirthdayPage, setCurrentBirthdayPage] = useState(1);
  const [currentSecurityPage, setCurrentSecurityPage] = useState(1);
  const PAGE_SIZE = 10;

  // Modals state
  const [isNewUserModalOpen, setIsNewUserModalOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<UserProfile | null>(null);
  const [activeMenuUserId, setActiveMenuUserId] = useState<string | null>(null);

  // Payroll state
  const [payrollMonth, setPayrollMonth] = useState(new Date().getMonth() + 1);
  const [payrollYear, setPayrollYear] = useState(new Date().getFullYear());
  const [payrollData, setPayrollData] = useState<any[]>([]);
  const [isPayrollLocked, setIsPayrollLocked] = useState(false);
  const [isPayrollLoading, setIsPayrollLoading] = useState(false);
  const [isLockingPayroll, setIsLockingPayroll] = useState(false);
  const [isUnlockingPayroll, setIsUnlockingPayroll] = useState(false);
  const [payrollSearch, setPayrollSearch] = useState("");

  // Security state
  const [auditLogs, setAuditLogs] = useState<any[]>(initialAuditLogs);
  const [isLogsLoading, setIsLogsLoading] = useState(false);
  const [overridePasswords, setOverridePasswords] = useState<Record<string, string>>({});
  const [visiblePasswords, setVisiblePasswords] = useState<Record<string, boolean>>({});
  const [isOverriding, setIsOverriding] = useState<Record<string, boolean>>({});
  const [oneTimePassModal, setOneTimePassModal] = useState<string | null>(null);

  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const handleRefreshData = async () => {
    const res = await getAllUsersAction();
    if (res.success && res.data) {
      setUsers(res.data);
    }
  };

  // Fetch reactive data for payroll or security tabs
  const fetchPayroll = async (month: number, year: number) => {
    setIsPayrollLoading(true);
    try {
      const res = await calculateMonthlyPayrollAction(month, year);
      if (res.success && res.data) {
        setPayrollData(res.data);
        setIsPayrollLocked(!!res.isLocked);
      } else {
        toast({ title: "Failed to compute payroll", description: res?.error, variant: "error" });
      }
    } catch(err) {
      toast({ title: "Failed to compute payroll", variant: "error" });
    } finally {
      setIsPayrollLoading(false);
    }
  };

  const generateRandomPasswordForUser = (userId: string) => {
    const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
    let pwd = "";
    for (let i = 0; i < 12; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setOverridePasswords((prev) => ({ ...prev, [userId]: pwd }));
    setVisiblePasswords((prev) => ({ ...prev, [userId]: true }));
  };

  const handleManualOverride = async (userId: string, email: string) => {
    const pwd = overridePasswords[userId];
    if (!pwd || pwd.length < 6) {
      toast({ title: "Invalid", description: "Password must be at least 6 characters.", variant: "error" });
      return;
    }
    setIsOverriding((prev) => ({ ...prev, [userId]: true }));
    const { resetEmployeePasswordAction } = await import("@/actions/admin.actions");
    const result = await resetEmployeePasswordAction(userId, pwd);
    setIsOverriding((prev) => ({ ...prev, [userId]: false }));
    if (result.success) {
      setOverridePasswords((prev) => {
        const copy = { ...prev };
        delete copy[userId];
        return copy;
      });
      setOneTimePassModal(pwd);
    } else {
      toast({ title: "Error", description: result.error || "Failed to update.", variant: "error" });
    }
  };

  const fetchAuditLogs = async () => {
    setIsLogsLoading(true);
    try {
      const res = await getAdminAuditLogsAction();
      if (res.success && res.data) {
        setAuditLogs(res.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLogsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "payroll") {
      fetchPayroll(payrollMonth, payrollYear);
    }
  }, [activeTab, payrollMonth, payrollYear]);

  const handleLockPayroll = async () => {
    if (!confirm(`Are you absolutely sure you want to FREEZE payroll for ${payrollMonth}/${payrollYear}? This locks the data cycle and logs immutable records.`)) return;
    setIsLockingPayroll(true);
    try {
      const res = await lockPayrollCycleAction(payrollMonth, payrollYear);
      if (res?.success) {
        toast({ title: "Payroll Frozen", description: res.message, variant: "success" });
        fetchPayroll(payrollMonth, payrollYear);
      } else {
        toast({ title: "Lock Failed", description: res?.error, variant: "error" });
      }
    } catch(err) {
      toast({ title: "Lock failed", variant: "error" });
    } finally {
      setIsLockingPayroll(false);
    }
  };

  const handleUnlockPayroll = async () => {
    if (!confirm(`Are you absolutely sure you want to UNLOCK payroll for ${payrollMonth}/${payrollYear}? This will delete the frozen snapshot and allow dynamic recalculation.`)) return;
    setIsUnlockingPayroll(true);
    try {
      const res = await unlockPayrollCycleAction(payrollMonth, payrollYear);
      if (res?.success) {
        toast({ title: "Payroll Unlocked", description: res.message, variant: "success" });
        fetchPayroll(payrollMonth, payrollYear);
      } else {
        toast({ title: "Unlock Failed", description: res?.error, variant: "error" });
      }
    } catch(err) {
      toast({ title: "Unlock failed", variant: "error" });
    } finally {
      setIsUnlockingPayroll(false);
    }
  };

  // Status: semantic colors only
  const getStatusBadgeStyles = (status?: string) => {
    switch (status) {
      case "active": return "bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/25";
      case "onboarding_pending": return "bg-amber-50 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-500/25";
      case "invited": return "bg-sky-50 dark:bg-sky-500/15 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-500/25";
      case "suspended": return "bg-rose-50 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-500/25";
      case "resigned": return "bg-slate-100 dark:bg-slate-500/15 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-500/25";
      case "archived": return "bg-slate-100 dark:bg-slate-500/15 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-500/25";
      default: return "bg-slate-100 dark:bg-slate-500/15 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-slate-500/25";
    }
  };

  // Role: always indigo (primary theme accent)
  const getRoleBadgeStyles = (_roleStr?: string) =>
    "bg-indigo-50 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-500/25";

  // Department: always violet (secondary accent)
  const getDeptBadgeStyles = (_dept?: string) =>
    "bg-violet-50 dark:bg-violet-500/15 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-500/25";



  // Combined Filters Logic
  const filteredUsers = useMemo(() => {
    return users.filter((u: any) => {
      const fullName = `${u.first_name || ""} ${u.last_name || ""}`.toLowerCase();
      const email = (u.email || "").toLowerCase();
      const employeeId = (u.employee_id || "").toLowerCase();
      const search = searchTerm.toLowerCase();

      const matchesSearch = fullName.includes(search) || email.includes(search) || employeeId.includes(search);
      const matchesDept = selectedDept === "all" || u.department === selectedDept;

      // If "all" is selected, hide terminated and resigned users by default so they appear "deleted"
      const isDeletedStatus = u.status === 'terminated' || u.status === 'resigned' || u.status === 'archived';
      const matchesStatus = selectedStatus === "all" ? !isDeletedStatus : u.status === selectedStatus;

      // Exclude system admin from personnel directory
      return matchesSearch && matchesDept && matchesStatus && u.role !== 'admin';
    });
  }, [users, searchTerm, selectedDept, selectedStatus]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedDept, selectedStatus]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedUsers = useMemo(() => {
    return filteredUsers.slice((safeCurrentPage - 1) * PAGE_SIZE, safeCurrentPage * PAGE_SIZE);
  }, [filteredUsers, safeCurrentPage]);

  // Account Status administrative toggle
  const handleToggleStatus = async (userId: string, currentStatus: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    startTransition(async () => {
      const result = await toggleUserActiveAction(userId, !currentStatus);
      if (result?.success) {
        toast({
          title: "Access Override Triggered",
          description: `Employee profile successfully ${!currentStatus ? 'activated' : 'suspended'}.`,
          variant: "success"
        });
        handleRefreshData();
      } else {
        toast({
          title: "Administrative Gate Denied",
          description: result?.error || "Failed to update profile access",
          variant: "error"
        });
      }
    });
  };

  // Offboard employee
  const handleOffboardEmployee = async (userId: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Are you sure you want to offboard ${name}? This will suspend system access and mark their status as resigned.`)) {
      startTransition(async () => {
        const result = await offboardEmployeeAction(userId);
        if (result?.success) {
          toast({
            title: "Employee Offboarded",
            description: `${name} has been successfully offboarded and status updated to resigned.`,
            variant: "success"
          });
          handleRefreshData();
        } else {
          toast({
            title: "Offboarding Failed",
            description: result?.error || "Failed to offboard employee",
            variant: "error"
          });
        }
      });
    }
  };

  // Delete employee
  const handleDeleteEmployee = async (userId: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`⚠️ WARNING: Are you sure you want to PERMANENTLY delete ${name}? This action is irreversible and will delete their entire profile.`)) {
      startTransition(async () => {
        const result = await deleteEmployeeAction(userId);
        if (result?.success) {
          toast({
            title: "Employee Deleted",
            description: `${name} has been permanently deleted from the system.`,
            variant: "success"
          });
          handleRefreshData();
        } else {
          toast({
            title: "Deletion Failed",
            description: result?.error || "Failed to delete employee",
            variant: "error"
          });
        }
      });
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Credential Copied",
      description: "Temporary key copied safely to clipboard buffer.",
      variant: "success"
    });
  };




  const filteredPayrollData = useMemo(() => {
    if (!payrollSearch.trim()) return payrollData;
    const query = payrollSearch.toLowerCase().trim();
    return payrollData.filter((item: any) =>
      item.employee_name?.toLowerCase().includes(query) ||
      item.employee_id_external?.toLowerCase().includes(query) ||
      item.department?.toLowerCase().includes(query) ||
      item.designation?.toLowerCase().includes(query)
    );
  }, [payrollData, payrollSearch]);

  useEffect(() => {
    setCurrentPayrollPage(1);
  }, [payrollSearch, payrollMonth, payrollYear]);

  const totalPayrollPages = Math.max(1, Math.ceil(filteredPayrollData.length / PAGE_SIZE));
  const safeCurrentPayrollPage = Math.min(currentPayrollPage, totalPayrollPages);
  const paginatedPayrollData = useMemo(() => {
    return filteredPayrollData.slice((safeCurrentPayrollPage - 1) * PAGE_SIZE, safeCurrentPayrollPage * PAGE_SIZE);
  }, [filteredPayrollData, safeCurrentPayrollPage]);

  const birthdayUsers = useMemo(() => {
    return [...(users || [])].filter((u: any) => u.status?.toLowerCase() !== 'terminated').sort((a, b) => {
      if (!a.dob) return 1;
      if (!b.dob) return -1;
      const dateA = new Date(a.dob);
      const dateB = new Date(b.dob);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      let nextA = new Date(today.getFullYear(), dateA.getMonth(), dateA.getDate());
      if (nextA < today) nextA.setFullYear(today.getFullYear() + 1);
      let nextB = new Date(today.getFullYear(), dateB.getMonth(), dateB.getDate());
      if (nextB < today) nextB.setFullYear(today.getFullYear() + 1);
      return nextA.getTime() - nextB.getTime();
    });
  }, [users]);
  const totalBirthdayPages = Math.max(1, Math.ceil(birthdayUsers.length / PAGE_SIZE));
  const safeCurrentBirthdayPage = Math.min(currentBirthdayPage, totalBirthdayPages);
  const paginatedBirthdayUsers = useMemo(() => {
    return birthdayUsers.slice((safeCurrentBirthdayPage - 1) * PAGE_SIZE, safeCurrentBirthdayPage * PAGE_SIZE);
  }, [birthdayUsers, safeCurrentBirthdayPage]);

  const securityUsers = useMemo(() => users || [], [users]);
  const totalSecurityPages = Math.max(1, Math.ceil(securityUsers.length / PAGE_SIZE));
  const safeCurrentSecurityPage = Math.min(currentSecurityPage, totalSecurityPages);
  const paginatedSecurityUsers = useMemo(() => {
    return securityUsers.slice((safeCurrentSecurityPage - 1) * PAGE_SIZE, safeCurrentSecurityPage * PAGE_SIZE);
  }, [securityUsers, safeCurrentSecurityPage]);

  const zeroAbsenceCount = useMemo(() => {
    return payrollData.filter((item: any) => (item.days_absent || 0) === 0).length;
  }, [payrollData]);

  const activePayrollCount = payrollData.length;

  const totalBaseSalary = useMemo(() => {
    return payrollData.reduce((sum: any, item: any) => sum + (item.base_salary || 0), 0);
  }, [payrollData]);

  const totalNetPayable = useMemo(() => {
    return payrollData.reduce((sum: any, item: any) => sum + (item.net_payable || 0), 0);
  }, [payrollData]);

  const handlePrevMonth = () => {
    if (payrollMonth === 1) {
      setPayrollMonth(12);
      setPayrollYear(prev => prev - 1);
    } else {
      setPayrollMonth(prev => prev - 1);
    }
  };

  const handleNextMonth = () => {
    if (payrollMonth === 12) {
      setPayrollMonth(1);
      setPayrollYear(prev => prev + 1);
    } else {
      setPayrollMonth(prev => prev + 1);
    }
  };

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  return (
    <div className="space-y-6 font-sans">

      {/* Global Title & Stats Header Row using PageHeader */}
      <PageHeader
        title="Team Management"
        subtitle="Manage permissions, invite surveyors, and maintain system security."
        actions={
          <>
            <Button
              onClick={() => {
                const exportData = users.map(user => ({
                  'Employee ID': user.employee_id || 'N/A',
                  'First Name': user.first_name,
                  'Last Name': user.last_name,
                  'Email': user.email,
                  'Personal Email': user.personal_email || 'N/A',
                  'Phone Number': user.phone_number || 'N/A',
                  'Role': user.role,
                  'Department': user.department || 'N/A',
                  'Designation': user.designation || 'N/A',
                  'Status': user.status || (user.is_active ? "active" : "suspended"),
                  'Joining Date': user.joining_date || 'N/A',
                  'DOB': user.dob || 'N/A',
                  'Gender': user.gender || 'N/A',
                  'Address': user.address || 'N/A',
                  'Emergency Contact': user.emergency_contact || 'N/A',
                  'Employment Type': user.employment_type || 'N/A',
                  'Salary': user.salary || 'N/A',
                  'Experience': user.experience || 'N/A',
                  'Location': user.location || 'N/A',
                  'Branch': user.branch || 'N/A',
                  'Office Location': user.office_location || 'N/A',
                  'Operational Zone': user.operational_zone || 'N/A',

                }));
                const worksheet = XLSX.utils.json_to_sheet(exportData);
                const workbook = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(workbook, worksheet, "Employees");
                XLSX.writeFile(workbook, "Employee_Directory.xlsx");
              }}
              variant="outline"
              className="flex items-center gap-3 text-xs font-bold tracking-wider h-10 px-4 border-indigo-200 text-indigo-600 hover:bg-indigo-50 dark:border-indigo-500/30 dark:text-indigo-400 dark:hover:bg-indigo-500/10"
            >
              <FileText className="w-4 h-4" />
              Export Excel
            </Button>
            <Button
              onClick={() => setIsNewUserModalOpen(true)}
              variant="hr"
              className="flex items-center gap-2 text-xs font-bold tracking-wider h-10 px-4"
            >
              <UserPlus className="w-4 h-4" />
              Onboard Employee
            </Button>
          </>
        }
      />

      {/* Minified Quick Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Total Staff */}
        <div className="glass-card px-4 py-3 flex items-center justify-between border-indigo-500/10 hover:border-indigo-500/20 transition-all duration-300">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-indigo-500/10 dark:bg-indigo-500/20 rounded-xl flex items-center justify-center text-indigo-500 border border-indigo-500/20 shadow-inner">
              <Users className="w-4.5 h-4.5" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none">Total Staff</span>
              <span className="text-lg font-bold text-slate-900 dark:text-white mt-1.5 leading-none">{users.length}</span>
            </div>
          </div>
        </div>

        {/* Card 2: Active Accounts */}
        <div className="glass-card px-4 py-3 flex items-center justify-between border-emerald-500/10 hover:border-emerald-500/20 transition-all duration-300">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-emerald-500/10 dark:bg-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-500 border border-emerald-500/20 shadow-inner">
              <ShieldCheck className="w-4.5 h-4.5" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none">Active Accounts</span>
              <span className="text-lg font-bold text-slate-900 dark:text-white mt-1.5 leading-none">
                {users.filter((u: any) => u.is_active).length}
              </span>
            </div>
          </div>
        </div>

        {/* Card 3: Admins */}
        <div className="glass-card px-4 py-3 flex items-center justify-between border-amber-500/10 hover:border-amber-500/20 transition-all duration-300">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-amber-500/10 dark:bg-amber-500/20 rounded-xl flex items-center justify-center text-amber-500 border border-amber-500/20 shadow-inner">
              <Shield className="w-4.5 h-4.5" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest leading-none">Admins</span>
              <span className="text-lg font-bold text-slate-900 dark:text-white mt-1.5 leading-none">
                {users.filter((u: any) => u.role === 'admin').length}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Global Tab Navigation */}
      <div className="flex border-b border-slate-200 dark:border-white/5 mb-6 overflow-x-auto gap-8 scrollbar-none">
        <button
          onClick={() => setActiveTab("directory")}
          className={cn(
            "flex items-center gap-2 px-2 py-4 text-sm font-bold transition-all relative shrink-0",
            activeTab === "directory"
              ? "text-indigo-600 dark:text-indigo-400 font-extrabold"
              : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          )}
        >
          <Users className="w-4 h-4" />
          Personnel Directory
          {activeTab === "directory" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
          )}
        </button>



        <button
          onClick={() => setActiveTab("security")}
          className={cn(
            "flex items-center gap-2 px-2 py-4 text-sm font-bold transition-all relative shrink-0",
            activeTab === "security"
              ? "text-indigo-600 dark:text-indigo-400 font-extrabold"
              : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          )}
        >
          <Shield className="w-4 h-4" />
          Account Security
          {activeTab === "security" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
          )}
        </button>

        <button
          onClick={() => setActiveTab("birthdays")}
          className={cn(
            "flex items-center gap-2 px-2 py-4 text-sm font-bold transition-all relative shrink-0",
            activeTab === "birthdays"
              ? "text-indigo-600 dark:text-indigo-400 font-extrabold"
              : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          )}
        >
          <Gift className="w-4 h-4" />
          Birthday Details
          {activeTab === "birthdays" && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
          )}
        </button>
      </div>

      {/* 1. TAB: PERSONNEL DIRECTORY                                               */}
      {activeTab === "directory" && (
        <div className="space-y-6 font-sans">

          <div className="glass-card overflow-hidden">
            {/* ── Toolbar ── */}
            <div className="sticky top-0 z-10 backdrop-blur-xl px-6 py-4 border-b border-slate-200/60 dark:border-white/5 flex flex-col lg:flex-row gap-3 lg:items-center justify-between bg-white/60 dark:bg-[#0c101b]/60">
              {/* Search */}
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search by name, email, or serial ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/8 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 outline-none transition-all text-sm placeholder:text-slate-400 text-slate-800 dark:text-white"
                />
              </div>

              {/* Select filters */}
              <div className="flex flex-wrap items-center gap-2.5">


                <Select
                  value={selectedDept}
                  onValueChange={(val) => {
                    setSelectedDept(val);
                  }}
                  placeholder="All Departments"
                  className="w-40"
                  buttonClassName="h-9 px-3.5"
                >
                  <SelectItem value="all">All Departments</SelectItem>
                  {DEPARTMENTS.map((d: any) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </Select>

                <Select
                  value={selectedStatus}
                  onValueChange={(val) => setSelectedStatus(val)}
                  placeholder="All Statuses"
                  className="w-40"
                  buttonClassName="h-9 px-3.5"
                >
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="invited">Invited</SelectItem>
                  <SelectItem value="onboarding_pending">Onboarding Pending</SelectItem>
                  <SelectItem value="suspended">Suspended</SelectItem>
                  <SelectItem value="terminated">Terminated</SelectItem>
                </Select>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-separate border-spacing-y-2 min-w-[700px]">
                <thead>
                  <tr>
                    <th className="px-6 py-3.5 text-xs font-black uppercase tracking-[0.18em] text-slate-400">Employee</th>
                    <th className="px-6 py-3.5 text-xs font-black uppercase tracking-[0.18em] text-slate-400">Role</th>
                    <th className="px-6 py-3.5 text-xs font-black uppercase tracking-[0.18em] text-slate-400">Department</th>
                    <th className="px-6 py-3.5 text-xs font-black uppercase tracking-[0.18em] text-slate-400">Contact</th>
                    <th className="px-6 py-3.5 text-xs font-black uppercase tracking-[0.18em] text-slate-400">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-24 text-center">
                        <div className="flex flex-col items-center gap-4">
                          <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-white/5 flex items-center justify-center">
                            <Users className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-400 dark:text-slate-500">
                              No personnel found
                            </p>
                            <p className="text-xs text-slate-400 dark:text-slate-600 mt-1">
                              Try adjusting your search or filter criteria.
                            </p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedUsers.map((user) => (
                      <tr
                        key={user.id}
                        onClick={() => setSelectedEmployee(user)}
                        className="group bg-slate-50/50 dark:bg-white/[0.02] hover:bg-white dark:hover:bg-white/[0.04] hover:-translate-y-0.5 hover:shadow-md hover:shadow-indigo-500/5 transition-all duration-300 cursor-pointer [&>td:first-child]:rounded-l-2xl [&>td:last-child]:rounded-r-2xl"
                      >
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2.5">
                            <div className="relative shrink-0">
                              <div className="relative w-10 h-10 rounded-full border border-slate-200 dark:border-white/10 bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-sm uppercase overflow-hidden">
                                {user.first_name?.[0] || ""}{user.last_name?.[0] || ""}
                                {user.profile_photo && (
                                  <img
                                    src={`/api/avatar/${user.id}`}
                                    alt={`${user.first_name} avatar`}
                                    className="absolute inset-0 w-full h-full object-cover"
                                    onError={(e) => {
                                      e.currentTarget.style.display = 'none';
                                    }}
                                  />
                                )}
                              </div>
                              <span className={cn(
                                "absolute bottom-0 right-0 z-10 w-2.5 h-2.5 rounded-full border border-white dark:border-[#0c101b]",
                                user.is_active ? "bg-emerald-500" : "bg-slate-400"
                              )} />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-800 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors leading-snug">
                                {user.first_name} {user.last_name}
                              </p>
                              <p className="text-xs font-mono text-slate-400 mt-0.5">
                                {user.employee_id || "MH-EMP-N/A"}
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-6 py-4">
                          <span className={cn("px-2.5 py-1 rounded-full text-xs font-semibold capitalize shadow-sm whitespace-nowrap", getRoleBadgeStyles(user.designation?.replace("_", " ") || user.role))}>
                            {user.designation?.replace("_", " ") || user.role}
                          </span>
                        </td>

                        <td className="px-6 py-4">
                          <span className={cn(
                            "px-2.5 py-1 rounded-full text-xs font-semibold capitalize inline-block whitespace-nowrap",
                            getDeptBadgeStyles(user.department)
                          )}>
                            {user.department || "General"}
                          </span>
                        </td>

                        <td className="px-6 py-4">
                          <p className="text-sm font-medium text-slate-600 dark:text-slate-300 flex items-center gap-1.5 whitespace-nowrap">
                            <Mail className="w-3.5 h-3.5 text-slate-400" />
                            {user.email}
                          </p>
                        </td>

                        <td className="px-6 py-4">
                          <span className={cn(
                            "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold",
                            getStatusBadgeStyles(user.status)
                          )}>
                            <span className={cn("w-1.5 h-1.5 rounded-full", user.is_active ? "bg-emerald-500" : "bg-slate-400")} />
                            {user.status?.replace("_", " ") || (user.is_active ? "Active" : "Suspended")}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* ── Footer ── */}
            {filteredUsers.length > 0 && (
              <div className="px-6 py-3 border-t border-slate-100 dark:border-white/5 flex flex-col md:flex-row items-center justify-between gap-4 bg-slate-50/50 dark:bg-white/[0.01]">
                <p className="text-xs text-slate-400 font-medium">
                  Showing{' '}
                  <span className="font-bold text-slate-600 dark:text-slate-300">
                    {(safeCurrentPage - 1) * PAGE_SIZE + 1}
                  </span>{' '}
                  –{' '}
                  <span className="font-bold text-slate-600 dark:text-slate-300">
                    {Math.min(safeCurrentPage * PAGE_SIZE, filteredUsers.length)}
                  </span>{' '}
                  of{' '}
                  <span className="font-bold text-slate-600 dark:text-slate-300">
                    {filteredUsers.length}
                  </span>{' '}
                  personnel
                </p>
                {totalPages > 1 && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={safeCurrentPage === 1}
                      className="flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-500 hover:text-indigo-600 hover:border-indigo-300 dark:hover:border-indigo-500/40 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>

                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`w-8 h-8 rounded-lg text-xs font-semibold transition-all border ${page === safeCurrentPage
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-500/20"
                          : "bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-500 hover:text-indigo-600 hover:border-indigo-300 dark:hover:border-indigo-500/40"
                          }`}
                      >
                        {page}
                      </button>
                    ))}

                    <button
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={safeCurrentPage === totalPages}
                      className="flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-500 hover:text-indigo-600 hover:border-indigo-300 dark:hover:border-indigo-500/40 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. TAB: INTEGRATED PAYROLL                                                */}
      {activeTab === "payroll" && (
        <div className="space-y-6 font-sans">

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card 1: Net Payout Sum */}
            <div className="glass-card p-6 relative overflow-hidden bg-white/50 dark:bg-white/[0.02]">
              <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/5 rounded-bl-full pointer-events-none" />
              <p className="text-3xl font-extrabold tracking-tight text-slate-800 dark:text-white">
                ₹{totalNetPayable.toLocaleString('en-IN')}
              </p>
              <div className="flex items-center gap-1.5 mt-3">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-sm font-bold text-slate-500 dark:text-slate-400 tracking-wider">
                  Cycle: {new Date(2026, payrollMonth - 1).toLocaleString('default', { month: 'long' })} {payrollYear}
                </span>
              </div>
            </div>

            {/* Card 2: Attendance Adjustments */}
            <div className="glass-card p-6 relative overflow-hidden bg-white/50 dark:bg-white/[0.02]">
              <div className="absolute top-0 right-0 w-24 h-24 bg-rose-500/5 rounded-bl-full pointer-events-none" />
              <p className="text-3xl font-extrabold tracking-tight text-slate-800 dark:text-white">
                ₹{(totalBaseSalary - totalNetPayable).toLocaleString('en-IN')}
              </p>
              <p className="text-sm font-bold text-rose-500 dark:text-rose-400/80 mt-3 tracking-wider">
                Attendance-based adjustments
              </p>
            </div>

            {/* Card 3: Absences Metric */}
            <div className="glass-card p-6 relative overflow-hidden bg-white/50 dark:bg-white/[0.02]">
              <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-bl-full pointer-events-none" />
              <p className="text-3xl font-extrabold tracking-tight text-slate-800 dark:text-white">
                {zeroAbsenceCount}/{payrollData.length || 0}
              </p>
              <p className="text-sm font-bold text-blue-500 dark:text-blue-400/80 mt-3 rcase tracking-wider">
                Employees with zero absences
              </p>
            </div>
          </div>

          <div className="glass-card overflow-hidden">
            {/* ── Toolbar ── */}
            <div className="px-6 py-4 border-b border-slate-200/60 dark:border-white/5 flex flex-col lg:flex-row gap-3 lg:items-center justify-between bg-white/50 dark:bg-white/[0.02]">
              {/* Search */}
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  type="text"
                  value={payrollSearch}
                  onChange={(e) => setPayrollSearch(e.target.value)}
                  placeholder="Filter financial records..."
                  className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/8 focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 outline-none transition-all text-sm placeholder:text-slate-400 text-slate-800 dark:text-white"
                />
              </div>

              {/* Navigation + Actions */}
              <div className="flex flex-wrap items-center gap-2.5">
                {/* Month selector with arrows */}
                <div className="flex items-center gap-1 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/8 rounded-xl p-0.5 shrink-0">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handlePrevMonth}
                    className="h-7 w-7 hover:bg-slate-200/50 dark:hover:bg-white/5 rounded-lg text-slate-500 dark:text-slate-400"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </Button>
                  <div className="px-3 text-sm font-bold text-slate-700 dark:text-slate-200 min-w-[100px] text-center">
                    {monthNames[payrollMonth - 1]} {payrollYear}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleNextMonth}
                    className="h-7 w-7 hover:bg-slate-200/50 dark:hover:bg-white/5 rounded-lg text-slate-500 dark:text-slate-400"
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </Button>
                </div>

                <Button
                  onClick={() => {
                    if (filteredPayrollData.length === 0) {
                      toast({ title: "No data", description: "No payroll records to export.", variant: "error" });
                      return;
                    }
                    const headers = ["Identity", "Department", "Designation", "Base Salary", "Attendance", "Deductions", "Net Payout"];
                    const rows = filteredPayrollData.map((item: any) => {
                      const totalDays = 26;
                      const earnedDays = item.days_present + item.days_field + item.days_paid_leave;
                      const deductions = item.base_salary - item.net_payable;
                      return [
                        item.employee_name || '',
                        item.department || '',
                        item.designation || '',
                        item.base_salary || 0,
                        `${earnedDays}D / ${totalDays}D`,
                        deductions,
                        item.net_payable || 0
                      ];
                    });

                    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
                    const workbook = XLSX.utils.book_new();
                    XLSX.utils.book_append_sheet(workbook, worksheet, "Payroll Report");
                    XLSX.writeFile(workbook, `Payroll_Report_${monthNames[payrollMonth - 1]}_${payrollYear}.xlsx`);
                  }}
                  variant="outline"
                  className="h-9 px-3.5 flex items-center gap-2 border-slate-200 dark:border-white/8 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl text-sm font-medium"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Reports
                </Button>

                <Button
                  onClick={isPayrollLocked ? handleUnlockPayroll : handleLockPayroll}
                  disabled={(isPayrollLocked ? isUnlockingPayroll : isLockingPayroll) || payrollData.length === 0}
                  variant={isPayrollLocked ? "outline" : "hr"}
                  className={cn(
                    "h-9 px-4 flex items-center gap-2 rounded-xl text-sm font-medium transition-all",
                    isPayrollLocked && "bg-emerald-600/10 text-emerald-500 border border-emerald-500/25 hover:bg-emerald-600/20"
                  )}
                >
                  {(isPayrollLocked ? isUnlockingPayroll : isLockingPayroll) ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : isPayrollLocked ? (
                    <Lock className="w-3.5 h-3.5" />
                  ) : (
                    <Unlock className="w-3.5 h-3.5" />
                  )}
                  {isPayrollLocked ? "Locked" : "Lock Cycle"}
                </Button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse min-w-[700px]">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-white/5">
                    <th className="px-6 py-3.5 text-xs font-black uppercase tracking-[0.18em] text-slate-400">Identity</th>
                    <th className="px-6 py-3.5 text-xs font-black uppercase tracking-[0.18em] text-slate-400">Base Salary</th>
                    <th className="px-6 py-3.5 text-xs font-black uppercase tracking-[0.18em] text-slate-400">Attendance</th>
                    <th className="px-6 py-3.5 text-xs font-black uppercase tracking-[0.18em] text-slate-400">Deductions</th>
                    <th className="px-6 py-3.5 text-xs font-black uppercase tracking-[0.18em] text-slate-400">Net Payout</th>
                    <th className="px-4 py-3.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/[0.04]">
                  {isPayrollLoading ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-24 text-center">
                        <div className="flex flex-col items-center gap-4">
                          <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                          <div>
                            <p className="text-sm font-bold text-slate-400 dark:text-slate-500">
                              Computing live metrics...
                            </p>
                            <p className="text-xs text-slate-400 dark:text-slate-600 mt-1">
                              Retrieving attendance records and wage proration factors.
                            </p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : filteredPayrollData.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-24 text-center">
                        <div className="flex flex-col items-center gap-4">
                          <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-white/5 flex items-center justify-center">
                            <Wallet className="w-8 h-8 text-slate-300 dark:text-slate-600" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-400 dark:text-slate-500">
                              No financial records found
                            </p>
                            <p className="text-xs text-slate-400 dark:text-slate-600 mt-1">
                              No personnel data available for this cycle.
                            </p>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    paginatedPayrollData.map((item) => {
                      const totalDays = 26;
                      const earnedDays = item.days_present + item.days_field + item.days_paid_leave;
                      const deductions = item.base_salary - item.net_payable;

                      return (
                        <tr
                          key={item.id}
                          className="group hover:bg-slate-50/80 dark:hover:bg-white/[0.03] transition-colors duration-150"
                        >
                          {/* Identity */}
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2.5">
                              <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold border shrink-0 bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 border-indigo-500/25">
                                {item.employee_name?.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-slate-800 dark:text-white leading-snug">
                                  {item.employee_name}
                                </p>
                                <p className="text-xs font-mono text-slate-400 mt-0.5 capitalize">
                                  {item.department || "General"} • {item.designation || "Staff"}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Base Salary */}
                          <td className="px-6 py-4">
                            <div>
                              <p className="text-sm font-semibold text-slate-800 dark:text-white">
                                ₹{(item.base_salary || 0).toLocaleString('en-IN')}
                              </p>
                              <p className="text-xs font-mono text-slate-400 mt-0.5">
                                Fixed Rate
                              </p>
                            </div>
                          </td>

                          {/* Attendance */}
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                                {earnedDays}D / {totalDays}D
                              </div>
                              <div className="w-16 h-1.5 bg-slate-100 dark:bg-white/5 rounded-full overflow-hidden shrink-0">
                                <div
                                  className="h-full bg-indigo-500 rounded-full"
                                  style={{ width: `${Math.min(100, (earnedDays / totalDays) * 100)}%` }}
                                />
                              </div>
                            </div>
                          </td>

                          {/* Deductions */}
                          <td className="px-6 py-4">
                            <span className={cn(
                              "text-sm font-semibold",
                              deductions > 0 ? "text-rose-600 dark:text-rose-400" : "text-slate-500 dark:text-slate-400"
                            )}>
                              {deductions > 0 ? `-₹${deductions.toLocaleString('en-IN')}` : "₹0"}
                            </span>
                          </td>

                          {/* Net Payout */}
                          <td className="px-6 py-4">
                            <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                              ₹{(item.net_payable || 0).toLocaleString('en-IN')}
                            </span>
                          </td>

                          {/* Action Details */}
                          <td className="px-4 py-4 text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 hover:bg-slate-100 dark:hover:bg-white/10 text-slate-400 hover:text-indigo-500 rounded-xl transition-all"
                            >
                              <ArrowUpRight className="w-4 h-4" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Footer */}
            {!isPayrollLoading && filteredPayrollData.length > 0 && (
              <div className="px-6 py-3 border-t border-slate-100 dark:border-white/5 flex flex-col md:flex-row items-center justify-between gap-4 bg-slate-50/50 dark:bg-white/[0.01]">
                <p className="text-xs text-slate-400 font-medium">
                  Showing{' '}
                  <span className="font-bold text-slate-600 dark:text-slate-300">
                    {(safeCurrentPayrollPage - 1) * PAGE_SIZE + 1}
                  </span>{' '}
                  –{' '}
                  <span className="font-bold text-slate-600 dark:text-slate-300">
                    {Math.min(safeCurrentPayrollPage * PAGE_SIZE, filteredPayrollData.length)}
                  </span>{' '}
                  of{' '}
                  <span className="font-bold text-slate-600 dark:text-slate-300">
                    {filteredPayrollData.length}
                  </span>{' '}
                  records
                </p>
                {totalPayrollPages > 1 ? (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setCurrentPayrollPage((p) => Math.max(1, p - 1))}
                      disabled={safeCurrentPayrollPage === 1}
                      className="flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-500 hover:text-indigo-600 hover:border-indigo-300 dark:hover:border-indigo-500/40 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>

                    {Array.from({ length: totalPayrollPages }, (_, i) => i + 1).map((page) => (
                      <button
                        key={page}
                        onClick={() => setCurrentPayrollPage(page)}
                        className={`w-8 h-8 rounded-lg text-xs font-semibold transition-all border ${page === safeCurrentPayrollPage
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-500/20"
                          : "bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-500 hover:text-indigo-600 hover:border-indigo-300 dark:hover:border-indigo-500/40"
                          }`}
                      >
                        {page}
                      </button>
                    ))}

                    <button
                      onClick={() => setCurrentPayrollPage((p) => Math.min(totalPayrollPages, p + 1))}
                      disabled={safeCurrentPayrollPage === totalPayrollPages}
                      className="flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-500 hover:text-indigo-600 hover:border-indigo-300 dark:hover:border-indigo-500/40 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">
                    Select month cycle to review historic records
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}



      {/* 3. TAB: ACCOUNT SECURITY                                                  */}
      {activeTab === "security" && (
        <div className="space-y-6 animate-in fade-in duration-300 font-sans">



          {/* Main Panel */}
          <div className="glass-card overflow-hidden border-slate-200 dark:border-white/5">


            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-[#0a0d16]/30">
                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-widest text-slate-400">Employee Identity</th>
                    <th className="px-6 py-4 text-left text-xs font-bold uppercase tracking-widest text-slate-400">Access Level</th>
                    <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-widest text-slate-400">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                  {paginatedSecurityUsers.map((user: any) => (
                    <tr key={user.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-all">
                      {/* Employee Identity */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="relative shrink-0">
                            <img
                              src={`/api/avatar/${user.id}`}
                              alt={`${user.first_name} avatar`}
                              className="absolute inset-0 w-full h-full rounded-full object-cover border border-slate-200 dark:border-white/10"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                            <div className="w-10 h-10 rounded-full border border-slate-200 dark:border-white/10 bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-sm uppercase">
                              {user.first_name?.[0] || ""}{user.last_name?.[0] || ""}
                            </div>
                            <span className={cn(
                              "absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border border-white dark:border-[#0c101b]",
                              user.is_active ? "bg-emerald-500" : "bg-slate-400"
                            )} />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900 dark:text-white">
                              {user.first_name} {user.last_name}
                            </p>
                            <p className="text-sm font-semibold text-slate-500 mt-0.5 capitalize">
                              {user.department || "General"}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Access Level */}
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-2">
                          <span className="text-sm font-medium text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                            <Mail className="w-3.5 h-3.5 text-slate-400" />
                            {user.email}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className={cn(
                              "px-2.5 py-1 rounded-full text-xs font-semibold capitalize whitespace-nowrap",
                              getRoleBadgeStyles(user.designation?.replace("_", " ") || user.role)
                            )}>
                              {user.designation?.replace("_", " ") || user.role}
                            </span>
                            <span className={cn(
                              "px-2.5 py-1 rounded-full text-xs font-semibold capitalize",
                              getStatusBadgeStyles(user.status || (user.is_active ? "active" : "suspended"))
                            )}>
                              {user.status?.replace("_", " ") || (user.is_active ? "Active" : "Inactive")}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Credential Override */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="relative flex-1">
                            <input
                              type={visiblePasswords[user.id] ? "text" : "password"}
                              placeholder="Set new credentials..."
                              value={overridePasswords[user.id] || ""}
                              onChange={(e) => setOverridePasswords(prev => ({ ...prev, [user.id]: e.target.value }))}
                              className="w-full h-9 pl-3 pr-10 bg-slate-50 dark:bg-[#0a0d16] border border-slate-200 dark:border-white/10 rounded-lg text-xs font-semibold focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition-all dark:text-white"
                            />
                            <button
                              type="button"
                              onClick={() => setVisiblePasswords(prev => ({ ...prev, [user.id]: !prev[user.id] }))}
                              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white"
                            >
                              {visiblePasswords[user.id] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={() => generateRandomPasswordForUser(user.id)}
                            className="w-9 h-9 flex items-center justify-center rounded-lg bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-400 hover:text-indigo-500 transition-colors shrink-0"
                            title="Generate Random Password"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>

                      {/* Action */}
                      <td className="px-6 py-4 text-right">
                        <Button
                          onClick={() => handleManualOverride(user.id, user.email)}
                          disabled={isOverriding[user.id] || !(overridePasswords[user.id]?.length >= 6)}
                          variant="premium"
                          className="h-9 px-4 text-sm font-bold tracking-wider rounded-lg disabled:opacity-50"
                        >
                          {isOverriding[user.id] ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <>
                              <Key className="w-3 h-3 mr-1.5" />
                              Update
                            </>
                          )}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Security Pagination Footer */}
            {securityUsers.length > 0 && (
              <div className="px-6 py-3 border-t border-slate-100 dark:border-white/5 flex flex-col md:flex-row items-center justify-between gap-4 bg-slate-50/50 dark:bg-white/[0.01]">
                <p className="text-xs text-slate-400 font-medium">
                  Showing{' '}
                  <span className="font-bold text-slate-600 dark:text-slate-300">
                    {(safeCurrentSecurityPage - 1) * PAGE_SIZE + 1}
                  </span>{' '}
                  –{' '}
                  <span className="font-bold text-slate-600 dark:text-slate-300">
                    {Math.min(safeCurrentSecurityPage * PAGE_SIZE, securityUsers.length)}
                  </span>{' '}
                  of{' '}
                  <span className="font-bold text-slate-600 dark:text-slate-300">
                    {securityUsers.length}
                  </span>{' '}
                  records
                </p>
                {totalSecurityPages > 1 && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setCurrentSecurityPage((p) => Math.max(1, p - 1))}
                      disabled={safeCurrentSecurityPage === 1}
                      className="flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-500 hover:text-indigo-600 hover:border-indigo-300 dark:hover:border-indigo-500/40 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>

                    {Array.from({ length: totalSecurityPages }, (_, i) => i + 1).map((page) => (
                      <button
                        key={page}
                        onClick={() => setCurrentSecurityPage(page)}
                        className={`w-8 h-8 rounded-lg text-xs font-semibold transition-all border ${page === safeCurrentSecurityPage
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-500/20"
                          : "bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-500 hover:text-indigo-600 hover:border-indigo-300 dark:hover:border-indigo-500/40"
                          }`}
                      >
                        {page}
                      </button>
                    ))}

                    <button
                      onClick={() => setCurrentSecurityPage((p) => Math.min(totalSecurityPages, p + 1))}
                      disabled={safeCurrentSecurityPage === totalSecurityPages}
                      className="flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-500 hover:text-indigo-600 hover:border-indigo-300 dark:hover:border-indigo-500/40 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 4. TAB: BIRTHDAYS DIRECTORY                                               */}
      {activeTab === "birthdays" && (
        <div className="space-y-6 font-sans">
          <div className="glass-card overflow-hidden">
            <div className="px-6 py-5 border-b border-slate-200/60 dark:border-white/5 flex items-center gap-3">
              <Gift className="w-5 h-5 text-pink-500" />
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white leading-none">Employee Birthdays</h3>
                <p className="text-xs text-slate-500 mt-1">A complete list of all employee birthdates, sorted by upcoming dates.</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-separate border-spacing-y-2 min-w-[700px]">
                <thead>
                  <tr>
                    <th className="px-6 py-3.5 text-xs font-black uppercase tracking-[0.18em] text-slate-400">Employee</th>
                    <th className="px-6 py-3.5 text-xs font-black uppercase tracking-[0.18em] text-slate-400">Department</th>
                    <th className="px-6 py-3.5 text-xs font-black uppercase tracking-[0.18em] text-slate-400">Date of Birth</th>
                    <th className="px-6 py-3.5 text-xs font-black uppercase tracking-[0.18em] text-slate-400">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedBirthdayUsers.map((user: any) => {
                    let status = null;
                    if (user.dob) {
                      const dob = new Date(user.dob);
                      if (!isNaN(dob.getTime())) {
                        const today = new Date();
                        const nextWeek = new Date();
                        nextWeek.setDate(nextWeek.getDate() + 7);
                        if (dob.getMonth() === today.getMonth() && dob.getDate() === today.getDate()) status = "Today";
                        else {
                          const tomorrow = new Date();
                          tomorrow.setDate(tomorrow.getDate() + 1);
                          if (dob.getMonth() === tomorrow.getMonth() && dob.getDate() === tomorrow.getDate()) status = "Tomorrow";
                          else {
                            const dobThisYear = new Date(today.getFullYear(), dob.getMonth(), dob.getDate());
                            if (dobThisYear >= today && dobThisYear <= nextWeek) status = "Upcoming";
                          }
                        }
                      }
                    }
                    return (
                      <tr key={`bday-${user.id}`} className="group bg-slate-50/50 dark:bg-white/[0.02] hover:bg-white dark:hover:bg-white/[0.04] transition-all duration-300">
                        <td className="px-6 py-4 rounded-l-2xl">
                          <div className="flex items-center gap-2.5">
                            <div className="relative shrink-0 w-10 h-10 rounded-full border border-slate-200 dark:border-white/10 bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-bold text-sm uppercase overflow-hidden">
                              {user.first_name?.[0] || ""}{user.last_name?.[0] || ""}
                              <img
                                src={`/api/avatar/${user.id}`}
                                alt={`${user.first_name} avatar`}
                                className="absolute inset-0 w-full h-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            </div>
                            <div>
                              <p className="text-sm font-semibold text-slate-800 dark:text-white leading-snug">
                                {user.first_name} {user.last_name}
                              </p>
                              <p className="text-xs font-mono text-slate-400 mt-0.5">{user.employee_id || "N/A"}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn("px-2.5 py-1 rounded-full text-xs font-semibold border inline-block capitalize", getDeptBadgeStyles(user.department))}>
                            {user.department || "General"}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {user.dob ? (
                            <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                              <Calendar className="w-4 h-4 text-slate-400" />
                              {new Date(user.dob).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic text-sm">Not provided</span>
                          )}
                        </td>
                        <td className="px-6 py-4 rounded-r-2xl">
                          {status === "Today" && <span className="px-3 py-1 bg-pink-500 text-white text-xs font-bold rounded-full shadow-md">🎂 Today</span>}
                          {status === "Tomorrow" && <span className="px-3 py-1 bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300 text-xs font-bold rounded-full">🎈 Tomorrow</span>}
                          {status === "Upcoming" && <span className="px-3 py-1 border border-indigo-200 text-indigo-600 dark:border-indigo-500/30 dark:text-indigo-400 text-xs font-bold rounded-full">Upcoming</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Birthday Pagination Footer */}
            {birthdayUsers.length > 0 && (
              <div className="px-6 py-3 border-t border-slate-100 dark:border-white/5 flex flex-col md:flex-row items-center justify-between gap-4 bg-slate-50/50 dark:bg-white/[0.01]">
                <p className="text-xs text-slate-400 font-medium">
                  Showing{' '}
                  <span className="font-bold text-slate-600 dark:text-slate-300">
                    {(safeCurrentBirthdayPage - 1) * PAGE_SIZE + 1}
                  </span>{' '}
                  –{' '}
                  <span className="font-bold text-slate-600 dark:text-slate-300">
                    {Math.min(safeCurrentBirthdayPage * PAGE_SIZE, birthdayUsers.length)}
                  </span>{' '}
                  of{' '}
                  <span className="font-bold text-slate-600 dark:text-slate-300">
                    {birthdayUsers.length}
                  </span>{' '}
                  records
                </p>
                {totalBirthdayPages > 1 && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setCurrentBirthdayPage((p) => Math.max(1, p - 1))}
                      disabled={safeCurrentBirthdayPage === 1}
                      className="flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-500 hover:text-indigo-600 hover:border-indigo-300 dark:hover:border-indigo-500/40 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>

                    {Array.from({ length: totalBirthdayPages }, (_, i) => i + 1).map((page) => (
                      <button
                        key={page}
                        onClick={() => setCurrentBirthdayPage(page)}
                        className={`w-8 h-8 rounded-lg text-xs font-semibold transition-all border ${page === safeCurrentBirthdayPage
                          ? "bg-indigo-600 text-white border-indigo-600 shadow-sm shadow-indigo-500/20"
                          : "bg-white dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-500 hover:text-indigo-600 hover:border-indigo-300 dark:hover:border-indigo-500/40"
                          }`}
                      >
                        {page}
                      </button>
                    ))}

                    <button
                      onClick={() => setCurrentBirthdayPage((p) => Math.min(totalBirthdayPages, p + 1))}
                      disabled={safeCurrentBirthdayPage === totalBirthdayPages}
                      className="flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-white/5 text-slate-500 hover:text-indigo-600 hover:border-indigo-300 dark:hover:border-indigo-500/40 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ONE-TIME PASSWORD DIALOG OVERLAY */}
      {oneTimePassModal && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md" onClick={() => setOneTimePassModal(null)} />
          <div className="relative w-full max-w-md bg-white dark:bg-[#080b14] rounded-3xl border border-slate-200 dark:border-white/10 shadow-2xl p-6 text-center animate-in zoom-in-95 duration-200">
            <div className="w-14 h-14 bg-indigo-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-indigo-500/20 text-indigo-500">
              <Key className="w-6 h-6" />
            </div>

            <h4 className="text-lg font-bold text-slate-900 dark:text-white">Temporary Key Generated</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-semibold max-w-xs mx-auto mt-1.5 leading-relaxed">
              Temporary access key refreshed. Securely transfer this password to the employee immediately.
            </p>

            <div className="my-5 p-4 rounded-2xl bg-indigo-500/5 dark:bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-between">
              <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 text-lg tracking-wider">
                {oneTimePassModal}
              </span>
              <Button
                onClick={() => copyToClipboard(oneTimePassModal)}
                variant="outline"
                className="h-9 w-9 p-0 rounded-xl"
                title="Copy password key"
              >
                <Key className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
              </Button>
            </div>

            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex gap-2.5 text-left mb-6">
              <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 dark:text-amber-400 font-bold leading-normal">
                SECURITY WARNING: Visible ONLY ONCE. The password will be salted and hashed immediately upon closing.
              </p>
            </div>

            <Button
              onClick={() => setOneTimePassModal(null)}
              className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider"
            >
              Acknowledge & Close
            </Button>
          </div>
        </div>,
        document.body
      )}

      {/* Onboard Wizard Dialog */}
      <OnboardUserModal
        isOpen={isNewUserModalOpen}
        onClose={() => setIsNewUserModalOpen(false)}
        existingUsers={users}
        onSuccess={handleRefreshData}
      />

      {/* Profile Detail Dialog */}
      <EmployeeProfileModal
        isOpen={selectedEmployee !== null}
        onClose={() => setSelectedEmployee(null)}
        employee={selectedEmployee}
        existingUsers={users}
        onSuccess={handleRefreshData}
      />
    </div>
  );
}
