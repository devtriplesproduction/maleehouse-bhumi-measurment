"use client";

import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { PremiumDatePicker } from "@/components/ui/PremiumDatePicker";

export default function DateSelector({ currentDate }: { currentDate: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const handleDateChange = (newDateStr: string) => {
    if (newDateStr) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("date", newDateStr);
      router.push(`/accounts/audit?${params.toString()}`);
    }
  };

  return (
    <div className="w-full sm:w-[200px]">
      <PremiumDatePicker
        value={currentDate}
        onChange={handleDateChange}
        align="right"
        className="w-full"
        triggerClassName="text-xs font-semibold h-9 rounded-xl py-1.5 px-3.5 bg-white dark:bg-slate-900/50 border-slate-200/80 dark:border-white/10"
      />
    </div>
  );
}
