'use server'

import { normalizeData } from '@/lib/normalize';

import { revalidatePath } from 'next/cache'
import { getUserProfileAction } from '@/actions/auth.actions'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { OnboardFormData } from '@/lib/validations/onboard'
import { checkActionRateLimit } from '@/lib/rate-limit'
import { createAuditLog } from '@/lib/audit/createAuditLog'

export async function logAdminAuditAction({
  action,
  details,
  severity,
  targetUserId,
}: {
  action: string
  details: any
  severity: 'info' | 'warning' | 'critical' | 'security'
  targetUserId?: string
}) {
  try {
    const profile: any = await getUserProfileAction()
    const actorId = profile?.id || 'system'
    const actorEmail = profile?.email || 'system@maleehouse.com'

    const supabaseAdmin: any = createAdminClient()
    await (supabaseAdmin as any).from('activity_logs').insert({
      id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      user_id: actorId === 'system' ? null : actorId,
      actor_email: actorEmail,
      action,
      details,
      severity,
      target_user_id: targetUserId ?? null,
      created_at: new Date().toISOString(),
    } as any)
  } catch (error: any) {
    console.error('Audit log insertion failed:', error.message)
  }
}

async function insertSystemNotification(
  userId: string,
  title: string,
  message: string,
  type: 'assignment' | 'stage_update' | 'approval' | 'rejection' | 'deadline_warning' | 'system'
) {
  try {
    const supabaseAdmin: any = createAdminClient()
    await (supabaseAdmin as any).rpc('generate_system_notification', {
      p_target_user_id: userId,
      p_title: title,
      p_message: message,
      p_type: type,
      p_related_project_id: null
    });
  } catch (err: any) {
    console.error('Failed to insert notification:', err.message)
  }
}

export async function generateReadableEmployeeId(deptId: string): Promise<string> {
  const supabaseAdmin: any = createAdminClient()
  const { data: profiles } = await supabaseAdmin.from('profiles').select('employee_id')
  const currentYear = new Date().getFullYear()
  const deptShort =
    deptId === 'admin' ? 'ADM' :
    deptId === 'operations' ? 'OPS' :
    deptId === 'survey' ? 'SRV' :
    deptId === 'design' ? 'DSN' : 'EMP'
  const prefix = `MH-${deptShort}-${currentYear}-`
  const matching = (profiles || []).filter((p: any) => p.employee_id && p.employee_id.startsWith(prefix))
  const seq = matching.length + 1
  return `${prefix}${String(seq).padStart(3, '0')}`
}

export async function getAllUsersAction() {
  try {
    const profile: any = await getUserProfileAction()
    if (!profile || !['admin', 'engineer', 'hr', 'accountant'].includes(profile.role?.toLowerCase())) {
      return { success: false, error: 'Unauthorized' }
    }
    
    // Prefer user-scoped client (RLS) with narrow columns — not full profiles dump
    const supabase: any = await createClient()
    const { data, error } = await supabase
      .from('profiles')
      .select(
        'id, email, first_name, last_name, role, department, designation, employee_id, is_active, phone_number, joining_date, created_at, status, dob, gender, personal_email, address, emergency_contact, employment_type, salary, experience, location, reporting_manager_id, office_location, operational_zone, approval_authority, escalation_chain'
      )
      .order('created_at', { ascending: false })
      .limit(300)
    if (error) throw error
    return { success: true, data: normalizeData(data || []) }
  } catch (error: any) {
    console.error('Directory Fetch Error:', error)
    return { success: false, error: error.message }
  }
}

