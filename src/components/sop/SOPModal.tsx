"use client";

import React, { useState, useEffect } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectItem } from '@/components/ui/select';
import { createSOPAction, updateSOPAction } from '@/actions/sop.actions';
import { toast } from 'sonner';
import { 
  BookOpen, 
  Sparkles, 
  ShieldCheck, 
  Bold, 
  List, 
  Heading3,
  Heading2
} from 'lucide-react';
import { useRef } from 'react';

interface SOPModalProps {
  isOpen: boolean;
  onClose: () => void;
  sop?: any;
}

const ROLES = [
  { label: 'Common (All Roles)', value: 'common' },
  { label: 'Sales', value: 'sales' },
  { label: 'Accountant', value: 'accountant' },
  { label: 'Engineer', value: 'engineer' },
  { label: 'Field', value: 'field' },
];

export function SOPModal({ isOpen, onClose, sop }: SOPModalProps) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    target_role: 'common',
  });

  useEffect(() => {
    if (sop) {
      setFormData({
        title: sop.title,
        content: sop.content,
        target_role: sop.target_role || 'common',
      });
    } else {
      setFormData({
        title: '',
        content: '',
        target_role: 'common',
      });
    }
  }, [sop, isOpen]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insertText = (before: string, after: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = textarea.value;
    const selectedText = text.substring(start, end);
    const newText = text.substring(0, start) + before + selectedText + after + text.substring(end);

    setFormData({ ...formData, content: newText });
    
    // Set focus back and adjust cursor
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = start + before.length + selectedText.length + after.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.content) {
      toast.error('Please fill in all fields');
      return;
    }

    setLoading(true);
    const payload = {
      ...formData,
      target_role: formData.target_role === 'common' ? null : formData.target_role,
    };

    console.log('[SOP Modal] Submitting with payload:', payload);
    const res = sop 
      ? await updateSOPAction(sop.id, payload)
      : await createSOPAction(payload);
    console.log('[SOP Modal] Response:', res);

    setLoading(false);
    if (res.success) {
      toast.success(sop ? 'SOP updated' : 'SOP created');
      onClose();
    } else {
      toast.error(res.error || 'Something went wrong');
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] p-0 overflow-hidden border-none shadow-2xl">
        {/* Premium Integrated Header */}
        <div className="relative overflow-hidden bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-200/50 dark:border-white/5">
          <div className="absolute -right-20 -top-20 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl" />
          
          <div className="relative p-6 flex items-start gap-4">
            <div className="h-12 w-12 rounded-xl bg-indigo-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 shrink-0">
              <BookOpen className="h-6 w-6 text-white" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
                {sop ? 'Edit Procedure' : 'Create New Procedure'}
                <Sparkles className="h-3.5 w-3.5 text-indigo-500 animate-pulse" />
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                Define high-fidelity guidelines for the Malee House team.
              </DialogDescription>
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col">
          <div className="p-6 space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-[12px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-0.5">
                  Procedure Title
                </label>
                <input 
                  placeholder="e.g. Site Survey Guidelines" 
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  className="glass-input h-10"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[12px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-0.5">
                  Target Audience
                </label>
                <Select 
                  value={formData.target_role} 
                  onValueChange={(val) => setFormData({ ...formData, target_role: val })}
                  placeholder="Select role"
                >
                  {ROLES.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      {role.label}
                    </SelectItem>
                  ))}
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[12px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider ml-0.5 flex items-center justify-between">
                Procedure Content
                <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg border border-slate-200 dark:border-slate-700">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-md hover:bg-white dark:hover:bg-slate-700 text-slate-500"
                    onClick={() => insertText('## ')}
                    title="Main Heading"
                  >
                    <Heading2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-md hover:bg-white dark:hover:bg-slate-700 text-slate-500"
                    onClick={() => insertText('### ')}
                    title="Subheading"
                  >
                    <Heading3 className="h-3.5 w-3.5" />
                  </Button>
                  <div className="w-px h-4 bg-slate-300 dark:bg-slate-600 mx-0.5" />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-md hover:bg-white dark:hover:bg-slate-700 text-slate-500"
                    onClick={() => insertText('**', '**')}
                    title="Bold"
                  >
                    <Bold className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-md hover:bg-white dark:hover:bg-slate-700 text-slate-500"
                    onClick={() => insertText('- ')}
                    title="Bullet Point"
                  >
                    <List className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </label>
              <textarea 
                ref={textareaRef}
                placeholder="Detail the technical steps and quality standards..."
                value={formData.content}
                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                className="glass-input min-h-[160px] resize-none py-3 leading-relaxed"
              />
            </div>

            <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50/50 dark:bg-indigo-500/5 rounded-xl border border-indigo-100/50 dark:border-indigo-500/10">
              <ShieldCheck className="h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
              <p className="text-[10px] font-bold text-indigo-700 dark:text-indigo-300 uppercase tracking-wider">
                Authorized Personnel only
              </p>
            </div>
          </div>

          <DialogFooter className="bg-slate-50/30 dark:bg-white/5 p-4 border-t border-slate-100 dark:border-white/5 sm:space-x-3">
            <Button 
              type="button" 
              variant="ghost" 
              onClick={onClose}
              className="h-10 px-5 text-sm font-bold text-slate-500 hover:bg-slate-100 dark:hover:bg-white/10 rounded-xl"
            >
              Discard
            </Button>
            <Button 
              type="submit" 
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-700 text-white h-10 px-6 shadow-md shadow-indigo-500/10 transition-all active:scale-95 font-bold text-sm rounded-xl"
            >
              {loading ? 'Publishing...' : (sop ? 'Update' : 'Publish SOP')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
