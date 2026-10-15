'use client';

import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import { FileText, FileSpreadsheet, ChevronDown, Loader2, Download, User, Briefcase, TrendingUp, TrendingDown, Wallet, FileBarChart2, Search, Check } from 'lucide-react';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { 
  getProfitLossReportAction, 
  getIncomeStatementAction, 
  getExpenseStatementAction, 
  getCashFlowStatementAction, 
  getBalanceSheetAction,
  getProjectStatementAction,
  getProjectBudgetSheetAction,
  getExpensesFundAllocationAction,
  getProjectActualSheetAction,
  getAllProjectSummaryAction
} from '@/actions/reports.actions';
import { Select, SelectItem } from "@/components/ui/select";
import { PageHeader } from "@/components/modules/PageHeader";
import { PremiumDatePicker } from "@/components/ui/PremiumDatePicker";
import { BarChart3 } from "lucide-react";
import { getProjectsListAction } from '@/actions/project.actions';
import { generateFinancialReportPDF } from '@/lib/financial-pdf-generator';
import { cn } from '@/lib/utils';
import { EmptyState } from '@/components/ui/empty-state';
import { toast } from 'sonner';

type ReportType = 'profit_loss' | 'income' | 'expense' | 'cash_flow' | 'balance_sheet' | 'project_statement' | 'all_project_summary' | 'project_budget_sheet' | 'expenses_fund_allocation' | 'project_actual_sheet';
type DateRangePreset = 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'custom';

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(value);
};

const formatPhone = (contactStr?: string | null) => {
  if (!contactStr) return 'N/A';
  const phoneMatch = contactStr.match(/Phone:\s*([^\s,]+)/i);
  if (phoneMatch) return phoneMatch[1];
  if (contactStr.includes(',')) {
    return contactStr.split(',')[0].replace(/phone:\s*/i, '').trim();
  }
  return contactStr.replace(/phone:\s*/i, '').trim();
};