export async function onboardEmployeeAction(
  data: OnboardFormData & {
    reporting_manager_id?: string | null
    department_head_id?: string | null
    escalation_chain?: string[]
    approval_authority?: boolean
    branch?: string
    office_location?: string
    operational_zone?: string
    profile_photo?: string
  },
  documents: any[] = []
) {
  try {
    const adminProfile: any = await getUserProfileAction()
    if (adminProfile?.role !== 'admin' && adminProfile?.role !== 'hr') {
      return { success: false, error: 'Unauthorized. Elevated privileges required.' }
    }

    const supabaseAdmin: any = createAdminClient()

    // Check email uniqueness
    const { data: existing } = await supabaseAdmin
      .from('profiles')
      .select('id')
      .eq('email', data.email.toLowerCase())
      .maybeSingle()
    if (existing) {
      return { success: false, error: `Employee work email ${data.email} is already in use.` }
    }

    // Generate employee ID
    let finalEmpId = data.employee_id
    if (!finalEmpId || finalEmpId === 'AUTO' || finalEmpId.trim() === '') {
      finalEmpId = await generateReadableEmployeeId(data.department)
    } else {
      const { data: empIdExists } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('employee_id', finalEmpId)
        .maybeSingle()
      if (empIdExists) {
        return { success: false, error: `Employee ID ${finalEmpId} is already in use.` }
      }
    }

    const isActive = ['active', 'probation', 'onboarding_pending', 'invited'].includes(data.status)

    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { first_name: data.first_name, last_name: data.last_name },
      // JWT claims for Edge middleware (no profiles round-trip)
      app_metadata: { role: data.role, is_active: isActive },
    })
    if (authError) return { success: false, error: authError.message }

    const userId = authUser.user.id

    // Insert or update profile (handles case where DB trigger is still active)
    const { error: profileError } = await (supabaseAdmin as any).from('profiles').upsert({
      id: userId,
      email: data.email,
      role: data.role,
      first_name: data.first_name,
      last_name: data.last_name,
      phone_number: data.phone_number || '',
      employee_id: finalEmpId,
      department: data.department,
      designation: data.designation,
      joining_date: data.joining_date,
      address: data.address || '',
      is_active: isActive,
      status: data.status || 'invited',
      dob: data.dob || null,
      gender: data.gender || 'male',
      personal_email: data.personal_email || '',
      emergency_contact: data.emergency_contact || '',
      employment_type: data.employment_type || 'full-time',
      salary: data.salary || 0,
      experience: data.experience || 0,
      location: data.location || 'office',
      force_password_reset: false,
      reporting_manager_id: data.reporting_manager_id || null,
      department_head_id: data.department_head_id || null,
      escalation_chain: data.escalation_chain || [],
      approval_authority: !!data.approval_authority,
      branch: data.branch || 'Malee House HQ',
      office_location: data.office_location || 'Singapore',
      operational_zone: data.operational_zone || 'Central Business District',
      profile_photo: data.profile_photo || null,
      documents: documents,
      created_at: new Date().toISOString(),
    } as any, { onConflict: 'id' })

    if (profileError) {
      // Rollback auth user
      await supabaseAdmin.auth.admin.deleteUser(userId)
      return { success: false, error: profileError.message }
    }

    await logAdminAuditAction({
      action: 'EMPLOYEE_PROVISIONED',
      details: { employee_id: finalEmpId, email: data.email, department: data.department },
      severity: 'critical',
      targetUserId: userId,
    })

    await createAuditLog({
      action: 'USER_CREATED',
      module: 'Users',
      entityType: 'User',
      entityId: userId,
      description: `Provisioned employee: ${data.first_name} ${data.last_name}`,
      newValue: { email: data.email, role: data.role, department: data.department },
    })

    await insertSystemNotification(
      userId,
      'Welcome to Malee House Software',
      'Your account has been created. Please complete onboarding.',
      'system'
    )

    if (data.reporting_manager_id) {
      await insertSystemNotification(
        data.reporting_manager_id,
        'New Direct Report Added',
        `Employee ${data.first_name} ${data.last_name} (${finalEmpId}) has been onboarded and reports to you.`,
        'system'
      )
    }

    revalidatePath('/admin/users')
    revalidatePath('/admin')
    return { success: true, data: { id: userId, email: data.email }, message: `Employee ${data.first_name} onboarded successfully.` }
  } catch (err: any) {
    console.error('Onboarding Failure:', err)
    return { success: false, error: err.message || 'Provisioning failed' }
  }
}

