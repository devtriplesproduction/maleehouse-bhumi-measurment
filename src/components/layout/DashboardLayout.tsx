"use client";

import React from "react";
import { Topbar } from "@/components/layout/Topbar";
import { RealtimeProvider } from "@/providers/RealtimeProvider";
import { AutoLogout } from "@/components/auth/AutoLogout";
import { useUser } from "@/hooks/useUser";
import { AdminSidebar } from "@/components/layout/sidebars/AdminSidebar";
import { SalesSidebar } from "@/components/layout/sidebars/SalesSidebar";
import { AccountsSidebar } from "@/components/layout/sidebars/AccountsSidebar";
import { OperationsSidebar } from "@/components/layout/sidebars/OperationsSidebar";
import { EngineerSidebar } from "@/components/layout/sidebars/EngineerSidebar";
import { HRSidebar } from "@/components/layout/sidebars/HRSidebar";
import { DeveloperSidebar } from "@/components/layout/sidebars/DeveloperSidebar";
import { BirthdayNotifier } from "@/components/modules/BirthdayNotifier";

import DashboardLoading from "@/app/(modules)/loading";

const EMPTY_BIRTHDAYS: any[] = [];

export function DashboardLayout({
  children,
  initialBirthdays = EMPTY_BIRTHDAYS,
}: {
  children: React.ReactNode;
  /** Optional SSR birthdays; usually empty — notifier loads client-side once */
  initialBirthdays?: any[];
}) {
  const { role, isLoading } = useUser();

  if (isLoading) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#fcfcfd] dark:bg-[#080b14]">
        <DashboardLoading />
      </div>
    );
  }

  const renderSidebar = () => {
    if (role === "admin") return <AdminSidebar />;
    if (role === "sales") return <SalesSidebar />;
    if (role === "accountant") return <AccountsSidebar />;
    if (role === "engineer") return <EngineerSidebar />;
    if (role === "hr") return <HRSidebar />;
    if (role === "developer") return <DeveloperSidebar />;
    // Default to operations sidebar for all technical operational roles
    return <OperationsSidebar />;
  };

  return (
    <AutoLogout>
      <div className="flex h-screen overflow-hidden bg-[#fcfcfd] dark:bg-[#080b14] text-slate-900 dark:text-white font-sans transition-colors duration-300">
        <div className="fixed inset-0 pointer-events-none z-0 mesh-light dark:mesh-dark opacity-100 dark:opacity-40" />
        {renderSidebar()}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative z-10">
          <RealtimeProvider>
            <Topbar />
            <BirthdayNotifier initialBirthdays={initialBirthdays} />
            <main className="flex-1 overflow-y-auto overflow-x-hidden px-4 pb-4 pt-2 md:px-6 md:pb-6 lg:px-8 lg:pb-8 lg:pt-4">
              <div className="max-w-[1600px] w-full h-full">
                {children}
              </div>
            </main>
          </RealtimeProvider>
        </div>
      </div>
    </AutoLogout>
  );
}
