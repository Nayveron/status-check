export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/components/AppShell'
import type { Commitment, Profile, Project, ProjectMember } from '@/lib/types'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth')

  const [profileRes, commitmentsRes, projectsRes, profilesRes, membersRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('commitments').select(`
      id, title, description, status, deadline, deadline_time, created_at, updated_at,
      project_id,  projects(name),
      author_id,   author:profiles!commitments_author_id_fkey(name),
      executor_id, executor:profiles!commitments_executor_id_fkey(name),
      checker_id,  checker:profiles!commitments_checker_id_fkey(name)
    `).order('deadline', { ascending: true }),
    supabase.from('projects').select('id, name, description, deadline').order('name'),
    supabase.from('profiles').select('id, name, initials, color, role, is_super').order('name'),
    supabase.from('project_members').select('project_id, profile_id'),
  ])

  if (!profileRes.data) redirect('/auth')

  const commitments: Commitment[] = (commitmentsRes.data ?? []).map((r: any) => ({
    id: r.id,
    title: r.title,
    description: r.description ?? '',
    status: r.status,
    project_id: r.project_id,
    project_name: r.projects?.name ?? null,
    author_id: r.author_id,
    author_name: r.author?.name ?? null,
    executor_id: r.executor_id,
    executor_name: r.executor?.name ?? null,
    checker_id: r.checker_id,
    checker_name: r.checker?.name ?? null,
    deadline: r.deadline,
    deadline_time: r.deadline_time ?? null,
    created_at: r.created_at,
    updated_at: r.updated_at ?? r.created_at,
  }))

  return (
    <AppShell
      currentProfile={profileRes.data as Profile}
      initialCommitments={commitments}
      projects={projectsRes.data as Project[] ?? []}
      profiles={profilesRes.data as Profile[] ?? []}
      projectMembers={membersRes.data as ProjectMember[] ?? []}
    />
  )
}