export async function updateEmployeeProfileAction(userId: string, updates: Partial<any>) {
  try {
    const adminProfile: any = await getUserProfileAction()
    if (adminProfile?.role !== 'admin' && adminProfile?.role !== 'hr') return { success: false, error: 'Unauthorized' }
    if (updates.role === 'developer') return { success: false, error: 'Cannot promote user to developer' }

    const supabaseAdmin: any = createAdminClient()
    let statusActive = updates.is_active
    if (updates.status) {
      statusActive = ['active', 'probation', 'onboarding_pending', 'invited'].includes(updates.status)
    }

    // Sanitize date fields — PostgreSQL rejects empty strings for DATE columns
    const DATE_FIELDS = ['dob', 'joining_date', 'temp_password_expires_at', 'deleted_at']
    for (const field of DATE_FIELDS) {
      if (field in updates && (updates[field] === '' || updates[field] === undefined)) {
        updates[field] = null
      }
    }

    // Get old value for audit
    const { data: oldProfile } = await supabaseAdmin.from('profiles').select('*').eq('id', userId).maybeSingle();

    const { data, error } = await (supabaseAdmin as any)
      .from('profiles')
      .update({ ...updates, is_active: statusActive, updated_at: new Date().toISOString() } as any)
      .eq('id', userId)
      .select()
      .maybeSingle()

    if (error) return { success: false, error: error.message }
    if (!data) return { success: false, error: "Profile not found or could not be updated." }

    // Sync email, user_metadata, and JWT claims (role/is_active) for Edge gateway
    const authUpdates: any = {};
    if (updates.email) authUpdates.email = updates.email;
    if (updates.first_name || updates.last_name) {
      authUpdates.user_metadata = { 
        first_name: updates.first_name || data.first_name, 
        last_name: updates.last_name || data.last_name 
      };
    }
    if (updates.role !== undefined || statusActive !== undefined) {
      authUpdates.app_metadata = {
        role: updates.role ?? data.role,
        is_active: statusActive ?? data.is_active,
      };
    }
    if (Object.keys(authUpdates).length > 0) {
      await supabaseAdmin.auth.admin.updateUserById(userId, authUpdates);
    }

    await logAdminAuditAction({
      action: 'EMPLOYEE_PROFILE_UPDATED',
      details: { fields_changed: Object.keys(updates) },
      severity: 'info',
      targetUserId: userId,
    })

    let actionName: any = 'USER_UPDATED';
    if (updates.is_active === false || updates.status === 'deactivated') {
      actionName = 'USER_DEACTIVATED';
    } else if (updates.role && oldProfile && updates.role !== oldProfile.role) {
      actionName = 'ROLE_CHANGED';
    }

    await createAuditLog({
      action: actionName,
      module: 'Users',
      entityType: 'User',
      entityId: userId,
      description: `Updated profile for user ${userId}`,
      oldValue: oldProfile,
      newValue: data,
    });

    await insertSystemNotification(
      userId,
      'Profile Information Updated',
      'Your employee record has been administratively updated. Contact HR if you did not request this.',
      'system'
    )

    revalidatePath('/admin/users')
    return { success: true, data: normalizeData(data) }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function resetEmployeePasswordAction(userId: string, newPassword: string) {
  try {
    const adminProfile: any = await getUserProfileAction()
    if (adminProfile?.role !== 'admin' && adminProfile?.role !== 'hr') return { success: false, error: 'Unauthorized' }
    if (!newPassword || newPassword.length < 6) return { success: false, error: 'Password must be at least 6 characters.' }

    const supabaseAdmin: any = createAdminClient()
    const { error } = await supabaseAdmin.auth.admin.updateUserById(userId, { password: newPassword })
    if (error) return { success: false, error: error.message }

    await logAdminAuditAction({
      action: 'EMPLOYEE_PASSWORD_RESET',
      details: { reset_by: adminProfile.email },
      severity: 'security',
      targetUserId: userId,
    })
    
    await createAuditLog({
      action: 'PASSWORD_RESET',
      module: 'Users',
      entityType: 'User',
      entityId: userId,
      description: 'Administrative password reset',
    })

    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function toggleUserActiveAction(userId: string, isActive: boolean) {
  try {
    const adminProfile: any = await getUserProfileAction()
    if (adminProfile?.role !== 'admin' && adminProfile?.role !== 'hr') return { success: false, error: 'Unauthorized' }

    const supabaseAdmin: any = createAdminClient()
    const { data: profile } = await (supabaseAdmin as any).from('profiles').select('email').eq('id', userId).maybeSingle()

    await supabaseAdmin
      .from('profiles')
      .update({ is_active: isActive, status: isActive ? 'active' : 'suspended', updated_at: new Date().toISOString() } as any)
      .eq('id', userId)

    // Keep JWT claims in sync for middleware (trigger also does this when migration applied)
    await supabaseAdmin.auth.admin.updateUserById(userId, {
      app_metadata: { is_active: isActive },
    }).catch(() => null)

    await logAdminAuditAction({
      action: isActive ? 'USER_ENABLED' : 'USER_SUSPENDED',
      details: { email: profile?.email },
      severity: isActive ? 'warning' : 'security',
      targetUserId: userId,
    })

    await insertSystemNotification(
      userId,
      isActive ? 'Account Access Restored' : 'Account Access Suspended',
      isActive ? 'Your account access has been restored.' : 'Your account access has been suspended by an Administrator.',
      'system'
    )

    revalidatePath('/admin/users')
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}


export async function updateUserRoleAction(userId: string, role: string) {
  try {
    const adminProfile: any = await getUserProfileAction()
    if (adminProfile?.role !== 'admin') return { success: false, error: 'Unauthorized' }
    if (role === 'developer') return { success: false, error: 'Cannot promote user to developer' }

    const supabaseAdmin: any = createAdminClient()
    const { data: existing } = await (supabaseAdmin as any).from('profiles').select('role, email').eq('id', userId).maybeSingle()

    await (supabaseAdmin as any).from('profiles').update({ role, updated_at: new Date().toISOString() } as any).eq('id', userId)

    await supabaseAdmin.auth.admin.updateUserById(userId, {
      app_metadata: { role },
    }).catch(() => null)

    await logAdminAuditAction({
      action: 'ROLE_PERMISSION_OVERRIDE',
      details: { old_role: existing?.role, new_role: role, email: existing?.email },
      severity: 'security',
      targetUserId: userId,
    })

    await insertSystemNotification(
      userId,
      'System Permission Altered',
      `Your system RBAC permissions have been updated from ${existing?.role} to ${role}.`,
      'system'
    )

    revalidatePath('/admin/users')
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function adminWipeSystemAction(confirmationString?: string) {
  try {
    // Hard-block in production unless explicitly opted in
    if (
      process.env.NODE_ENV === 'production' &&
      process.env.ALLOW_SYSTEM_WIPE !== 'true'
    ) {
      return {
        success: false,
        error: 'System wipe is disabled in production. Set ALLOW_SYSTEM_WIPE=true only in a controlled break-glass scenario.',
      }
    }

    const adminProfile: any = await getUserProfileAction()
    if (adminProfile?.role !== 'admin') return { success: false, error: 'Unauthorized' }

    if (!(await checkActionRateLimit(adminProfile.id, 'adminWipeSystemAction', 1, 60 * 60 * 1000))) {
      return { success: false, error: 'Rate limit exceeded. System wipe is highly restricted.' }
    }

    if (confirmationString !== 'I CONFIRM SYSTEM WIPE') {
      return { success: false, error: 'Invalid confirmation string. You must pass exactly "I CONFIRM SYSTEM WIPE" to execute this destructive action.' }
    }

    const supabaseAdmin: any = createAdminClient()
    await Promise.all([
      (supabaseAdmin as any).from('workflow_history').delete().neq('id', ''),
      (supabaseAdmin as any).from('comments').delete().neq('id', ''),
      (supabaseAdmin as any).from('activity_logs').delete().neq('id', ''),
      (supabaseAdmin as any).from('files').delete().neq('id', ''),
      (supabaseAdmin as any).from('notifications').delete().neq('id', ''),
      (supabaseAdmin as any).from('projects').delete().neq('id', ''),
    ])

    await logAdminAuditAction({
      action: 'PLATFORM_WIPE',
      details: { actor: adminProfile.email },
      severity: 'critical',
    })

    revalidatePath('/admin')
    return { success: true, message: 'Operational data purged successfully. Core profiles preserved.' }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

export async function getAdminAuditLogsAction() {
  try {
    const adminProfile: any = await getUserProfileAction()
    if (adminProfile?.role !== 'admin') return { success: false, error: 'Unauthorized' }

    const supabase: any = await createClient()
    const { data, error } = await supabase
      .from('activity_logs')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw error
    return { success: true, data: normalizeData(data || []) }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function offboardEmployeeAction(userId: string) {
  try {
    const adminProfile: any = await getUserProfileAction()
    if (adminProfile?.role !== 'admin' && adminProfile?.role !== 'hr') return { success: false, error: 'Unauthorized' }

    const supabaseAdmin: any = createAdminClient()
    const { data: profile } = await (supabaseAdmin as any).from('profiles').select('email, role').eq('id', userId).maybeSingle()

    if (profile?.role === 'developer') return { success: false, error: 'Cannot offboard developer account' }

    await supabaseAdmin
      .from('profiles')
      .update({ is_active: false, status: 'resigned', deleted_at: new Date().toISOString(), updated_at: new Date().toISOString() } as any)
      .eq('id', userId)

    await logAdminAuditAction({
      action: 'USER_OFFBOARDED',
      details: { email: profile?.email },
      severity: 'critical',
      targetUserId: userId,
    })

    await insertSystemNotification(userId, 'Account Offboarded', 'Your employee account has been administratively offboarded.', 'system')

    revalidatePath('/admin/users')
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function deleteEmployeeAction(userId: string) {
  try {
    const adminProfile: any = await getUserProfileAction()
    if (adminProfile?.role !== 'admin' && adminProfile?.role !== 'hr') return { success: false, error: 'Unauthorized' }

    const supabaseAdmin: any = createAdminClient()
    const { data: deletedUser } = await (supabaseAdmin as any).from('profiles').select('email, first_name, last_name, role').eq('id', userId).maybeSingle()

    if (deletedUser?.role === 'developer') return { success: false, error: 'Cannot delete developer account' }

    // Soft delete: We do NOT delete from auth.users or profiles. 
    // We update the profile to be terminated and inactive.
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ 
        is_active: false, 
        status: 'terminated', 
        deleted_at: new Date().toISOString(), 
        updated_at: new Date().toISOString() 
      } as any)
      .eq('id', userId)

    if (profileError) return { success: false, error: `Profile archiving failed: ${profileError.message}` }

    await logAdminAuditAction({
      action: 'USER_ARCHIVED_SOFT_DELETE',
      details: { email: deletedUser?.email, name: `${deletedUser?.first_name} ${deletedUser?.last_name}`, note: 'User was soft deleted' },
      severity: 'warning',
      targetUserId: userId,
    })

    revalidatePath('/admin/users')
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function addSalaryIncrementAction(employeeId: string, newSalary: number, effectiveDate?: string) {
  try {
    const profile: any = await getUserProfileAction()
    if (!profile || !['admin', 'hr'].includes(profile.role?.toLowerCase())) {
      return { success: false, error: 'Unauthorized' }
    }

    const supabaseAdmin: any = createAdminClient()
    
    // Fetch current profile
    const { data: emp, error: empError } = await supabaseAdmin
      .from('profiles')
      .select('salary, first_name, last_name, department, designation, employee_id, role')
      .eq('id', employeeId)
      .single()
      
    if (empError) throw new Error('Employee not found')
    if (emp.role === 'developer') return { success: false, error: 'Cannot modify developer salary' }
    
    const previousSalary = emp.salary || 0
    const incrementAmount = newSalary - previousSalary
    const incrementPercentage = previousSalary > 0 ? (incrementAmount / previousSalary) * 100 : 0
    
    // Use provided date or default to 1st of next month
    let effectiveDateStr: string
    if (effectiveDate) {
      effectiveDateStr = effectiveDate
    } else {
      const now = new Date()
      const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1)
      effectiveDateStr = nextMonth.toISOString().split('T')[0]
    }

    // Insert increment record (salary journey log)
    const { error: incError } = await supabaseAdmin.from('salary_increments').insert({
      employee_id: employeeId,
      previous_salary: previousSalary,
      new_salary: newSalary,
      increment_amount: incrementAmount,
      increment_percentage: incrementPercentage,
      effective_date: effectiveDateStr,
      created_by: profile.id
    })
    
    if (incError) {
      console.error('Error inserting salary increment:', incError)
      throw new Error('Failed to record increment')
    }

    // Update the profile salary to reflect the new value
    await supabaseAdmin
      .from('profiles')
      .update({ salary: newSalary })
      .eq('id', employeeId)
    
    await logAdminAuditAction({
      action: 'ADDED_SALARY_INCREMENT',
      details: {
        employee: `${emp.first_name} ${emp.last_name}`,
        employee_id: emp.employee_id,
        department: emp.department,
        designation: emp.designation,
        previousSalary,
        newSalary,
        incrementAmount,
        incrementPercentage: Math.round(incrementPercentage * 100) / 100,
        effectiveDate: effectiveDateStr,
        approved_by: profile.id
      },
      severity: 'info',
      targetUserId: employeeId
    })
    
    revalidatePath('/hr/employees')
    revalidatePath('/hr/payroll')
    
    return { success: true }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function getLastSalaryIncrementAction(employeeId: string) {
  try {
    const supabaseAdmin: any = createAdminClient()
    
    const profile: any = await getUserProfileAction()
    if (!profile || !['admin', 'hr'].includes(profile.role?.toLowerCase())) {
      return { success: false, error: 'Unauthorized' }
    }
    
    const { data, error } = await supabaseAdmin
      .from('salary_increments')
      .select('*')
      .eq('employee_id', employeeId)
      .order('effective_date', { ascending: false })
      .limit(1)
      .single()
      
    if (error && error.code !== 'PGRST116') {
      console.error('Error fetching last increment:', error)
      throw new Error('Failed to fetch last increment')
    }
    
    return { success: true, data: normalizeData(data) }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function getSalaryIncrementHistoryAction(employeeId: string) {
  try {
    const supabaseAdmin: any = createAdminClient()
    
    const profile: any = await getUserProfileAction()
    if (!profile || !['admin', 'hr'].includes(profile.role?.toLowerCase())) {
      return { success: false, error: 'Unauthorized' }
    }
    
    const { data, error } = await supabaseAdmin
      .from('salary_increments')
      .select('*')
      .eq('employee_id', employeeId)
      .order('effective_date', { ascending: false })
      
    if (error) {
      console.error('Error fetching increment history:', error)
      throw new Error('Failed to fetch increment history')
    }
    
    return { success: true, data: normalizeData(data) }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function getEmployeeHeavyDataAction(userId: string) {
  try {
    const profile: any = await getUserProfileAction()
    if (!profile || !['admin', 'hr', 'engineer', 'accountant'].includes(profile.role?.toLowerCase())) {
      return { success: false, error: 'Unauthorized' }
    }
    
    const supabaseAdmin: any = createAdminClient()
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('profile_photo, documents, role')
      .eq('id', userId)
      .maybeSingle()
      
    if (error) throw error
    if (data?.role === 'developer' && profile.role !== 'developer') return { success: false, error: 'Unauthorized' }

    return { success: true, data: normalizeData(data || {}) }
  } catch (error: any) {
    return { success: false, error: error.message }
  }
}

export async function getMilestonePaymentStatusAggregateAction() {
  try {
    const profile: any = await getUserProfileAction()
    if (!profile || !['admin', 'accountant'].includes(profile.role?.toLowerCase())) {
      return { success: false, error: 'Unauthorized' }
    }
    
    const supabaseAdmin: any = createAdminClient()
    
    // Fetch all active projects
    const { data: projects, error: projectsError } = await supabaseAdmin
      .from('projects')
      .select('id, status')
      .not('status', 'in', '("completed","archived")')
      .neq('id', 'PRJ-PRINT-DESK')
      
    if (projectsError) throw projectsError
    
    const activeProjectIds = projects?.map((p: any) => p.id) || []
    
    if (activeProjectIds.length === 0) {
      return { success: true, data: [] }
    }

    // Fetch all milestones for these active projects
    const { data: milestones, error: milestonesError } = await supabaseAdmin
      .from('project_milestones')
      .select('id, project_id, status, created_at')
      .in('project_id', activeProjectIds)
      .order('created_at', { ascending: true })
      
    if (milestonesError) throw milestonesError

    // Group and limit to 10 per project, then aggregate the pending statuses
    const milestoneCounts: Record<number, number> = {}
    const milestoneProjectIds: Record<number, string[]> = {}
    for (let i = 0; i < 10; i++) {
      milestoneCounts[i] = 0
      milestoneProjectIds[i] = []
    }
    
    const projectMilestoneMap: Record<string, any[]> = {}
    milestones?.forEach((m: any) => {
      if (!projectMilestoneMap[m.project_id]) {
        projectMilestoneMap[m.project_id] = []
      }
      projectMilestoneMap[m.project_id].push(m)
    })
    
    Object.values(projectMilestoneMap).forEach((projectMilestones) => {
      // Up to 10 milestones
      for (let i = 0; i < Math.min(10, projectMilestones.length); i++) {
        const milestone = projectMilestones[i]
        if (milestone.status === 'pending' || milestone.status === 'hold') {
          milestoneCounts[i]++
          milestoneProjectIds[i].push(milestone.project_id)
        }
      }
    })

    const result = []
    for (let i = 0; i < 10; i++) {
      const idx = i + 1
      const name = `${idx}${idx === 1 ? 'st' : idx === 2 ? 'nd' : idx === 3 ? 'rd' : 'th'} Milestone`
      result.push({
        name,
        value: milestoneCounts[i],
        projectIds: milestoneProjectIds[i]
      })
    }

    return { success: true, data: result }
  } catch (error: any) {
    console.error('Milestone Aggregate Error:', error)
    return { success: false, error: error.message }
  }
}

export async function getMonthlyProjectCreationTrendAction(selectedYear?: number) {
  try {
    const profile: any = await getUserProfileAction()
    if (!profile || !['admin', 'accountant', 'hr', 'engineer'].includes(profile.role?.toLowerCase())) {
      return { success: false, error: 'Unauthorized' }
    }

    const currentYear = selectedYear || new Date().getFullYear()
    const previousYear = currentYear - 1

    const startDate = new Date(Date.UTC(previousYear, 0, 1)).toISOString()
    const endDate = new Date(Date.UTC(currentYear + 1, 0, 1)).toISOString()

    const supabaseAdmin: any = createAdminClient()

    const { data: projects, error } = await supabaseAdmin
      .from('projects')
      .select('id, created_at')
      .neq('id', 'PRJ-PRINT-DESK')
      .gte('created_at', startDate)
      .lt('created_at', endDate)

    if (error) throw error

    const months = [
      { name: 'Jan', current: 0, previous: 0, changePercent: 0 },
      { name: 'Feb', current: 0, previous: 0, changePercent: 0 },
      { name: 'Mar', current: 0, previous: 0, changePercent: 0 },
      { name: 'Apr', current: 0, previous: 0, changePercent: 0 },
      { name: 'May', current: 0, previous: 0, changePercent: 0 },
      { name: 'Jun', current: 0, previous: 0, changePercent: 0 },
      { name: 'Jul', current: 0, previous: 0, changePercent: 0 },
      { name: 'Aug', current: 0, previous: 0, changePercent: 0 },
      { name: 'Sep', current: 0, previous: 0, changePercent: 0 },
      { name: 'Oct', current: 0, previous: 0, changePercent: 0 },
      { name: 'Nov', current: 0, previous: 0, changePercent: 0 },
      { name: 'Dec', current: 0, previous: 0, changePercent: 0 }
    ]

    let currentTotal = 0

    projects?.forEach((p: any) => {
      const date = new Date(p.created_at)
      const year = date.getFullYear()
      const month = date.getMonth()

      if (year === currentYear) {
        months[month].current += 1
        currentTotal += 1
      } else if (year === previousYear) {
        months[month].previous += 1
      }
    })

    let bestMonth = { name: 'Jan', count: -1 }
    let lowestMonth = { name: 'Jan', count: Infinity }

    months.forEach((m) => {
      if (m.previous === 0) {
        m.changePercent = m.current > 0 ? 100 : 0
      } else {
        m.changePercent = Math.round(((m.current - m.previous) / m.previous) * 100)
      }

      if (m.current > bestMonth.count) {
        bestMonth = { name: m.name, count: m.current }
      }
      if (m.current < lowestMonth.count) {
        lowestMonth = { name: m.name, count: m.current }
      }
    })

    if (lowestMonth.count === Infinity) lowestMonth.count = 0
    if (bestMonth.count === -1) bestMonth.count = 0

    const average = currentTotal > 0 ? Number((currentTotal / 12).toFixed(1)) : 0

    return {
      success: true,
      data: {
        currentYear,
        previousYear,
        months,
        summary: {
          total: currentTotal,
          bestMonth,
          average,
          lowestMonth
        }
      }
    }
  } catch (error: any) {
    console.error('Trend Aggregate Error:', error)
    return { success: false, error: error.message }
  }
}

export async function getMonthlyIncomeExpenseTrendAction(selectedYear?: number) {
  try {
    const profile: any = await getUserProfileAction()
    if (!profile || !['admin', 'accountant'].includes(profile.role?.toLowerCase())) {
      return { success: false, error: 'Unauthorized' }
    }

    const currentYear = selectedYear || new Date().getFullYear()

    const startDate = new Date(Date.UTC(currentYear, 0, 1)).toISOString()
    const endDate = new Date(Date.UTC(currentYear + 1, 0, 1)).toISOString()

    const supabaseAdmin: any = createAdminClient()

    const [paymentsRes, expensesRes, visitsRes] = await Promise.all([
      supabaseAdmin.from('payments').select('amount, payment_date, created_at').eq('status', 'verified').gte('created_at', startDate).lt('created_at', endDate),
      supabaseAdmin.from('expenses').select('amount, expense_date, created_at').not('status', 'eq', 'rejected').gte('created_at', startDate).lt('created_at', endDate),
      supabaseAdmin.from('project_visits').select('visit_cost, scheduled_date, created_at').gte('created_at', startDate).lt('created_at', endDate)
    ])

    if (paymentsRes.error) throw paymentsRes.error
    if (expensesRes.error) throw expensesRes.error
    if (visitsRes.error) throw visitsRes.error

    const months = [
      { name: 'Jan', income: 0, expense: 0 },
      { name: 'Feb', income: 0, expense: 0 },
      { name: 'Mar', income: 0, expense: 0 },
      { name: 'Apr', income: 0, expense: 0 },
      { name: 'May', income: 0, expense: 0 },
      { name: 'Jun', income: 0, expense: 0 },
      { name: 'Jul', income: 0, expense: 0 },
      { name: 'Aug', income: 0, expense: 0 },
      { name: 'Sep', income: 0, expense: 0 },
      { name: 'Oct', income: 0, expense: 0 },
      { name: 'Nov', income: 0, expense: 0 },
      { name: 'Dec', income: 0, expense: 0 }
    ]

    let totalIncome = 0
    let totalExpense = 0

    paymentsRes.data?.forEach((p: any) => {
      const date = new Date(p.payment_date || p.created_at)
      if (date.getFullYear() === currentYear) {
        const amt = Number(p.amount || 0)
        months[date.getMonth()].income += amt
        totalIncome += amt
      }
    })

    expensesRes.data?.forEach((e: any) => {
      const date = new Date(e.expense_date || e.created_at)
      if (date.getFullYear() === currentYear) {
        const amt = Number(e.amount || 0)
        months[date.getMonth()].expense += amt
        totalExpense += amt
      }
    })

    visitsRes.data?.forEach((v: any) => {
      const amt = Number(v.visit_cost || 0)
      if (amt > 0) {
        const date = new Date(v.scheduled_date || v.created_at)
        if (date.getFullYear() === currentYear) {
          months[date.getMonth()].expense += amt
          totalExpense += amt
        }
      }
    })

    const netProfit = totalIncome - totalExpense
    const profitMargin = totalIncome > 0 ? (netProfit / totalIncome) * 100 : 0

    return {
      success: true,
      data: {
        currentYear,
        months,
        summary: {
          totalIncome,
          totalExpense,
          netProfit,
          profitMargin
        }
      }
    }
  } catch (error: any) {
    console.error('Income Expense Trend Error:', error)
    return { success: false, error: error.message }
  }
}

export async function getAuditLogsAction(params: { search?: string, limit?: number, page?: number, pageSize?: number, module?: string, action?: string, timeRange?: string } = {}) {
  try {
    const profile = await getUserProfileAction();
    if (!profile || profile.role !== 'developer') {
      return { success: false, error: 'Unauthorized: Only developers can view audit logs' };
    }

    const supabaseAdmin: any = createAdminClient();
    
    let query = supabaseAdmin
      .from('audit_logs')
      .select('id, user_id, user_name, user_role, action, module, entity_type, entity_id, description, old_value, new_value, metadata, ip_address, user_agent, created_at, profiles(first_name, last_name, role)', { count: 'exact' });

    if (params.module) {
      query = query.eq('module', params.module);
    }
    
    if (params.action) {
      query = query.eq('action', params.action);
    }

    if (params.search) {
      query = query.or(`description.ilike.%${params.search}%,user_name.ilike.%${params.search}%`);
    }

    if (params.timeRange && params.timeRange !== 'all') {
      const now = new Date();
      let fromDate = new Date();
      switch (params.timeRange) {
        case '1h':
          fromDate.setHours(now.getHours() - 1);
          break;
        case '24h':
          fromDate.setHours(now.getHours() - 24);
          break;
        case '7d':
          fromDate.setDate(now.getDate() - 7);
          break;
        case '30d':
          fromDate.setDate(now.getDate() - 30);
          break;
        case '1y':
          fromDate.setFullYear(now.getFullYear() - 1);
          break;
      }
      query = query.gte('created_at', fromDate.toISOString());
    }

    const page = params.page || 1;
    const pageSize = params.pageSize || 50;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    query = query.order('created_at', { ascending: false }).range(from, to);

    const { data, count, error } = await query;

    if (error) throw error;

    const formattedData = (data || []).map((log: any) => ({
      id: log.id,
      userId: log.user_id,
      userName: (log.user_name && log.user_name !== 'Unknown User') ? log.user_name : (log.profiles ? `${log.profiles.first_name || ''} ${log.profiles.last_name || ''}`.trim() || 'System' : 'System'),
      userRole: log.user_role || (log.profiles ? log.profiles.role : 'system'),
      action: log.action,
      module: log.module,
      entityType: log.entity_type,
      entityId: log.entity_id,
      description: log.description,
      oldValue: log.old_value,
      newValue: log.new_value,
      metadata: log.metadata,
      ipAddress: log.ip_address,
      userAgent: log.user_agent,
      createdAt: log.created_at,
    }));

    return { 
      success: true, 
      data: {
        items: formattedData,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / pageSize)
      } 
    };
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function getErrorLogsAction(params: { page?: number, pageSize?: number, resolved?: boolean, severity?: string } = {}) {
  try {
    const profile = await getUserProfileAction();
    if (!profile || profile.role !== 'developer') return { success: false, error: 'Unauthorized' };

    const supabaseAdmin: any = createAdminClient();
    let query = supabaseAdmin.from('error_logs').select('*, profiles(first_name, last_name, role)', { count: 'exact' });

    if (params.resolved !== undefined) query = query.eq('resolved', params.resolved);
    if (params.severity) query = query.eq('severity', params.severity);

    const page = params.page || 1;
    const pageSize = params.pageSize || 50;
    query = query.order('created_at', { ascending: false }).range((page - 1) * pageSize, page * pageSize - 1);

    const { data, count, error } = await query;
    if (error) throw error;

    return { success: true, data: { items: data || [], totalPages: Math.ceil((count || 0) / pageSize) } };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function toggleErrorResolvedAction(id: string, resolved: boolean) {
  try {
    const profile = await getUserProfileAction();
    if (!profile || profile.role !== 'developer') return { success: false, error: 'Unauthorized' };

    const supabaseAdmin: any = createAdminClient();
    const { error } = await supabaseAdmin.from('error_logs').update({ resolved }).eq('id', id);
    if (error) throw error;
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}

export async function getPerformanceMetricsAction(params: { page?: number, pageSize?: number } = {}) {
  try {
    const profile = await getUserProfileAction();
    if (!profile || profile.role !== 'developer') return { success: false, error: 'Unauthorized' };

    const supabaseAdmin: any = createAdminClient();
    
    const page = params.page || 1;
    const pageSize = params.pageSize || 50;
    const { data: items, count, error: itemsErr } = await supabaseAdmin
      .from('performance_metrics')
      .select('*, profiles(first_name, last_name)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1);
      
    if (itemsErr) throw itemsErr;

    // For averages, we can compute them on the fly if needed
    const { data: allItems } = await supabaseAdmin.from('performance_metrics').select('duration_ms, path').order('created_at', { ascending: false }).limit(1000);
    let avgResponseTime = 0;
    const routeStats: Record<string, { total: number, count: number }> = {};
    if (allItems && allItems.length > 0) {
      avgResponseTime = Math.round(allItems.reduce((acc: number, item: any) => acc + item.duration_ms, 0) / allItems.length);
      allItems.forEach((item: any) => {
        if (!routeStats[item.path]) routeStats[item.path] = { total: 0, count: 0 };
        routeStats[item.path].total += item.duration_ms;
        routeStats[item.path].count++;
      });
    }

    const slowestRoutes = Object.entries(routeStats)
      .map(([path, stats]) => ({ path, avgDuration: Math.round(stats.total / stats.count) }))
      .sort((a, b) => b.avgDuration - a.avgDuration)
      .slice(0, 5);

    return { 
      success: true, 
      data: { 
        items: items || [], 
        totalPages: Math.ceil((count || 0) / pageSize),
        avgResponseTime,
        slowestRoutes
      } 
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
}
