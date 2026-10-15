"use client";

import { useState } from "react";
import { Printer, X, User, Phone, FileText, Copy, FileDigit, Palette, IndianRupee, FileSpreadsheet } from "lucide-react";

export default function NewPrintJobDialog({ 
  isOpen, 
  onClose, 
  projects, 
  urlPrefill, 
  onSuccess 
}: { 
  isOpen: boolean; 
  onClose: () => void; 
  projects: any[]; 
  urlPrefill?: any; 
  onSuccess: (job: any) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    client_name: urlPrefill?.clientName || "",
    client_phone: "",
    project_id: urlPrefill?.projectId || "",
    file_name: urlPrefill?.fileName || "",
    copies: 1,
    paper_size: "A4",
    print_type: "bw",
    amount: 0,
    notes: ""
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const resp = await fetch("/api/print-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          copies: Number(formData.copies),
          amount: Number(formData.amount)
        })
      });
      
      const text = await resp.text();
      let res;
      try {
        res = JSON.parse(text);
      } catch (e) {
        alert(text);
        return;
      }
      
      if (!res.success) {
        alert(res.error || "Failed to create print job");
        return;
      }
      
      onSuccess(res.data);
      onClose();
    } catch (err: any) {
      alert("Client Exception: " + String(err) + "\n\nMessage: " + err?.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm transition-all duration-300 ease-in-out">
      <div className="bg-white border border-slate-200/80 rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white rounded-xl shadow-sm border border-indigo-100 text-indigo-600">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">New Print Job</h2>
              <p className="text-xs font-medium text-slate-500">Enter details for the printing task</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 rounded-full transition-all">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6">
          <div className="space-y-6">
            
            <div className="grid grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <User className="w-4 h-4 text-slate-400" /> Client Name *
                </label>
                <input 
                  required 
                  type="text" 
                  value={formData.client_name} 
                  onChange={e => setFormData({...formData, client_name: e.target.value})} 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all placeholder:text-slate-400 font-medium" 
                  placeholder="e.g. Jane Doe" 
                />
              </div>
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <Phone className="w-4 h-4 text-slate-400" /> Client Phone
                </label>
                <input 
                  type="text" 
                  inputMode="numeric" 
                  pattern="[0-9]*" 
                  value={formData.client_phone} 
                  onChange={e => {
                    const val = e.target.value.replace(/\D/g, '');
                    setFormData({...formData, client_phone: val});
                  }} 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all placeholder:text-slate-400 font-medium" 
                  placeholder="9876543210" 
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <FileText className="w-4 h-4 text-slate-400" /> File Name
              </label>
              <input 
                type="text" 
                value={formData.file_name} 
                onChange={e => setFormData({...formData, file_name: e.target.value})} 
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all placeholder:text-slate-400 font-medium" 
                placeholder="e.g. final_site_plan_v2.pdf" 
              />
            </div>

            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <Copy className="w-4 h-4 text-slate-400" /> Copies *
                </label>
                <input 
                  required 
                  type="number" 
                  min="1" 
                  value={formData.copies} 
                  onChange={e => setFormData({...formData, copies: parseInt(e.target.value) || 1})} 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium" 
                />
              </div>
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <FileSpreadsheet className="w-4 h-4 text-slate-400" /> Paper *
                </label>
                <select 
                  value={formData.paper_size} 
                  onChange={e => setFormData({...formData, paper_size: e.target.value})} 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium cursor-pointer"
                >
                  <option value="A4">A4</option>
                  <option value="A3">A3</option>
                  <option value="A1">A1</option>
                  <option value="A0">A0</option>
                  <option value="Custom">Custom</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <Palette className="w-4 h-4 text-slate-400" /> Type *
                </label>
                <select 
                  value={formData.print_type} 
                  onChange={e => setFormData({...formData, print_type: e.target.value})} 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium cursor-pointer"
                >
                  <option value="bw">B&W</option>
                  <option value="color">Color</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <IndianRupee className="w-4 h-4 text-slate-400" /> Amount *
                </label>
                <input 
                  required 
                  type="number" 
                  min="0" 
                  step="0.01" 
                  value={formData.amount} 
                  onChange={e => setFormData({...formData, amount: parseFloat(e.target.value) || 0})} 
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all font-medium" 
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <FileDigit className="w-4 h-4 text-slate-400" /> Notes
              </label>
              <textarea 
                value={formData.notes} 
                onChange={e => setFormData({...formData, notes: e.target.value})} 
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-slate-900 focus:bg-white focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 transition-all placeholder:text-slate-400 resize-none font-medium" 
                placeholder="Any special instructions..." 
                rows={2} 
              />
            </div>

          </div>

          <div className="flex justify-end space-x-3 pt-6 mt-6 border-t border-slate-100">
            <button 
              type="button" 
              onClick={onClose} 
              className="px-5 py-2.5 text-sm font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition-all" 
              disabled={loading}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white rounded-xl transition-all font-semibold shadow-sm shadow-indigo-600/20" 
              disabled={loading}
            >
              {loading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                  Processing...
                </>
              ) : (
                <>
                  <Printer className="w-4 h-4" />
                  Create Print Job
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
