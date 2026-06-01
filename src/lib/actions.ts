'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from './supabase/server'
import type { CommitmentFormData, Status } from './types'

export async function createCommitment(data: CommitmentFormData & { author_id: string }) {
  const supabase = await createClient()
  const { error } = await supabase.from('commitments').insert({
    title: data.title,
    description: data.description,
    status: data.status,
    project_id: data.project_id || null,
    author_id: data.author_id,
    executor_id: data.executor_id || null,
    checker_id: data.checker_id || null,
    deadline: data.deadline,
    deadline_time: data.deadline_time || null,
  })
  if (error) return { error: error.message }
  revalidatePath('/dashboard')
  return { error: null }
}

export async function updateCommitment(id: string, data: Partial<CommitmentFormData>) {
  const supabase = await createClient()
  const { error } = await supabase.from('commitments').update({
    ...(data.title !== undefined      && { title: data.title }),
    ...(data.description !== undefined && { description: data.description }),
    ...(data.status !== undefined     && { status: data.status }),
    ...(data.project_id !== undefined && { project_id: data.project_id || null }),
    ...(data.executor_id !== undefined && { executor_id: data.executor_id || null }),
    ...(data.checker_id !== undefined  && { checker_id: data.checker_id || null }),
    ...(data.deadline !== undefined   && { deadline: data.deadline }),
    ...(data.deadline_time !== undefined && { deadline_time: data.deadline_time || null }),
  }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard')
  return { error: null }
}

// Atomic claim: only succeeds if the task is still unowned (executor_id IS NULL).
// Prevents two executors from grabbing the same pool task.
export async function claimCommitment(id: string, executorId: string) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('commitments')
    .update({ status: 'in_progress', executor_id: executorId })
    .eq('id', id)
    .is('executor_id', null)
    .select('id')
  if (error) return { claimed: false, error: error.message }
  revalidatePath('/dashboard')
  return { claimed: !!data && data.length > 0, error: null }
}

export async function updateCommitmentStatus(id: string, status: Status) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('commitments')
    .update({ status })
    .eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard')
  return { error: null }
}

export async function deleteCommitment(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('commitments').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard')
  return { error: null }
}

// ── Admin: team & projects management (RLS allows only admins) ──
export async function setUserRole(userId: string, role: 'admin' | 'user') {
  const supabase = await createClient()
  const { error } = await supabase.from('profiles').update({ role }).eq('id', userId)
  if (error) return { error: error.message }
  revalidatePath('/dashboard')
  return { error: null }
}

export async function createProject(name: string, deadline?: string, description?: string) {
  const supabase = await createClient()
  const trimmed = name.trim()
  if (!trimmed) return { error: 'Порожня назва' }
  const { error } = await supabase.from('projects').insert({
    name: trimmed,
    deadline: deadline || null,
    description: description?.trim() || '',
  })
  if (error) return { error: error.message }
  revalidatePath('/dashboard')
  return { error: null }
}

export async function updateProject(id: string, data: { name?: string; deadline?: string | null; description?: string }) {
  const supabase = await createClient()
  const { error } = await supabase.from('projects').update({
    ...(data.name !== undefined && { name: data.name.trim() }),
    ...(data.deadline !== undefined && { deadline: data.deadline || null }),
    ...(data.description !== undefined && { description: data.description }),
  }).eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard')
  return { error: null }
}

export async function deleteProject(id: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('projects').delete().eq('id', id)
  if (error) return { error: error.message }
  revalidatePath('/dashboard')
  return { error: null }
}

export async function addProjectMember(projectId: string, profileId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('project_members').insert({ project_id: projectId, profile_id: profileId })
  if (error) return { error: error.message }
  revalidatePath('/dashboard')
  return { error: null }
}

export async function removeProjectMember(projectId: string, profileId: string) {
  const supabase = await createClient()
  const { error } = await supabase.from('project_members')
    .delete().eq('project_id', projectId).eq('profile_id', profileId)
  if (error) return { error: error.message }
  revalidatePath('/dashboard')
  return { error: null }
}
