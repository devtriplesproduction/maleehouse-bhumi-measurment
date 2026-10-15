'use server'

import { revalidatePath } from 'next/cache'
import { getUserProfileAction } from '@/actions/auth.actions'
import { Role, verifyProjectAccess } from '@/lib/permissions/permissions'
import { createClient } from '@/lib/supabase/server'
import { checkActionRateLimit } from '@/lib/rate-limit'

export type CommentType = 'general' | 'review' | 'rejection' | 'internal'

interface ActionResult {
  success: boolean
  error?: string
  data?: any
}

export async function addProjectCommentAction(
  projectId: string,
  content: string,
  type: CommentType = 'general',
  parentCommentId?: string
): Promise<ActionResult> {
  if (!projectId || typeof projectId !== 'string') return { success: false, error: 'Invalid project ID.' }
  const trimmed = content?.trim()
  if (!trimmed || trimmed.length === 0) return { success: false, error: 'Comment cannot be empty.' }
  if (trimmed.length > 5000) return { success: false, error: 'Comment exceeds 5,000 character limit.' }

  const validTypes: CommentType[] = ['general', 'review', 'rejection', 'internal']
  if (!validTypes.includes(type)) return { success: false, error: 'Invalid comment type.' }

  try {
    const profile: any = await getUserProfileAction()
    if (!profile) return { success: false, error: 'Unauthorized. Please log in.' }

    if (!(await checkActionRateLimit(profile.id, 'addProjectCommentAction', 15, 60 * 1000))) {
      return { success: false, error: 'Rate limit exceeded for this action. Please try again later.' };
    }

    const role = profile.role as Role
    const accessCheck = await verifyProjectAccess(projectId, profile.id, role, true)
    if (!accessCheck.isAllowed) return { success: false, error: accessCheck.error || 'Access denied.' }

    if (type === 'internal') {
      const privilegedRoles: Role[] = ['admin', 'engineer']
      if (!privilegedRoles.includes(role)) {
        return { success: false, error: 'Only admins and engineers can post internal notes.' }
      }
    }

    const supabase: any = await createClient()

    // Verify project existence
    const { data: project } = await supabase
      .from('projects')
      .select('id, name')
      .eq('id', projectId)
      .is('deleted_at', null)
      .single()

    if (!project) return { success: false, error: 'Project not found.' }

    const commentId = `cmt-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`
    const { data: newComment, error } = await supabase.from('comments').insert({
      id: commentId,
      project_id: projectId,
      user_id: profile.id,
      content: trimmed,
      comment_type: type,
      created_at: new Date().toISOString(),
    }).select().single()

    if (error) return { success: false, error: error.message }

    // Parse @mentions and send notifications
    const authorName = `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email
    const textLower = trimmed.toLowerCase()

    const mentionedUserIds = new Set<string>()

    if (textLower.includes('@')) {
      const singleWordMatches = textLower.match(/@([a-z0-9._-]+)/g) || []
      const searchTerms = Array.from(new Set(singleWordMatches.map(m => m.slice(1).trim()))).filter(t => t.length > 1)

      if (searchTerms.length > 0) {
        const orConditions = searchTerms.map(term => 
          `first_name.ilike.%${term}%,last_name.ilike.%${term}%,email.ilike.%${term}%`
        ).join(',')

        const { data: matchedProfiles } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, email')
          .eq('is_active', true)
          .or(orConditions)

        for (const p of matchedProfiles || []) {
          if (p.id === profile.id) continue
          const fullName = `${p.first_name || ''} ${p.last_name || ''}`.trim()
          const firstName = p.first_name?.trim()
          const lastName = p.last_name?.trim()
          const email = p.email?.trim()
          const emailUser = email ? email.split('@')[0] : ''
          if ((fullName && textLower.includes(`@${fullName.toLowerCase()}`)) ||
              (firstName && textLower.includes(`@${firstName.toLowerCase()}`)) ||
              (lastName && textLower.includes(`@${lastName.toLowerCase()}`)) ||
              (email && textLower.includes(`@${email.toLowerCase()}`)) ||
              (emailUser && textLower.includes(`@${emailUser.toLowerCase()}`))) {
            mentionedUserIds.add(p.id)
          }
        }
      }
    }

    if (mentionedUserIds.size > 0) {
      const { notifyMentionAction } = await import('@/actions/notification.actions')
      notifyMentionAction(authorName, Array.from(mentionedUserIds), projectId, trimmed).catch(console.error)
    }

    revalidatePath(`/projects/${projectId}`)
    revalidatePath('/admin')
    return { success: true, data: { ...newComment, author_profile: profile } }
  } catch (err: any) {
    console.error('addProjectCommentAction error:', err)
    return { success: false, error: err.message || 'Failed to add comment.' }
  }
}

export async function editProjectCommentAction(
  commentId: string,
  projectId: string,
  content: string
): Promise<ActionResult> {
  const trimmed = content?.trim()
  if (!trimmed || trimmed.length === 0) return { success: false, error: 'Comment cannot be empty.' }

  try {
    const profile: any = await getUserProfileAction()
    if (!profile) return { success: false, error: 'Unauthorized. Please log in.' }

    const supabase: any = await createClient()
    const { data: existingComment } = await supabase
      .from('comments')
      .select('user_id, deleted_at')
      .eq('id', commentId)
      .single()

    if (!existingComment) return { success: false, error: 'Comment not found.' }
    if (existingComment.deleted_at) return { success: false, error: 'Cannot edit a deleted comment.' }

    const isAuthor = existingComment.user_id === profile.id
    const isAdmin = profile.role === 'admin'
    if (!isAuthor && !isAdmin) return { success: false, error: 'Only the author or an admin can edit comments.' }

    const { error } = await supabase
      .from('comments')
      .update({ content: trimmed, updated_at: new Date().toISOString() })
      .eq('id', commentId)

    if (error) return { success: false, error: error.message }

    revalidatePath(`/projects/${projectId}`)
    return { success: true }
  } catch (err: any) {
    console.error('editProjectCommentAction error:', err)
    return { success: false, error: err.message || 'Failed to edit comment.' }
  }
}

export async function deleteProjectCommentAction(commentId: string, projectId: string): Promise<ActionResult> {
  try {
    const profile: any = await getUserProfileAction()
    if (!profile) return { success: false, error: 'Unauthorized. Please log in.' }

    const supabase: any = await createClient()
    const { data: existingComment } = await supabase
      .from('comments')
      .select('user_id')
      .eq('id', commentId)
      .single()

    if (!existingComment) return { success: false, error: 'Comment not found.' }

    const isAuthor = existingComment.user_id === profile.id
    const isAdmin = profile.role === 'admin'
    if (!isAuthor && !isAdmin) return { success: false, error: 'Only the author or an admin can delete comments.' }

    const { error } = await supabase
      .from('comments')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', commentId)

    if (error) return { success: false, error: error.message }

    revalidatePath(`/projects/${projectId}`)
    return { success: true }
  } catch (err: any) {
    console.error('deleteProjectCommentAction error:', err)
    return { success: false, error: err.message || 'Failed to delete comment.' }
  }
}