export function ReportsGenerator() {
  const [reportType, setReportType] = useState<ReportType>('profit_loss');
  const [dateFrom, setDateFrom] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [dateTo, setDateTo] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'));
  
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [projectSearch, setProjectSearch] = useState("");
  const [projDropdownOpen, setProjDropdownOpen] = useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [reportData, setReportData] = useState<any>(null);
  const [generatedConfig, setGeneratedConfig] = useState<{type: ReportType, from: string, to: string, projectId?: string} | null>(null);

  useEffect(() => {
    async function loadProjects() {
      const res = await getProjectsListAction();
      if (res.success && res.data) {
        setProjects(res.data);
      }
    }
    loadProjects();
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setProjDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleGenerate = async () => {
    if (['project_statement', 'project_budget_sheet', 'project_actual_sheet'].includes(reportType) && !selectedProjectId) {
      toast.error('Project Required', { description: 'Please select a specific project for this report.' });
      return;
    }
    if (!['project_statement', 'project_budget_sheet', 'project_actual_sheet'].includes(reportType) && (!dateTo || (reportType !== 'balance_sheet' && !dateFrom))) {
      toast.error('Invalid Date', { description: 'Please select a valid date range.' });
      return;
    }
    setIsLoading(true);
    setReportData(null);
    try {
      let res;
      const pid = selectedProjectId || undefined;
      switch (reportType) {
        case 'profit_loss':
          res = await getProfitLossReportAction(dateFrom, dateTo, pid);
          break;
        case 'income':
          res = await getIncomeStatementAction(dateFrom, dateTo, pid);
          break;
        case 'expense':
          res = await getExpenseStatementAction(dateFrom, dateTo, pid);
          break;
        case 'cash_flow':
          res = await getCashFlowStatementAction(dateFrom, dateTo, pid);
          break;
        case 'balance_sheet':
          res = await getBalanceSheetAction(dateTo, pid);
          break;
        case 'all_project_summary':
          res = await getAllProjectSummaryAction(dateFrom, dateTo);
          break;
        case 'project_statement':
          if (!pid) { toast.error('Project Required', { description: 'Please select a specific project.' }); setIsLoading(false); return; }
          res = await getProjectStatementAction(pid);
          break;
        case 'project_budget_sheet':
          if (!pid) { toast.error('Project Required', { description: 'Please select a specific project for the Budget Sheet.' }); setIsLoading(false); return; }
          res = await getProjectBudgetSheetAction(pid);
          break;
        case 'expenses_fund_allocation':
          res = await getExpensesFundAllocationAction(dateFrom, dateTo);
          break;
        case 'project_actual_sheet':
          if (!pid) { toast.error('Project Required', { description: 'Please select a specific project for the Actual Sheet.' }); setIsLoading(false); return; }
          res = await getProjectActualSheetAction(pid);
          break;
      }
      
      if (res?.success) {
        setReportData(res.data);
        setGeneratedConfig({ type: reportType, from: dateFrom, to: dateTo, projectId: pid });
      } else {
        toast.error('Failed to generate report', { description: res?.error || 'Unknown error' });
      }
    } catch (e: any) {
      toast.error('Exception occurred', { description: e?.message || 'Unknown exception' });
    } finally {
      setIsLoading(false);
    }
  };

  const getReportTitle = (type: ReportType) => {
    switch (type) {
      case 'profit_loss': return 'Profit & Loss Statement';
      case 'income': return 'Income Statement';
      case 'expense': return 'Expense Statement';
      case 'cash_flow': return 'Cash Flow Statement';
      case 'balance_sheet': return 'Balance Sheet';
      case 'project_statement': return 'Project Statement (Client Copy)';
      case 'all_project_summary': return 'All Project Summary';
      case 'project_budget_sheet': return 'Project Budget Sheet';
      case 'expenses_fund_allocation': return 'Total Expences Fund Allocation';
      case 'project_actual_sheet': return 'Project Actual Sheet';
      default: return 'Financial Report';
    }
  };

  const exportPDF = () => {
    if (!reportData || !generatedConfig) return;
    const title = getReportTitle(generatedConfig.type);
    
    // We already fetch company and project data in the report actions
    const companySettings = reportData.company || {};
    let currentProject = reportData.project;

    generateFinancialReportPDF(reportData, generatedConfig as any, companySettings, currentProject, title);
  };

  const exportExcel = () => {
    if (!reportData || !generatedConfig) return;

    const wb = XLSX.utils.book_new();
    
    if (generatedConfig.type === 'profit_loss' || generatedConfig.type === 'cash_flow') {
      const revData = Object.entries(reportData.revenueByProject || {}).map(([k, v]) => ({ 'Project': k, 'Amount': v }));
      revData.push({ 'Project': 'Total Revenue', 'Amount': reportData.totalRevenue });
      const wsRev = XLSX.utils.json_to_sheet(revData);
      XLSX.utils.book_append_sheet(wb, wsRev, "Revenue");

      const costData = Object.entries(reportData.costsByCategory || {}).map(([k, v]) => ({ 'Category': k, 'Amount': v }));
      costData.push({ 'Category': 'Total Costs', 'Amount': reportData.totalCosts });
      const wsCost = XLSX.utils.json_to_sheet(costData);
      XLSX.utils.book_append_sheet(wb, wsCost, "Costs");

      const summaryData = [{ 'Metric': 'Net Profit', 'Value': reportData.netProfit }];
      const wsSummary = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");

    } else if (generatedConfig.type === 'income') {
      const data = Object.entries(reportData.incomeByProject || {}).map(([k, v]) => ({ 'Project': k, 'Amount': v }));
      data.push({ 'Project': 'Total Income', 'Amount': reportData.totalIncome });
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, "Income");

    } else if (generatedConfig.type === 'expense') {
      const data = Object.entries(reportData.expensesByCategory || {}).map(([k, v]) => ({ 'Category': k, 'Amount': v }));
      data.push({ 'Category': 'Total Expenses', 'Amount': reportData.totalExpenses });
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, "Expenses");

    } else if (generatedConfig.type === 'balance_sheet') {
      const assetData = Object.entries(reportData.assets || {}).map(([k, v]) => ({ 'Asset': k, 'Amount': v }));
      assetData.push({ 'Asset': 'Total Assets', 'Amount': reportData.totalAssets });
      const wsAssets = XLSX.utils.json_to_sheet(assetData);
      XLSX.utils.book_append_sheet(wb, wsAssets, "Assets");

      const liabData = Object.entries(reportData.liabilities || {}).map(([k, v]) => ({ 'Liability': k, 'Amount': v }));
      liabData.push({ 'Liability': 'Total Liabilities', 'Amount': reportData.totalLiabilities });
      const wsLiab = XLSX.utils.json_to_sheet(liabData);
      XLSX.utils.book_append_sheet(wb, wsLiab, "Liabilities");

      const summaryData = [{ 'Metric': 'Total Equity', 'Value': reportData.equity }];
      const wsSummary = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");
    } else if (generatedConfig.type === 'all_project_summary') {
      const data = (reportData?.projects || []).map((p: any, idx: number) => ({
        'SR NO': idx + 1,
        'Project ID': p.projectId,
        'Project Code': p.projectNo || p.quotationNo || '',
        'Project/Client Name': p.projectName,
        'Contact No': p.contactNo,
        'Service Type': p.serviceType,
        'Location': p.location,
        'Total Invoice Value': p.totalInvoiceValue,
        'Budget Expenses': p.budgetExpences,
        'Total Expenses': p.totalExpences,
        'Total Received': p.totalReceived,
        'Total Pending': p.totalPending,
        'Total Profit/Loss': p.totalProfitLoss
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(wb, ws, "Project Summary");
    }

    if (wb.SheetNames.length > 0) {
      XLSX.writeFile(wb, `${generatedConfig.type}_report_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);
    } else {
      toast.error('Export Not Supported', { description: 'Excel export is not yet configured for this report type.' });
    }
  };

  const renderTableData = () => {
    if (!reportData || !generatedConfig) return null;
    const type = generatedConfig.type;
    
    const isCashFlow = type === 'cash_flow';
    const inflowTitle = isCashFlow ? '1. Cash Inflow (Revenue)' : '1. Revenue';
    const outflowTitle = isCashFlow ? '2. Cash Outflow (Expenses)' : '2. Costs & Expenses';
    const summaryTitle = isCashFlow ? '3. Cash Flow Summary' : '3. Profit & Loss Summary';
    const overviewTitle = isCashFlow ? '4. Cash Flow Overview' : '4. Financial Overview';
    const totalInflowLabel = isCashFlow ? 'Total Cash Inflow' : 'Total Revenue';
    const totalOutflowLabel = isCashFlow ? 'Total Cash Outflow' : 'Total Costs';
    const netLabel = isCashFlow ? 'Net Cash Flow' : 'Net Profit';

    const UniversalHeader = (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 mt-2 px-6">
        {/* Client Details */}
        <div className="bg-slate-50 dark:bg-[#0f172a]/50 border border-slate-200/60 dark:border-border rounded-2xl p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-bl-full -mr-16 -mt-16 transition-transform group-hover:scale-110"></div>
          <div className="flex items-start gap-4">
            <div className="bg-blue-100 dark:bg-blue-900/30 p-2.5 rounded-xl text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800">
              <User size={22} strokeWidth={2.5} />
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-blue-600 dark:text-blue-400 text-sm mb-4 uppercase tracking-wider">Client Details</h4>
              <table className="w-full text-xs sm:text-sm">
                <tbody>
                  <tr><td className="py-1.5 text-slate-500 w-24 sm:w-28 font-medium">Client Name</td><td className="py-1.5 font-semibold text-slate-800 dark:text-foreground">: {reportData.project?.client_name || 'N/A'}</td></tr>
                  <tr><td className="py-1.5 text-slate-500 font-medium align-top">Address</td><td className="py-1.5 font-semibold text-slate-800 dark:text-foreground">: {reportData.project?.client_address || (generatedConfig.projectId ? 'Address Not Provided' : 'N/A')}</td></tr>
                  <tr><td className="py-1.5 text-slate-500 font-medium">Phone</td><td className="py-1.5 font-semibold text-slate-800 dark:text-foreground">: {formatPhone(reportData.project?.client_contact) || (generatedConfig.projectId ? '' : 'N/A')}</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Project Details */}
        <div className="bg-slate-50 dark:bg-[#0f172a]/50 border border-slate-200/60 dark:border-border rounded-2xl p-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-bl-full -mr-16 -mt-16 transition-transform group-hover:scale-110"></div>
          <div className="flex items-start gap-4">
            <div className="bg-indigo-100 dark:bg-indigo-900/30 p-2.5 rounded-xl text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800">
              <Briefcase size={22} strokeWidth={2.5} />
            </div>
            <div className="flex-1">
              <h4 className="font-bold text-indigo-600 dark:text-indigo-400 text-sm mb-4 uppercase tracking-wider">Project Details</h4>
              <table className="w-full text-xs sm:text-sm">
                <tbody>
                  <tr><td className="py-1.5 text-slate-500 w-24 sm:w-28 font-medium">Project Name</td><td className="py-1.5 font-semibold text-slate-800 dark:text-foreground">: {reportData.project?.name || 'All Projects'}</td></tr>
                  <tr><td className="py-1.5 text-slate-500 font-medium">Manager</td><td className="py-1.5 font-semibold text-slate-800 dark:text-foreground">: Malee House Team</td></tr>
                  <tr><td className="py-1.5 text-slate-500 font-medium">Status</td><td className="py-1.5 font-semibold text-emerald-600 dark:text-emerald-400">: {reportData.project?.status || 'Completed'}</td></tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );

    if (type === 'profit_loss' || type === 'cash_flow') {
      return (
        <div className="space-y-8 pb-10">
          {UniversalHeader}
          
          {/* Revenue / Inflow */}
          <div className="px-6">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-100 dark:border-indigo-900/50 shrink-0">
                <TrendingUp className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight">{inflowTitle}</h3>
            </div>
            <div className="border border-slate-200/70 dark:border-slate-800/70 rounded-xl overflow-hidden bg-white dark:bg-[#0f172a]/80 shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/70 dark:bg-slate-900/50 border-b border-slate-200/70 dark:border-slate-800/70">
                    <th className="py-3 px-6 text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider w-16 text-center">#</th>
                    <th className="py-3 px-6 text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Description</th>
                    <th className="py-3 px-6 text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-right">Amount (INR)</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(reportData.revenueByProject || {}).map(([k, v], idx) => (
                    <tr key={idx} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-white/[0.02]">
                      <td className="py-3 px-6 text-sm text-slate-400 dark:text-slate-500 text-center">{idx + 1}</td>
                      <td className="py-3 px-6 text-sm text-slate-800 dark:text-slate-200 font-medium">{k}</td>
                      <td className="py-3 px-6 text-sm font-semibold tabular-nums text-right text-slate-800 dark:text-slate-200">{formatCurrency(v as number)}</td>
                    </tr>
                  ))}
                  {Object.keys(reportData.revenueByProject || {}).length === 0 && (
                    <tr className="border-b border-slate-100 dark:border-slate-800/50">
                      <td className="py-3 px-6 text-sm text-slate-400 dark:text-slate-500 text-center">1</td>
                      <td className="py-3 px-6 text-sm text-slate-800 dark:text-slate-200 font-medium">Other Income</td>
                      <td className="py-3 px-6 text-sm font-semibold tabular-nums text-right text-slate-800 dark:text-slate-200">₹ 0.00</td>
                    </tr>
                  )}
                  <tr className="bg-slate-50/80 dark:bg-slate-900/40">
                    <td colSpan={2} className="py-3.5 px-6 text-xs text-slate-600 dark:text-slate-300 font-bold uppercase tracking-wider">{totalInflowLabel}</td>
                    <td className="py-3.5 px-6 text-sm font-bold tabular-nums text-right text-slate-900 dark:text-slate-100">{formatCurrency(reportData.totalRevenue)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Costs / Outflow */}
          <div className="px-6">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-100 dark:border-indigo-900/50 shrink-0">
                <TrendingDown className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight">{outflowTitle}</h3>
            </div>
            <div className="border border-slate-200/70 dark:border-slate-800/70 rounded-xl overflow-hidden bg-white dark:bg-[#0f172a]/80 shadow-sm">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/70 dark:bg-slate-900/50 border-b border-slate-200/70 dark:border-slate-800/70">
                    <th className="py-3 px-6 text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider w-16 text-center">#</th>
                    <th className="py-3 px-6 text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Description</th>
                    <th className="py-3 px-6 text-[11px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider text-right">Amount (INR)</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(reportData.costsByCategory || {}).map(([k, v], idx) => (
                    <tr key={idx} className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50/50 dark:hover:bg-white/[0.02]">
                      <td className="py-3 px-6 text-sm text-slate-400 dark:text-slate-500 text-center">{idx + 1}</td>
                      <td className="py-3 px-6 text-sm text-slate-800 dark:text-slate-200 font-medium capitalize">{k}</td>
                      <td className="py-3 px-6 text-sm font-semibold tabular-nums text-right text-slate-800 dark:text-slate-200">{formatCurrency(v as number)}</td>
                    </tr>
                  ))}
                  {Object.keys(reportData.costsByCategory || {}).length === 0 && (
                    <tr className="border-b border-slate-100 dark:border-slate-800/50">
                      <td className="py-3 px-6 text-sm text-slate-400 dark:text-slate-500 text-center">1</td>
                      <td className="py-3 px-6 text-sm text-slate-800 dark:text-slate-200 font-medium">Other Expenses</td>
                      <td className="py-3 px-6 text-sm font-semibold tabular-nums text-right text-slate-800 dark:text-slate-200">₹ 0.00</td>
                    </tr>
                  )}
                  <tr className="bg-slate-50/80 dark:bg-slate-900/40">
                    <td colSpan={2} className="py-3.5 px-6 text-xs text-slate-600 dark:text-slate-300 font-bold uppercase tracking-wider">{totalOutflowLabel}</td>
                    <td className="py-3.5 px-6 text-sm font-bold tabular-nums text-right text-slate-900 dark:text-slate-100">{formatCurrency(reportData.totalCosts)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Summary Section */}
          <div className="px-6">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-100 dark:border-indigo-900/50 shrink-0">
                <Wallet className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight">{summaryTitle}</h3>
            </div>
            <div className="border border-slate-200/70 dark:border-slate-800/70 rounded-xl overflow-hidden bg-white dark:bg-[#0f172a]/80 shadow-sm">
              <table className="w-full text-left border-collapse">
                <tbody>
                  <tr className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50/20 dark:hover:bg-white/[0.01]">
                    <td className="py-3.5 px-6 text-sm text-slate-500 dark:text-slate-400 font-medium">Opening Balance</td>
                    <td className="py-3.5 px-6 text-sm font-semibold tabular-nums text-right text-slate-800 dark:text-slate-200">₹ 0.00</td>
                  </tr>
                  <tr className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50/20 dark:hover:bg-white/[0.01]">
                    <td className="py-3.5 px-6 text-sm text-slate-500 dark:text-slate-400 font-medium">{totalInflowLabel}</td>
                    <td className="py-3.5 px-6 text-sm font-semibold tabular-nums text-right text-slate-800 dark:text-slate-200">{formatCurrency(reportData.totalRevenue)}</td>
                  </tr>
                  <tr className="border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50/20 dark:hover:bg-white/[0.01]">
                    <td className="py-3.5 px-6 text-sm text-slate-500 dark:text-slate-400 font-medium">{totalOutflowLabel}</td>
                    <td className="py-3.5 px-6 text-sm font-semibold tabular-nums text-right text-slate-800 dark:text-slate-200">- {formatCurrency(reportData.totalCosts)}</td>
                  </tr>
                  <tr className="bg-slate-50/80 dark:bg-slate-900/40">
                    <td className="py-4 px-6 text-xs text-slate-700 dark:text-slate-200 font-bold uppercase tracking-wider">Closing Balance</td>
                    <td className="py-4 px-6 text-sm font-bold tabular-nums text-right text-slate-900 dark:text-slate-100">{formatCurrency(reportData.netProfit)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Overview Block */}
          <div className="px-6">
            <div className="flex items-center gap-2.5 mb-3">
              <div className="w-7 h-7 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center border border-indigo-100 dark:border-indigo-900/50 shrink-0">
                <FileBarChart2 className="w-3.5 h-3.5" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 tracking-tight">{overviewTitle}</h3>
            </div>
            <div className="border border-slate-200/70 dark:border-slate-800/70 rounded-xl overflow-hidden bg-white dark:bg-[#0f172a]/80 shadow-sm flex flex-col md:flex-row">
              <div className="flex-1 p-6 border-b md:border-b-0 md:border-r border-slate-200/70 dark:border-slate-800/70 flex flex-col justify-center">
                <div className="flex justify-between items-center mb-3">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Revenue (Inflow)</span>
                  <span className="text-sm font-semibold tabular-nums text-slate-800 dark:text-slate-200">{formatCurrency(reportData.totalRevenue)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Total Expenses (Outflow)</span>
                  <span className="text-sm font-semibold tabular-nums text-slate-800 dark:text-slate-200">{formatCurrency(reportData.totalCosts)}</span>
                </div>
              </div>
              <div className="flex-1 p-6 bg-slate-50/40 dark:bg-white/[0.01] flex flex-col items-center justify-center text-center">
                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">{netLabel}</span>
                <span className="text-2xl font-bold tabular-nums tracking-tight text-slate-900 dark:text-slate-100">
                  {reportData.netProfit < 0 ? '- ' : ''}{formatCurrency(Math.abs(reportData.netProfit))}
                </span>
                <span className={`inline-flex items-center gap-1 mt-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${reportData.netProfit >= 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/40' : 'bg-rose-50 text-rose-700 border border-rose-200/60 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-900/40'}`}>
                  {reportData.netProfit >= 0 ? 'Positive Net' : 'Deficit'}
                </span>
              </div>
            </div>
          </div>

          {/* Signatures */}
          <div className="px-6 mt-16 flex justify-between items-end pb-8">
            <div className="text-center w-48">
              <div className="border-b border-slate-300 dark:border-slate-700 pb-2 mb-2">
                <span className="text-xs font-bold text-slate-800 dark:text-foreground">Prepared By</span>
              </div>
              <span className="text-xs text-slate-500">Malee House Team</span>
            </div>
            <div className="text-center w-48">
              <div className="border-b border-slate-300 dark:border-slate-700 pb-2 mb-2">
                <span className="text-xs font-bold text-slate-800 dark:text-foreground">Approved By</span>
              </div>
              <span className="text-xs text-slate-500">Authorized Signatory</span>
            </div>
          </div>
        </div>
      );
    }

    if (type === 'balance_sheet') {
      return (
        <div className="space-y-6">
          {UniversalHeader}
          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-3 px-6">Assets</h3>
            <table className="w-full text-left border-collapse">
              <tbody>
                {Object.entries(reportData.assets || {}).map(([k, v], idx) => (
                  <tr key={idx} className="border-b border-slate-100 dark:border-border hover:bg-slate-50/50 dark:hover:bg-white/[0.02]">
                    <td className="py-3 px-6 text-sm text-slate-900 dark:text-foreground font-medium">{k}</td>
                    <td className="py-3 px-6 text-sm font-semibold tabular-nums text-right text-slate-900 dark:text-foreground">{formatCurrency(v as number)}</td>
                  </tr>
                ))}
                <tr className="bg-slate-50/50 dark:bg-white/[0.02] border-b-2 border-slate-200 dark:border-border">
                  <td className="py-4 px-6 text-sm text-slate-900 dark:text-foreground font-bold">Total Assets</td>
                  <td className="py-4 px-6 text-sm font-bold tabular-nums text-right text-emerald-600 dark:text-emerald-400">{formatCurrency(reportData.totalAssets)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div>
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-3 px-6 mt-6">Liabilities</h3>
            <table className="w-full text-left border-collapse">
              <tbody>
                {Object.entries(reportData.liabilities || {}).map(([k, v], idx) => (
                  <tr key={idx} className="border-b border-slate-100 dark:border-border hover:bg-slate-50/50 dark:hover:bg-white/[0.02]">
                    <td className="py-3 px-6 text-sm text-slate-900 dark:text-foreground font-medium capitalize">{k}</td>
                    <td className="py-3 px-6 text-sm font-semibold tabular-nums text-right text-slate-900 dark:text-foreground">{formatCurrency(v as number)}</td>
                  </tr>
                ))}
                <tr className="bg-slate-50/50 dark:bg-white/[0.02] border-b-2 border-slate-200 dark:border-border">
                  <td className="py-4 px-6 text-sm text-slate-900 dark:text-foreground font-bold">Total Liabilities</td>
                  <td className="py-4 px-6 text-sm font-bold tabular-nums text-right text-rose-600 dark:text-rose-400">{formatCurrency(reportData.totalLiabilities)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="px-6 py-5 bg-indigo-50/50 dark:bg-indigo-500/10 rounded-xl flex items-center justify-between border border-indigo-100 dark:border-indigo-500/20">
            <span className="text-base font-bold text-indigo-900 dark:text-indigo-100">Total Equity</span>
            <span className="text-xl font-black tabular-nums text-indigo-600 dark:text-indigo-400">
              {formatCurrency(reportData.equity)}
            </span>
          </div>
        </div>
      );
    }
    
    if (type === 'project_statement') {
      return (
        <div className="space-y-6">
          {UniversalHeader}
          
          <div className="mt-6">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-3 px-6">Payment Timeline</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/50 dark:bg-white/[0.02] border-y border-slate-200/60 dark:border-border">
                    <th className="py-3 px-6 text-xs font-black uppercase tracking-widest text-slate-400">Milestone</th>
                    <th className="py-3 px-6 text-xs font-black uppercase tracking-widest text-slate-400">Due Date</th>
                    <th className="py-3 px-6 text-xs font-black uppercase tracking-widest text-slate-400 text-right">Amount</th>
                    <th className="py-3 px-6 text-xs font-black uppercase tracking-widest text-slate-400 text-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(reportData.timeline || []).map((t: any, idx: number) => (
                    <tr key={idx} className="border-b border-slate-100 dark:border-border hover:bg-slate-50/50 dark:hover:bg-white/[0.02]">
                      <td className="py-3 px-6 text-sm text-slate-900 dark:text-foreground font-medium">{t.title}</td>
                      <td className="py-3 px-6 text-sm text-slate-500 dark:text-slate-400">{t.due_date ? new Date(t.due_date).toLocaleDateString() : 'N/A'}</td>
                      <td className="py-3 px-6 text-sm font-semibold tabular-nums text-right text-slate-900 dark:text-foreground">{formatCurrency(t.total_amount)}</td>
                      <td className="py-3 px-6 text-sm text-center">
                        <span className={`px-2 py-1 rounded text-xs font-bold ${t.status === 'paid' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400'}`}>
                          {t.status.toUpperCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          
          <div className="px-6 py-5 grid grid-cols-3 gap-4 border-t border-slate-100 dark:border-border bg-slate-50/50 dark:bg-white/[0.02]">
            <div>
              <p className="text-xs font-bold text-slate-500">Total Billed</p>
              <p className="text-lg font-bold text-slate-900 dark:text-foreground">{formatCurrency(reportData.summary?.totalBilled || 0)}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500">Total Paid</p>
              <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(reportData.summary?.totalPaid || 0)}</p>
            </div>
            <div>
              <p className="text-xs font-bold text-slate-500">Outstanding</p>
              <p className="text-lg font-bold text-rose-600 dark:text-rose-400">{formatCurrency(reportData.summary?.outstanding || 0)}</p>
            </div>
          </div>
        </div>
      );
    }

    if (type === 'income') {
      return (
        <div className="space-y-6">
          {UniversalHeader}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-white/[0.02] border-b border-slate-200/60 dark:border-border">
                  <th className="py-4 px-6 text-xs font-black uppercase tracking-widest text-slate-400">Date</th>
                  <th className="py-4 px-6 text-xs font-black uppercase tracking-widest text-slate-400">Project</th>
                  <th className="py-4 px-6 text-xs font-black uppercase tracking-widest text-slate-400 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {(reportData.incomeTransactions || []).map((t: any, idx: number) => (
                  <tr key={idx} className="border-b border-slate-100 dark:border-border hover:bg-slate-50/50 dark:hover:bg-white/[0.02]">
                    <td className="py-4 px-6 text-sm text-slate-900 dark:text-foreground font-medium">{new Date(t.date).toLocaleDateString()}</td>
                    <td className="py-4 px-6 text-sm text-slate-900 dark:text-foreground font-medium">{t.project}</td>
                    <td className="py-4 px-6 text-sm font-semibold tabular-nums text-right text-slate-900 dark:text-foreground">{formatCurrency(t.amount)}</td>
                  </tr>
                ))}
                <tr className="bg-slate-50/50 dark:bg-white/[0.02] border-t-2 border-slate-200 dark:border-border">
                  <td colSpan={2} className="py-4 px-6 text-sm text-slate-900 dark:text-foreground font-bold">Total Income</td>
                  <td className="py-4 px-6 text-sm font-bold tabular-nums text-right text-emerald-600 dark:text-emerald-400">{formatCurrency(reportData.totalIncome)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      );
    }
    
    if (type === 'all_project_summary') {
      return (
        <div className="space-y-6">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-max">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-white/[0.02] border-b border-slate-200/60 dark:border-border">
                  <th className="py-4 px-4 text-xs font-black uppercase tracking-widest text-slate-400">SR NO</th>
                  <th className="py-4 px-4 text-xs font-black uppercase tracking-widest text-slate-400">Project ID</th>
                  <th className="py-4 px-4 text-xs font-black uppercase tracking-widest text-slate-400">Project Code</th>
                  <th className="py-4 px-4 text-xs font-black uppercase tracking-widest text-slate-400">Project/Client Name</th>
                  <th className="py-4 px-4 text-xs font-black uppercase tracking-widest text-slate-400">Contact No</th>
                  <th className="py-4 px-4 text-xs font-black uppercase tracking-widest text-slate-400">Service Type</th>
                  <th className="py-4 px-4 text-xs font-black uppercase tracking-widest text-slate-400">Location</th>
                  <th className="py-4 px-4 text-xs font-black uppercase tracking-widest text-slate-400 text-right">Total Invoice Value</th>
                  <th className="py-4 px-4 text-xs font-black uppercase tracking-widest text-slate-400 text-right">Budget Expenses</th>
                  <th className="py-4 px-4 text-xs font-black uppercase tracking-widest text-slate-400 text-right">Total Expenses</th>
                  <th className="py-4 px-4 text-xs font-black uppercase tracking-widest text-slate-400 text-right">Total Received</th>
                  <th className="py-4 px-4 text-xs font-black uppercase tracking-widest text-slate-400 text-right">Total Pending</th>
                  <th className="py-4 px-4 text-xs font-black uppercase tracking-widest text-slate-400 text-right">Total Profit/Loss</th>
                </tr>
              </thead>
              <tbody>
                {(reportData?.projects || []).map((p: any, idx: number) => (
                  <tr key={idx} className="border-b border-slate-100 dark:border-border hover:bg-slate-50/50 dark:hover:bg-white/[0.02]">
                    <td className="py-4 px-4 text-sm text-slate-900 dark:text-foreground font-medium">{idx + 1}</td>
                    <td className="py-4 px-4 text-sm text-slate-900 dark:text-foreground">{p.projectId}</td>
                    <td className="py-4 px-4 text-sm text-slate-900 dark:text-foreground">{p.projectNo || p.quotationNo || '-'}</td>
                    <td className="py-4 px-4 text-sm text-slate-900 dark:text-foreground">{p.projectName}</td>
                    <td className="py-4 px-4 text-sm text-slate-900 dark:text-foreground whitespace-nowrap">{p.contactNo}</td>
                    <td className="py-4 px-4 text-sm text-slate-900 dark:text-foreground">{p.serviceType}</td>
                    <td className="py-4 px-4 text-sm text-slate-900 dark:text-foreground">{p.location}</td>
                    <td className="py-4 px-4 text-sm tabular-nums text-right text-slate-900 dark:text-foreground">{p.totalInvoiceValue}</td>
                    <td className="py-4 px-4 text-sm tabular-nums text-right text-slate-900 dark:text-foreground">{p.budgetExpences}</td>
                    <td className="py-4 px-4 text-sm tabular-nums text-right text-slate-900 dark:text-foreground">{p.totalExpences}</td>
                    <td className="py-4 px-4 text-sm tabular-nums text-right text-emerald-600 dark:text-emerald-400">{p.totalReceived}</td>
                    <td className="py-4 px-4 text-sm tabular-nums text-right text-rose-600 dark:text-rose-400">{p.totalPending}</td>
                    <td className="py-4 px-4 text-sm font-semibold tabular-nums text-right text-slate-900 dark:text-foreground">{p.totalProfitLoss}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }
    
    if (type === 'project_budget_sheet') {
      return (
        <div className="space-y-6">
          {UniversalHeader}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-max">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-white/[0.02] border-b border-slate-200/60 dark:border-border">
                  <th className="py-4 px-4 text-xs font-black uppercase tracking-widest text-slate-400">Sr No</th>
                  <th className="py-4 px-4 text-xs font-black uppercase tracking-widest text-slate-400">Particulars</th>
                  <th className="py-4 px-4 text-xs font-black uppercase tracking-widest text-slate-400 text-right">Qty</th>
                  <th className="py-4 px-4 text-xs font-black uppercase tracking-widest text-slate-400 text-right">Rate</th>
                  <th className="py-4 px-4 text-xs font-black uppercase tracking-widest text-slate-400 text-right">Days</th>
                  <th className="py-4 px-4 text-xs font-black uppercase tracking-widest text-slate-400 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(reportData.budgetDetails || {}).map(([section, items]: [string, any], sectionIdx: number) => (
                  <React.Fragment key={`section-${sectionIdx}`}>
                    <tr className="bg-slate-100/50 dark:bg-slate-800/50">
                      <td colSpan={6} className="py-2 px-4 text-sm font-bold text-indigo-700 dark:text-indigo-400">{section}</td>
                    </tr>
                    {items.map((item: any, itemIdx: number) => (
                      <tr key={`item-${sectionIdx}-${itemIdx}`} className="border-b border-slate-100 dark:border-border hover:bg-slate-50/50 dark:hover:bg-white/[0.02]">
                        <td className="py-3 px-4 text-sm text-slate-900 dark:text-foreground">{itemIdx + 1}</td>
                        <td className="py-3 px-4 text-sm text-slate-900 dark:text-foreground">{item.particulars}</td>
                        <td className="py-3 px-4 text-sm tabular-nums text-right text-slate-900 dark:text-foreground">{item.qty}</td>
                        <td className="py-3 px-4 text-sm tabular-nums text-right text-slate-900 dark:text-foreground">{item.rate}</td>
                        <td className="py-3 px-4 text-sm tabular-nums text-right text-slate-900 dark:text-foreground">{item.days}</td>
                        <td className="py-3 px-4 text-sm tabular-nums text-right text-slate-900 dark:text-foreground">{item.amount}</td>
                      </tr>
                    ))}
                    <tr className="bg-slate-50/80 dark:bg-slate-900/40 border-b-2 border-slate-200 dark:border-slate-800">
                      <td colSpan={5} className="py-3 px-4 text-sm text-slate-900 dark:text-foreground font-bold text-right">Total {section}</td>
                      <td className="py-3 px-4 text-sm font-bold tabular-nums text-right text-indigo-600 dark:text-indigo-400">{reportData.sectionTotals?.[section] || 0}</td>
                    </tr>
                  </React.Fragment>
                ))}
                <tr className="border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-white/[0.02]">
                  <td colSpan={5} className="py-3 px-4 text-sm font-bold text-right text-slate-900 dark:text-foreground">Total Project Value</td>
                  <td className="py-3 px-4 text-sm font-bold tabular-nums text-right text-slate-900 dark:text-foreground">{reportData.totalQuotationValue || 0}</td>
                </tr>
                <tr className="border-t border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-white/[0.02]">
                  <td colSpan={5} className="py-3 px-4 text-sm font-bold text-right text-slate-900 dark:text-foreground">Total Project Costing</td>
                  <td className="py-3 px-4 text-sm font-bold tabular-nums text-right text-slate-900 dark:text-foreground">{reportData.totalProjectCosting || 0}</td>
                </tr>
                <tr className="border-y-2 border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-white/[0.05]">
                  <td colSpan={5} className="py-3 px-4 text-sm font-black text-right text-slate-900 dark:text-foreground">Net Amount</td>
                  <td className="py-3 px-4 text-sm font-black tabular-nums text-right text-slate-900 dark:text-foreground">{reportData.netAmount || 0}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      );
    }
    
    if (type === 'expenses_fund_allocation') {
      return (
        <div className="space-y-6">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-max">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-white/[0.02] border-b border-slate-200/60 dark:border-border">
                  <th className="py-4 px-4 text-xs font-black uppercase tracking-widest text-slate-400">SR NO</th>
                  <th className="py-4 px-4 text-xs font-black uppercase tracking-widest text-slate-400">Bank Name</th>
                  <th className="py-4 px-4 text-xs font-black uppercase tracking-widest text-slate-400">Service / Divide</th>
                  <th className="py-4 px-4 text-xs font-black uppercase tracking-widest text-slate-400 text-right">Day</th>
                  <th className="py-4 px-4 text-xs font-black uppercase tracking-widest text-slate-400 text-right">Amount</th>
                  <th className="py-4 px-4 text-xs font-black uppercase tracking-widest text-slate-400">Remark</th>
                </tr>
              </thead>
              <tbody>
                {(reportData.fundAllocations || []).map((a: any, idx: number) => (
                  <tr key={idx} className="border-b border-slate-100 dark:border-border hover:bg-slate-50/50 dark:hover:bg-white/[0.02]">
                    <td className="py-4 px-4 text-sm text-slate-900 dark:text-foreground font-medium">{idx + 1}</td>
                    <td className="py-4 px-4 text-sm text-slate-900 dark:text-foreground">{a.bankName}</td>
                    <td className="py-4 px-4 text-sm text-slate-900 dark:text-foreground">{a.serviceDivide}</td>
                    <td className="py-4 px-4 text-sm tabular-nums text-right text-slate-900 dark:text-foreground">{a.day}</td>
                    <td className="py-4 px-4 text-sm tabular-nums text-right text-slate-900 dark:text-foreground">{formatCurrency(a.amount)}</td>
                    <td className="py-4 px-4 text-sm text-slate-900 dark:text-foreground">{a.remark || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      );
    }
    
    if (type === 'project_actual_sheet') {
      return (
        <div className="space-y-6">
          {UniversalHeader}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-max">
              <thead>
                <tr className="bg-slate-50/50 dark:bg-white/[0.02] border-b border-slate-200/60 dark:border-border">
                  <th className="py-4 px-4 text-xs font-black uppercase tracking-widest text-slate-400">Date</th>
                  <th className="py-4 px-4 text-xs font-black uppercase tracking-widest text-slate-400">Particulars</th>
                  <th className="py-4 px-4 text-xs font-black uppercase tracking-widest text-slate-400 text-right">Debit</th>
                  <th className="py-4 px-4 text-xs font-black uppercase tracking-widest text-slate-400 text-right">Credit</th>
                </tr>
              </thead>
              <tbody>
                {(reportData.ledger || []).map((l: any, idx: number) => {
                  const dateStr = l.date ? format(new Date(l.date), 'dd-MM-yyyy') : '-';
                  return (
                    <tr key={idx} className="border-b border-slate-100 dark:border-border hover:bg-slate-50/50 dark:hover:bg-white/[0.02]">
                      <td className="py-3 px-4 text-sm text-slate-900 dark:text-foreground">{dateStr}</td>
                      <td className="py-3 px-4 text-sm text-slate-900 dark:text-foreground">{l.particulars}</td>
                      <td className="py-3 px-4 text-sm tabular-nums text-right text-slate-900 dark:text-foreground">{l.debit ? l.debit : ''}</td>
                      <td className="py-3 px-4 text-sm tabular-nums text-right text-slate-900 dark:text-foreground">{l.credit ? l.credit : ''}</td>
                    </tr>
                  );
                })}
                <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-white/[0.02]">
                  <td colSpan={2} className="py-3 px-4 text-sm font-bold text-right text-slate-900 dark:text-foreground">Net Profit/Loss</td>
                  <td className="py-3 px-4 text-sm font-bold tabular-nums text-right text-slate-900 dark:text-foreground">{reportData.netProfitLoss}</td>
                  <td className="py-3 px-4"></td>
                </tr>
                <tr className="border-b-2 border-slate-200 dark:border-slate-800 bg-slate-100/50 dark:bg-white/[0.05]">
                  <td colSpan={2} className="py-3 px-4 text-sm font-black text-right text-slate-900 dark:text-foreground">Total</td>
                  <td className="py-3 px-4 text-sm font-black tabular-nums text-right text-slate-900 dark:text-foreground">{reportData.total}</td>
                  <td className="py-3 px-4 text-sm font-black tabular-nums text-right text-slate-900 dark:text-foreground">{reportData.total}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      );
    }
    
    // Fallback for expense
    const items = reportData.expensesByCategory;
    const total = reportData.totalExpenses;
    
    return (
      <div className="space-y-6">
        {UniversalHeader}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
            <tr className="bg-slate-50/50 dark:bg-white/[0.02] border-b border-slate-200/60 dark:border-border">
              <th className="py-4 px-6 text-xs font-black uppercase tracking-widest text-slate-400">Category</th>
              <th className="py-4 px-6 text-xs font-black uppercase tracking-widest text-slate-400 text-right">Amount</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(items || {}).map(([k, v], idx) => (
              <tr key={idx} className="border-b border-slate-100 dark:border-border hover:bg-slate-50/50 dark:hover:bg-white/[0.02]">
                <td className="py-4 px-6 text-sm text-slate-900 dark:text-foreground font-medium capitalize">{k}</td>
                <td className="py-4 px-6 text-sm font-semibold tabular-nums text-right text-slate-900 dark:text-foreground">{formatCurrency(v as number)}</td>
              </tr>
            ))}
            <tr className="bg-slate-50/50 dark:bg-white/[0.02] border-t-2 border-slate-200 dark:border-border">
              <td className="py-4 px-6 text-sm text-slate-900 dark:text-foreground font-bold">Total Expenses</td>
              <td className="py-4 px-6 text-sm font-bold tabular-nums text-right text-rose-600 dark:text-rose-400">{formatCurrency(total)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Financial Reports"
        subtitle="Generate, view, and export detailed financial statements."
        icon={BarChart3}
        actions={
          <div className="w-full sm:w-72">
            <Select
              value={reportType}
              onValueChange={(val) => setReportType(val as ReportType)}
              buttonClassName="w-full h-10 px-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500/30 transition-all dark:text-slate-100 cursor-pointer shadow-sm text-left"
            >
              <SelectItem value="profit_loss">Profit & Loss Statement</SelectItem>
              <SelectItem value="income">Income Statement</SelectItem>
              <SelectItem value="expense">Expense Statement</SelectItem>
              <SelectItem value="cash_flow">Cash Flow Statement</SelectItem>
              <SelectItem value="balance_sheet">Balance Sheet</SelectItem>
              <SelectItem value="project_statement">Project Statement (Client Copy)</SelectItem>
              <SelectItem value="all_project_summary">All Project Summary</SelectItem>
              <SelectItem value="project_budget_sheet">Project Budget Sheet</SelectItem>
              <SelectItem value="expenses_fund_allocation">Total Expenses Fund Allocation</SelectItem>
              <SelectItem value="project_actual_sheet">Project Actual Sheet</SelectItem>
            </Select>
          </div>
        }
      />

      {/* Minimal controls below */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 p-5 bg-slate-50 dark:bg-white/5 rounded-2xl border border-slate-200/40 dark:border-white/5">
        <div className="flex flex-row items-center gap-3 w-full lg:w-auto overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 scrollbar-none flex-nowrap">
          {/* Searchable Project Filter */}
          <div className="w-[200px] sm:w-64 shrink-0 relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setProjDropdownOpen(!projDropdownOpen)}
              className="w-full flex items-center justify-between px-4 h-11 rounded-xl text-sm font-semibold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-all outline-none"
            >
              <span className="truncate">
                {projects.find(p => p.id === selectedProjectId)?.name || "All Projects (Company-wide)"}
              </span>
              <ChevronDown className={cn("h-4 w-4 text-slate-400 dark:text-slate-500 transition-transform duration-200 shrink-0 ml-2", projDropdownOpen && "rotate-180")} />
            </button>

            {projDropdownOpen && (
              <div className="absolute top-full left-0 w-full mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl z-50 overflow-hidden">
                {/* Search input inside dropdown */}
                <div className="p-2.5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-2.5">
                  <Search className="w-4 h-4 text-slate-400 shrink-0" />
                  <input
                    type="text"
                    value={projectSearch}
                    onChange={(e) => setProjectSearch(e.target.value)}
                    placeholder="Search projects..."
                    className="w-full bg-transparent border-none text-xs outline-none text-slate-700 dark:text-slate-200 placeholder:text-slate-400"
                  />
                </div>

                {/* Project List */}
                <div className="max-h-48 overflow-y-auto p-1.5 space-y-0.5">
                  <button
                    type="button"
                    onClick={() => { setSelectedProjectId(""); setProjDropdownOpen(false); setProjectSearch(""); }}
                    className={cn(
                      "w-full flex items-center justify-between px-3 py-2 text-left rounded-lg text-xs font-medium transition-colors",
                      !selectedProjectId 
                        ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" 
                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                    )}
                  >
                    <span>All Projects (Company-wide)</span>
                    {!selectedProjectId && <Check className="w-3.5 h-3.5" />}
                  </button>

                  {projects.filter(p => p.name.toLowerCase().includes(projectSearch.toLowerCase())).map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => { setSelectedProjectId(p.id); setProjDropdownOpen(false); setProjectSearch(""); }}
                      className={cn(
                        "w-full flex items-center justify-between px-3 py-2 text-left rounded-lg text-xs font-medium transition-colors",
                        selectedProjectId === p.id 
                          ? "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" 
                          : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                      )}
                    >
                      <span className="truncate max-w-[180px]">{p.name}</span>
                      {selectedProjectId === p.id && <Check className="w-3.5 h-3.5" />}
                    </button>
                  ))}

                  {projects.filter(p => p.name.toLowerCase().includes(projectSearch.toLowerCase())).length === 0 && (
                    <div className="px-3 py-2 text-xs text-slate-400 italic text-center">
                      No matching projects
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Premium Date Pickers wrapped in a non-wrapping flex row */}
          {!['balance_sheet', 'project_statement', 'project_budget_sheet', 'project_actual_sheet'].includes(reportType) && (
            <div className="flex items-center gap-2.5 flex-nowrap shrink-0">
              <div className="w-[140px] sm:w-[170px]">
                <PremiumDatePicker
                  value={dateFrom}
                  onChange={setDateFrom}
                  align="left"
                  className="w-full"
                  triggerClassName="text-sm font-semibold h-11 py-2.5 px-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                />
              </div>

              <span className="text-slate-400 text-sm font-bold shrink-0">to</span>

              <div className="w-[140px] sm:w-[170px]">
                <PremiumDatePicker
                  value={dateTo}
                  onChange={setDateTo}
                  align="left"
                  className="w-full"
                  triggerClassName="text-sm font-semibold h-11 py-2.5 px-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800"
                />
              </div>
            </div>
          )}

          <button
            onClick={handleGenerate}
            disabled={isLoading}
            className="h-11 px-7 bg-indigo-600 hover:bg-indigo-700 dark:bg-indigo-500 dark:hover:bg-indigo-600 text-white rounded-xl text-sm font-bold transition-all shadow-sm flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed hover:scale-[1.02] active:scale-[0.98] shrink-0"
          >
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            Generate
          </button>
        </div>

        {/* Exports on the right */}
        {reportData && generatedConfig && (
          <div className="flex items-center gap-3 w-full lg:w-auto justify-start lg:justify-end border-t lg:border-t-0 border-slate-200/50 dark:border-white/5 pt-4 lg:pt-0">
            <button
              onClick={exportExcel}
              className="w-full sm:w-auto h-11 px-5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-sm font-bold transition-all shadow-sm flex items-center justify-center gap-2"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              Excel
            </button>
            <button
              onClick={exportPDF}
              className="w-full sm:w-auto h-11 px-5 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-200 rounded-xl text-sm font-bold transition-all shadow-sm flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4 text-rose-600 dark:text-rose-400" />
              PDF
            </button>
          </div>
        )}
      </div>
      {/* Report Output */}
      {reportData && generatedConfig && (
        <div className="bg-white dark:bg-white/[0.02] border border-slate-200/60 dark:border-border rounded-2xl overflow-hidden shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500 pb-2">
          
          <div className="p-6 border-b border-slate-100 dark:border-border text-center">
            <h2 className="text-2xl font-black text-slate-900 dark:text-foreground tracking-tight">
              {getReportTitle(generatedConfig.type)}
            </h2>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">
              {generatedConfig.type === 'project_statement' 
                ? 'Client Statement of Account & Payment Timeline'
                : generatedConfig.type === 'project_budget_sheet'
                ? 'Project Budget Sheet Overview'
                : generatedConfig.type === 'project_actual_sheet'
                ? 'Project Actual Revenue vs Expenditure'
                : generatedConfig.type === 'balance_sheet' 
                ? `As of ${format(new Date(generatedConfig.to), 'MMMM d, yyyy')}`
                : `For the period ${format(new Date(generatedConfig.from), 'MMM d, yyyy')} to ${format(new Date(generatedConfig.to), 'MMM d, yyyy')}`
              }
            </p>
            {generatedConfig.projectId && (
              <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400 mt-2">
                Project: {projects.find(p => p.id === generatedConfig.projectId)?.name}
              </p>
            )}
          </div>

          <div className="pt-4">
            {renderTableData()}
          </div>
          
        </div>
      )}

      {/* Empty State / Initial state */}
      {!reportData && !isLoading && (
        <EmptyState 
          icon={FileText} 
          message="Select a report type, project, and date range to generate." 
        />
      )}
    </div>
  );
}

export default ReportsGenerator;

