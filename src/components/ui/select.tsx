"use client";

import * as React from "react";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

import { createPortal } from "react-dom";

export interface SelectProps {
  value?: string;
  onValueChange: (value: string) => void;
  placeholder?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  buttonClassName?: string;
  disabled?: boolean;
  align?: "left" | "right";
  id?: string;
}

export interface SelectItemProps {
  value: string;
  children: React.ReactNode;
  className?: string;
  label?: string;
}

const SelectContext = React.createContext<{
  value?: string;
  onValueChange: (value: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
} | null>(null);

export function Select({ value, onValueChange, placeholder, children, className, buttonClassName, disabled, align = "left", id }: SelectProps) {
  const [open, setOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const [coords, setCoords] = React.useState({ top: 0, left: 0, width: 0 });
  const containerRef = React.useRef<HTMLDivElement>(null);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const updateCoords = () => {
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setCoords({
        top: rect.bottom + window.scrollY + 6,
        left: rect.left + window.scrollX,
        width: rect.width,
      });
    }
  };

  const handleToggle = () => {
    if (disabled) return;
    updateCoords();
    setOpen(!open);
  };

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        containerRef.current && !containerRef.current.contains(target) &&
        dropdownRef.current && !dropdownRef.current.contains(target)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const handleScrollOrResize = () => {
      updateCoords();
    };
    window.addEventListener("scroll", handleScrollOrResize, { capture: true });
    window.addEventListener("resize", handleScrollOrResize);
    return () => {
      window.removeEventListener("scroll", handleScrollOrResize, { capture: true });
      window.removeEventListener("resize", handleScrollOrResize);
    };
  }, [open]);

  // Recursively search children for matching SelectItem
  const findSelectedChild = (childrenNodes: React.ReactNode): React.ReactElement | undefined => {
    let result: React.ReactElement | undefined;
    React.Children.forEach(childrenNodes, (child) => {
      if (result) return;
      if (React.isValidElement(child)) {
        if (child.props?.value !== undefined && String(child.props.value) === String(value)) {
          result = child;
        } else if (child.props?.children) {
          const found = findSelectedChild(child.props.children);
          if (found) result = found;
        }
      }
    });
    return result;
  };

  const selectedChild = value !== undefined ? findSelectedChild(children) : undefined;
  const displayLabel = selectedChild 
    ? (selectedChild.props.label || selectedChild.props.children)
    : placeholder;

  const dropdown = (
    <AnimatePresence>
      {open && (
        <motion.div 
          ref={dropdownRef}
          key="select-dropdown"
          initial={{ opacity: 0, y: -8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -4, scale: 0.98 }}
          transition={{ duration: 0.15, ease: "easeOut" }}
          style={{
            position: "absolute",
            top: coords.top,
            left: coords.left,
            width: coords.width,
            zIndex: 99999
          }}
          className={cn(
            "z-[99999] rounded-xl overflow-hidden",
            "bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl",
            "border border-slate-200/80 dark:border-white/10",
            "shadow-xl shadow-slate-200/50 dark:shadow-black/50"
          )}
        >
          <div className="p-1.5 max-h-64 overflow-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-white/10 scrollbar-track-transparent">
            {React.Children.count(children) > 0 ? (
              children
            ) : (
              <div className="px-3 py-4 text-center text-sm text-slate-500 dark:text-slate-400">
                No options available
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );

  return (
    <SelectContext.Provider value={{ value, onValueChange, open, setOpen }}>
      <div ref={containerRef} className={cn("relative w-full", className)} id={id}>
        <button
          type="button"
          onClick={handleToggle}
          disabled={disabled}
          className={cn(
            "w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 outline-none select-none",
            "bg-white/40 dark:bg-slate-900/40 backdrop-blur-md border border-slate-200/60 dark:border-white/10",
            "text-slate-700 dark:text-slate-200 shadow-sm",
            "hover:bg-white/60 dark:hover:bg-slate-800/60 hover:border-indigo-300/50 dark:hover:border-indigo-500/30",
            "focus-visible:ring-2 focus-visible:ring-indigo-500/30 focus-visible:border-indigo-400 dark:focus-visible:border-indigo-400",
            open && "ring-2 ring-indigo-500/20 border-indigo-400 dark:border-indigo-500 bg-white/80 dark:bg-slate-800/80 shadow-md",
            disabled && "opacity-50 cursor-not-allowed hover:bg-white/40 dark:hover:bg-slate-900/40 hover:border-slate-200/60 dark:hover:border-white/10",
            buttonClassName
          )}
        >
          <span className={cn("truncate", !selectedChild && "text-slate-400 dark:text-slate-500 font-normal")}>
            {displayLabel}
          </span>
          <ChevronDown className={cn("h-4 w-4 text-slate-400 dark:text-slate-500 transition-transform duration-300 flex-shrink-0 ml-2", open && "rotate-180 text-indigo-500")} />
        </button>
        
        {mounted && createPortal(dropdown, document.body)}
      </div>
    </SelectContext.Provider>
  );
}

export function SelectItem({ 
  value, 
  children, 
  className,
  label
}: SelectItemProps) {
  const context = React.useContext(SelectContext);
  const isSelected = context?.value !== undefined && String(context?.value) === String(value);

  return (
    <button
      type="button"
      onClick={() => {
        context?.onValueChange(value);
        context?.setOpen(false);
      }}
      className={cn(
        "relative flex w-full cursor-pointer select-none items-center rounded-lg py-2.5 pl-9 pr-4 text-sm font-medium outline-none transition-all duration-200 text-left",
        "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white",
        isSelected && "text-indigo-600 dark:text-indigo-400 font-semibold bg-indigo-50/80 dark:bg-indigo-500/10",
        className
      )}
    >
      <span className="absolute left-3 flex h-4 w-4 items-center justify-center pointer-events-none">
        {isSelected && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <Check className="h-4 w-4 text-indigo-600 dark:text-indigo-400 stroke-[2.5]" />
          </motion.div>
        )}
      </span>
      <div className="truncate w-full">{children}</div>
    </button>
  );
}

export function SelectGroup({ 
  children, 
  className 
}: { 
  children: React.ReactNode; 
  className?: string 
}) {
  return (
    <div role="group" className={cn("py-1", className)}>
      {children}
    </div>
  );
}

export function SelectLabel({ 
  children, 
  className 
}: { 
  children: React.ReactNode; 
  className?: string 
}) {
  return (
    <div className={cn("px-3.5 py-1.5 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider select-none", className)}>
      {children}
    </div>
  );
}

export function SelectSeparator({ className }: { className?: string }) {
  return <div className={cn("-mx-1 my-1 h-px bg-slate-100 dark:bg-white/5", className)} />;
}
