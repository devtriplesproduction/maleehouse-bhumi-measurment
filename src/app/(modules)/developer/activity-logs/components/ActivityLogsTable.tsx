'use client';

import { useState, useTransition } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ChevronLeft, ChevronRight, Search, Activity, User, Info, FileJson, Clock, Eye, Layers, Zap } from 'lucide-react';
import { KPICard } from '@/components/modules/KPICard';
import type { AuditLogRecord } from '@/lib/audit/types';

export default function ActivityLogsTable({ initialData, totalPages }: { initialData: AuditLogRecord[], totalPages: number }) {
  const [data, setData] = useState<AuditLogRecord[]>(initialData);
  const [page, setPage] = useState(1);
  const [currentTotalPages, setCurrentTotalPages] = useState(totalPages);
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [timeFilter, setTimeFilter] = useState('all');
  const [isPending, startTransition] = useTransition();
  
  const [selectedLog, setSelectedLog] = useState<AuditLogRecord | null>(null);

  const modules = ['Auth', 'Users', 'Projects', 'Invoices', 'Payments', 'Expenses', 'Milestones', 'System'];
  
  const fetchLogs = async (p: number, s: string, m: string, a: string, t: string) => {
    // We would normally call a server action here to fetch the paginated data.
    // Assuming we have a getAuditLogsAction in the backend.
    const { getAuditLogsAction } = await import('@/actions/admin.actions');
    const res = await getAuditLogsAction({ page: p, search: s, module: m !== 'all' ? m : undefined, action: a !== 'all' ? a : undefined, timeRange: t !== 'all' ? t : undefined });
    if (res.success && res.data) {
      setData(res.data.items);
      setCurrentTotalPages(res.data.totalPages);
    }
  };

  const handleFilterChange = () => {
    startTransition(() => {
      setPage(1);
      fetchLogs(1, search, moduleFilter, actionFilter, timeFilter);
    });
  };

  const clearFilters = () => {
    startTransition(() => {
      setSearch('');
      setModuleFilter('all');
      setActionFilter('all');
      setTimeFilter('all');
      setPage(1);
      fetchLogs(1, '', 'all', 'all', 'all');
    });
  };

  const getActionColor = (action: string) => {
    if (action.includes('CREATED')) return 'bg-green-100 text-green-800 border-green-200';
    if (action.includes('DELETED') || action.includes('REJECTED')) return 'bg-red-100 text-red-800 border-red-200';
    if (action.includes('UPDATED') || action.includes('CHANGED')) return 'bg-blue-100 text-blue-800 border-blue-200';
    if (action.includes('PAID') || action.includes('APPROVED')) return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    return 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const uniqueUsers = new Set(data.map(d => d.userName)).size;
  const uniqueModules = new Set(data.map(d => d.module)).size;
  const modificationsCount = data.filter(d => d.action.includes('CREATE') || d.action.includes('UPDATE') || d.action.includes('CHANGE')).length;

  return (
    <div className="space-y-6">
      {/* ── Summary KPI Cards ────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          label="Total Logged"
          value={data.length}
          icon={Activity}
          color="text-indigo-600 dark:text-indigo-400"
          bg="bg-indigo-500/10"
        />
        <KPICard
          label="Active Modules"
          value={uniqueModules}
          icon={Layers}
          color="text-purple-600 dark:text-purple-400"
          bg="bg-purple-500/10"
        />
        <KPICard
          label="Active Users"
          value={uniqueUsers}
          icon={User}
          color="text-emerald-600 dark:text-emerald-400"
          bg="bg-emerald-500/10"
        />
        <KPICard
          label="Modifications"
          value={modificationsCount}
          icon={Zap}
          color="text-amber-600 dark:text-amber-400"
          bg="bg-amber-500/10"
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex w-full max-w-sm items-center space-x-2 relative">
          <Search className="w-4 h-4 absolute left-3 text-muted-foreground" />
          <Input 
            placeholder="Search activities..." 
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleFilterChange()}
          />
        </div>
        
        <div className="flex gap-2 w-full sm:w-auto overflow-x-auto pb-1">
          <select 
            className="flex h-10 w-[140px] items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            value={timeFilter} 
            onChange={(e) => { setTimeFilter(e.target.value); setTimeout(() => fetchLogs(1, search, moduleFilter, actionFilter, e.target.value), 0); }}
          >
            <option value="all">Any time</option>
            <option value="1h">Past hour</option>
            <option value="24h">Past 24 hours</option>
            <option value="7d">Past 7 days</option>
            <option value="30d">Past 30 days</option>
            <option value="1y">Past year</option>
          </select>
          <select 
            className="flex h-10 w-[140px] items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            value={moduleFilter} 
            onChange={(e) => { setModuleFilter(e.target.value); setTimeout(handleFilterChange, 0); }}
          >
            <option value="all">All Modules</option>
            {modules.map(m => <option key={m} value={m}>{m}</option>)}
          </select>

          <Button variant="outline" onClick={clearFilters} className="shrink-0">
            Clear Filters
          </Button>
        </div>
      </div>

      <Card>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-[180px]">Date & Time</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Module</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((log) => (
                <TableRow key={log.id} className={isPending ? 'opacity-50' : ''}>
                  <TableCell className="font-medium whitespace-nowrap">
                    <div className="flex items-center text-sm">
                      <Clock className="mr-2 h-4 w-4 text-muted-foreground" />
                      {format(new Date(log.createdAt), 'dd MMM yyyy, HH:mm:ss')}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{log.userName}</span>
                      <span className="text-xs text-muted-foreground capitalize">{log.userRole}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={getActionColor(log.action)}>
                      {log.action.replace(/_/g, ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>{log.module}</TableCell>
                  <TableCell className="max-w-[300px] truncate" title={log.description}>
                    {log.description}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="sm" onClick={() => setSelectedLog(log)}>
                      <Eye className="h-4 w-4 mr-1" />
                      View
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {data.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                    No activity logs found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        
        {currentTotalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-4 border-t">
            <div className="text-sm text-muted-foreground">
              Page {page} of {currentTotalPages}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setPage(p => Math.max(1, p - 1)); setTimeout(() => fetchLogs(page - 1, search, moduleFilter, actionFilter, timeFilter), 0); }}
                disabled={page === 1 || isPending}
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setPage(p => Math.min(currentTotalPages, p + 1)); setTimeout(() => fetchLogs(page + 1, search, moduleFilter, actionFilter, timeFilter), 0); }}
                disabled={page === currentTotalPages || isPending}
              >
                Next
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" />
              Activity Details
            </DialogTitle>
          </DialogHeader>
          
          {selectedLog && (
            <div className="space-y-6 mt-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-1">
                  <p className="text-muted-foreground flex items-center"><User className="h-4 w-4 mr-1"/> User</p>
                  <p className="font-medium">{selectedLog.userName} ({selectedLog.userRole})</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground flex items-center"><Clock className="h-4 w-4 mr-1"/> Timestamp</p>
                  <p className="font-medium">{format(new Date(selectedLog.createdAt), 'dd MMM yyyy, HH:mm:ss.SSS')}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground flex items-center"><Info className="h-4 w-4 mr-1"/> Action</p>
                  <Badge variant="outline" className={getActionColor(selectedLog.action)}>
                    {selectedLog.action}
                  </Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-muted-foreground">Module / Entity</p>
                  <p className="font-medium">{selectedLog.module} {selectedLog.entityType ? `/ ${selectedLog.entityType}` : ''}</p>
                </div>
              </div>

              <div className="bg-muted p-4 rounded-md">
                <p className="text-sm font-medium mb-1">Description</p>
                <p className="text-sm text-muted-foreground">{selectedLog.description}</p>
                {selectedLog.entityId && (
                  <p className="text-xs text-muted-foreground mt-2">Entity ID: <code className="bg-background px-1 py-0.5 rounded border">{selectedLog.entityId}</code></p>
                )}
              </div>

              {(selectedLog.oldValue || selectedLog.newValue) && (
                <div className="space-y-3">
                  <h4 className="text-sm font-semibold flex items-center gap-2 border-b pb-2">
                    <FileJson className="h-4 w-4" /> Data Changes
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedLog.oldValue && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Before</p>
                        <pre className="text-xs bg-red-50 text-red-900 border border-red-100 p-3 rounded-md overflow-x-auto whitespace-pre-wrap max-h-[300px]">
                          {JSON.stringify(selectedLog.oldValue, null, 2)}
                        </pre>
                      </div>
                    )}
                    {selectedLog.newValue && (
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">After</p>
                        <pre className="text-xs bg-green-50 text-green-900 border border-green-100 p-3 rounded-md overflow-x-auto whitespace-pre-wrap max-h-[300px]">
                          {JSON.stringify(selectedLog.newValue, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {(selectedLog.ipAddress || selectedLog.userAgent) && (
                <div className="pt-4 border-t text-xs text-muted-foreground grid grid-cols-1 md:grid-cols-2 gap-2">
                  <div><span className="font-medium">IP:</span> {selectedLog.ipAddress || 'N/A'}</div>
                  <div className="truncate" title={selectedLog.userAgent}><span className="font-medium">Agent:</span> {selectedLog.userAgent || 'N/A'}</div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
