export type AuditLogAction =
  // Authentication
  | 'LOGIN'
  | 'LOGOUT'
  | 'LOGIN_FAILED'
  | 'PASSWORD_CHANGED'
  | 'PASSWORD_RESET'

  // Users / Employees
  | 'USER_CREATED'
  | 'USER_UPDATED'
  | 'USER_DELETED'
  | 'USER_DEACTIVATED'
  | 'ROLE_CHANGED'

  // Projects
  | 'PROJECT_CREATED'
  | 'PROJECT_UPDATED'
  | 'PROJECT_DELETED'
  | 'PROJECT_STATUS_CHANGED'

  // Invoices
  | 'INVOICE_CREATED'
  | 'INVOICE_UPDATED'
  | 'INVOICE_DELETED'
  | 'INVOICE_SENT'
  | 'INVOICE_MARKED_PAID'

  // Payments
  | 'PAYMENT_CREATED'
  | 'PAYMENT_UPDATED'
  | 'PAYMENT_DELETED'

  // Expenses
  | 'EXPENSE_CREATED'
  | 'EXPENSE_UPDATED'
  | 'EXPENSE_DELETED'
  | 'EXPENSE_APPROVED'
  | 'EXPENSE_REJECTED'

  // Milestones
  | 'MILESTONE_CREATED'
  | 'MILESTONE_UPDATED'
  | 'MILESTONE_DELETED'
  | 'MILESTONE_COMPLETED'
  | 'MILESTONE_DUE_DATE_CHANGED'

  // System
  | 'SETTINGS_UPDATED'
  | 'BANK_ACCOUNT_ADDED'
  | 'BANK_ACCOUNT_UPDATED'
  | 'BANK_ACCOUNT_REMOVED';

export type AuditLogModule =
  | 'Auth'
  | 'Users'
  | 'Projects'
  | 'Invoices'
  | 'Payments'
  | 'Expenses'
  | 'Milestones'
  | 'System';

export interface AuditLogPayload {
  userId?: string;
  action: AuditLogAction;
  module: AuditLogModule;
  entityType?: string;
  entityId?: string;
  description: string;
  oldValue?: Record<string, any>;
  newValue?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface AuditLogRecord extends AuditLogPayload {
  id: string;
  userName?: string;
  userRole?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}
