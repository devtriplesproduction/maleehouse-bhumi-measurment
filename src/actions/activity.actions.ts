'use server'

import { createClient } from '@/lib/supabase/server'

export type ActivityType = 'stage_change' | 'file_upload' | 'assignment' | 'comment'

export interface GlobalActivityItem {
  id: string
  type: ActivityType
  timestamp: string
  actor: { name: string; role: string }
  project: { id: string; name: string }
  details: {
    from?: string
    to?: string
    fileName?: string
    category?: string
    commentType?: string
    content?: string
  }
}

export async function getGlobalActivityAction(): Promise<GlobalActivityItem[]> {
  try {
    const supabase: any = await createClient()

    const [stageRes, fileRes, assignRes, commentRes, profileRes] = await Promise.all([
      supabase.from('workflow_history').select('*, profiles!changed_by(first_name, last_name, role)').order('created_at', { ascending: false }).limit(50),
      supabase.from('files').select('*, profiles!uploaded_by(first_name, last_name, role)').order('uploaded_at', { ascending: false }).limit(50),
      supabase.from('project_assignments').select('*, profiles!user_id(first_name, last_name, role)').order('assigned_at', { ascending: false }).limit(50),
      supabase.from('comments').select('*, profiles!user_id(first_name, last_name, role)').is('deleted_at', null).order('created_at', { ascending: false }).limit(50),
      supabase.from('projects').select('id, name').neq('id', 'PRJ-PRINT-DESK'),
    ])

    const projects: any[] = (profileRes.data as any[]) || []
    const getProjectName = (id: string) => projects.find((p: any) => p.id === id)?.name || 'Unknown Project'
    const getName = (profile: any) => profile ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'System' : 'System'

    const activities: GlobalActivityItem[] = []

    ;((stageRes.data as any[]) || []).forEach((item: any) => {
      const profile = item.profiles
      activities.push({
        id: `stage-${item.id}`,
        type: 'stage_change',
        timestamp: item.created_at,
        actor: { name: getName(profile), role: profile?.role || 'admin' },
        project: { id: item.project_id, name: getProjectName(item.project_id) },
        details: { from: item.from_stage, to: item.to_stage },
      })
    })

    ;((fileRes.data as any[]) || []).forEach((item: any) => {
      const profile = item.profiles
      activities.push({
        id: `file-${item.id}`,
        type: 'file_upload',
        timestamp: item.uploaded_at,
        actor: { name: getName(profile), role: profile?.role || 'admin' },
        project: { id: item.project_id, name: getProjectName(item.project_id) },
        details: { fileName: item.file_name, category: item.category },
      })
    })

    ;((assignRes.data as any[]) || []).forEach((item: any) => {
      const profile = item.profiles
      activities.push({
        id: `assign-${item.id}`,
        type: 'assignment',
        timestamp: item.assigned_at,
        actor: { name: getName(profile), role: profile?.role || 'admin' },
        project: { id: item.project_id, name: getProjectName(item.project_id) },
        details: { category: item.role },
      })
    })

    ;((commentRes.data as any[]) || []).forEach((item: any) => {
      const profile = item.profiles
      activities.push({
        id: `comment-${item.id}`,
        type: 'comment',
        timestamp: item.created_at,
        actor: { name: getName(profile), role: profile?.role || 'admin' },
        project: { id: item.project_id, name: getProjectName(item.project_id) },
        details: { commentType: item.comment_type, content: item.content },
      })
    })

    return activities
      .sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 50)
  } catch (error) {
    console.error('Error in getGlobalActivityAction:', error)
    return []
  }
}
