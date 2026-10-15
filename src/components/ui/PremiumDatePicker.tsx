"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { format, addMonths, subMonths, startOfMonth, endOfMonth, startOfWeek, endOfWeek, isSameMonth, isSameDay, eachDayOfInterval } from "date-fns";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface PremiumDatePickerProps {
  value?: string;
  onChange?: (date: string) => void;
  className?: string;
  align?: 'left' | 'right';
  side?: 'bottom' | 'right';
  disabled?: boolean;
  triggerClassName?: string;
  minDate?: string | Date;
}

export function PremiumDatePicker({ value, onChange, className, align = 'left', side = 'bottom', disabled = false, triggerClassName, minDate }: PremiumDatePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [currentMonth, setCurrentMonth] = React.useState(value ? new Date(value) : new Date());
  const [mounted, setMounted] = React.useState(false);
  const [coords, setCoords] = React.useState({ top: 0, left: 0 });

  const containerRef = React.useRef<HTMLDivElement>(null);
  const portalRef = React.useRef<HTMLDivElement>(null);

  const selectedDate = value ? new Date(value) : null;

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const updateCoords = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const popupWidth = 300;

      if (side === 'right') {
        // Position to the right, centered vertically on the trigger
        const calendarHeight = 320; // approximate height of calendar popup
        const triggerCenterY = rect.top + rect.height / 2 + window.scrollY;
        setCoords({
          top: triggerCenterY - calendarHeight / 2,
          left: rect.right + window.scrollX + 8,
        });
      } else {
        // Position below the trigger
        let left = rect.left + window.scrollX;
        if (align === 'right') {
          left = rect.right - popupWidth + window.scrollX;
        }
        setCoords({
          top: rect.bottom + window.scrollY + 8,
          left: left
        });
      }
    }
  };

  const toggleOpen = () => {
    if (disabled) return;
    updateCoords();
    setIsOpen(!isOpen);
  };

  const handleDateSelect = (date: Date) => {
    const formattedDate = format(date, "yyyy-MM-dd");
    onChange?.(formattedDate);
    setIsOpen(false);
  };

  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));

  // Close on click outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      const clickedInsideTrigger = containerRef.current && containerRef.current.contains(target);
      const clickedInsidePortal = portalRef.current && portalRef.current.contains(target);

      if (!clickedInsideTrigger && !clickedInsidePortal) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Update coordinates on scroll or resize
  React.useEffect(() => {
    if (!isOpen) return;

    const handleScrollOrResize = () => {
      updateCoords();
    };

    window.addEventListener("scroll", handleScrollOrResize, { capture: true });
    window.addEventListener("resize", handleScrollOrResize);

    return () => {
      window.removeEventListener("scroll", handleScrollOrResize, { capture: true });
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [isOpen]);

  // Keep currentMonth in sync if value changes externally
  React.useEffect(() => {
    if (value) {
      setCurrentMonth(new Date(value));
    }
  }, [value]);

  const days = React.useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth));
    const end = endOfWeek(endOfMonth(currentMonth));
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const years = React.useMemo(() => {
    const currentYear = new Date().getFullYear();
    const startYear = currentYear - 90; // Up to 90 years back
    const endYear = currentYear + 10;   // Up to 10 years forward
    const list = [];
    for (let y = endYear; y >= startYear; y--) {
      list.push(y);
    }
    return list;
  }, []);

  const renderedPicker = (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={portalRef}
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.95 }}
          transition={{ duration: 0.2 }}
          style={{
            position: 'absolute',
            top: coords.top,
            left: coords.left,
            width: '300px',
          }}
          className="z-[99999] glass-card p-4 border-slate-200/60 dark:border-white/10 shadow-[0_8px_30px_rgb(0,0,0,0.12)] bg-white/80 dark:bg-slate-900/80 backdrop-blur-3xl rounded-2xl"
        >
          <div className="flex items-center justify-between mb-4 px-1 gap-2">
            <div className="flex items-center gap-1.5">
              {/* Month Selector Dropdown */}
              <select
                value={currentMonth.getMonth()}
                onChange={(e) => {
                  const newMonth = parseInt(e.target.value);
                  const updated = new Date(currentMonth);
                  updated.setMonth(newMonth);
                  setCurrentMonth(updated);
                }}
                className="bg-transparent text-sm font-bold text-slate-800 dark:text-white border-none outline-none cursor-pointer hover:text-indigo-600 transition-colors capitalize py-1"
              >
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i} value={i} className="bg-white dark:bg-[#0f172a] text-slate-900 dark:text-white font-semibold">
                    {format(new Date(2026, i, 1), "MMMM")}
                  </option>
                ))}
              </select>

              {/* Year Selector Dropdown */}
              <select
                value={currentMonth.getFullYear()}
                onChange={(e) => {
                  const newYear = parseInt(e.target.value);
                  const updated = new Date(currentMonth);
                  updated.setFullYear(newYear);
                  setCurrentMonth(updated);
                }}
                className="bg-transparent text-sm font-bold text-slate-800 dark:text-white border-none outline-none cursor-pointer hover:text-indigo-600 transition-colors py-1"
              >
                {years.map((year) => (
                  <option key={year} value={year} className="bg-white dark:bg-[#0f172a] text-slate-900 dark:text-white font-semibold">
                    {year}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-1 shrink-0">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); prevMonth(); }}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors text-slate-500 dark:text-slate-400"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); nextMonth(); }}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-white/5 transition-colors text-slate-500 dark:text-slate-400"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 mb-2">
            {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((day) => (
              <div key={day} className="text-[10px] font-black uppercase tracking-widest text-slate-400 text-center py-1">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {days.map((day, idx) => {
              const isSelected = selectedDate && isSameDay(day, selectedDate);
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isToday = isSameDay(day, new Date());
              
              const minDateObj = minDate ? new Date(minDate) : null;
              if (minDateObj) minDateObj.setHours(0, 0, 0, 0);
              const isBeforeMinDate = minDateObj ? day.getTime() < minDateObj.getTime() : false;

              return (
                <button
                  key={idx}
                  type="button"
                  disabled={isBeforeMinDate}
                  onClick={(e) => { 
                    if (isBeforeMinDate) return;
                    e.stopPropagation(); 
                    handleDateSelect(day); 
                  }}
                  className={cn(
                    "h-8 w-8 rounded-lg text-sm transition-all flex items-center justify-center relative",
                    !isCurrentMonth && "opacity-20",
                    isBeforeMinDate && "opacity-30 cursor-not-allowed",
                    !isBeforeMinDate && isSelected 
                      ? "bg-indigo-600 text-white font-bold shadow-lg shadow-indigo-600/20" 
                      : !isBeforeMinDate && "hover:bg-indigo-500/10 text-slate-600 dark:text-slate-400 hover:text-indigo-600",
                    isToday && !isSelected && !isBeforeMinDate && "after:content-[''] after:absolute after:bottom-1 after:w-1 after:h-1 after:bg-indigo-500 after:rounded-full"
                  )}
                >
                  {format(day, "d")}
                </button>
              );
            })}
          </div>
          
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-white/5">
              <button 
                  type="button"
                  onClick={() => handleDateSelect(new Date())}
                  className="w-full py-2 text-xs font-bold text-indigo-600 hover:bg-indigo-500/5 rounded-lg transition-colors"
              >
                  Today
              </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <div className={cn("relative w-full", className)} ref={containerRef}>
      <div
        onClick={toggleOpen}
        className={cn(
          "w-full h-11 bg-slate-100 dark:bg-white/[0.03] border border-slate-200 dark:border-white/10 rounded-xl px-3 flex items-center gap-2.5 transition-all text-sm",
          disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer group hover:border-indigo-500/50",
          triggerClassName
        )}
      >
        <CalendarIcon className="w-4 h-4 text-slate-500 group-hover:text-indigo-500 transition-colors shrink-0" />
        <span className={cn("flex-1 font-medium whitespace-nowrap text-left", !value ? "text-slate-400 dark:text-slate-600" : "text-slate-900 dark:text-slate-200")}>
          {value ? format(new Date(value), "PPP") : "Select Date"}
        </span>
        <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
      </div>

      {mounted && createPortal(renderedPicker, document.body)}
    </div>
  );
}
