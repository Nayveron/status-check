'use client'

import { useState, useCallback, useEffect, useMemo, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { claimCommitment, updateCommitment, updateCommitmentStatus } from '@/lib/actions'
import type { Commitment, Profile, Project, ProjectMember, Status } from '@/lib/types'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import CalendarView from './CalendarView'
import ExecutorDashboard from './ExecutorDashboard'
import AnalyticsDashboard from './AnalyticsDashboard'
import AdminPanel from './AdminPanel'
import DetailModal from './DetailModal'
import CommitmentModal from './CommitmentModal'

export type ViewMode = 'calendar' | 'tasks' | 'analytics' | 'admin'

interface Props {
  currentProfile: Profile
  initialCommitments: Commitment[]
  projects: Project[]
  profiles: Profile[]
  projectMembers: ProjectMember[]
}

const VIEW_TITLES: Record<ViewMode, string> = {
  calendar: 'Календар',
  tasks: 'Мої завдання',
  analytics: 'Аналітика',
  admin: 'Команда',
}

const realToday = new Date()

export default function AppShell({ currentProfile, initialCommitments, projects, profiles, projectMembers }: Props) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [, startTransition] = useTransition()

  const isAdmin = currentProfile.role === 'admin'

  const [commitments, setCommitments] = useState<Commitment[]>(initialCommitments)
  const [viewMode, setViewMode] = useState<ViewMode>(isAdmin ? 'calendar' : 'tasks')
  const [mockDate, setMockDate] = useState<Date | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [toast, setToast] = useState<string | null>(null)

  const [detailTarget, setDetailTarget] = useState<Commitment | null>(null)
  const [editTarget, setEditTarget] = useState<Commitment | null | 'new'>(null)
  const [newDeadline, setNewDeadline] = useState<string | undefined>(undefined)

  const effectiveToday = mockDate ?? realToday

  // projects the current user belongs to (for pool scoping + create form)
  const myProjectIds = useMemo(
    () => new Set(projectMembers.filter(m => m.profile_id === currentProfile.id).map(m => m.project_id)),
    [projectMembers, currentProfile.id]
  )

  // keep a live ref to compare incoming realtime rows against our last-known state
  const commitmentsRef = useRef<Commitment[]>(initialCommitments)
  useEffect(() => { commitmentsRef.current = commitments }, [commitments])

  // transient toast helper
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const showToast = useCallback((msg: string) => {
    setToast(msg)
    if (toastTimer.current) clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2800)
  }, [])

  // ── Realtime: live-sync commitments across all clients ──
  // map a raw DB row → Commitment, resolving names from the loaded projects/profiles
  const mapRow = useCallback((r: Record<string, any>): Commitment => {
    const proj = projects.find(p => p.id === r.project_id)
    const author = profiles.find(p => p.id === r.author_id)
    const exec = profiles.find(p => p.id === r.executor_id)
    const check = profiles.find(p => p.id === r.checker_id)
    return {
      id: r.id,
      title: r.title,
      description: r.description ?? '',
      status: r.status,
      project_id: r.project_id ?? null,
      project_name: proj?.name ?? null,
      author_id: r.author_id ?? null,
      author_name: author?.name ?? null,
      executor_id: r.executor_id ?? null,
      executor_name: exec?.name ?? null,
      checker_id: r.checker_id ?? null,
      checker_name: check?.name ?? null,
      deadline: r.deadline,
      deadline_time: r.deadline_time ?? null,
      created_at: r.created_at,
      updated_at: r.updated_at ?? r.created_at,
    }
  }, [projects, profiles])

  useEffect(() => {
    const channel = supabase
      .channel('commitments-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'commitments' }, payload => {
        if (payload.eventType === 'DELETE') {
          const id = (payload.old as { id?: string })?.id
          if (!id) return
          setCommitments(prev => prev.filter(c => c.id !== id))
          setDetailTarget(d => (d && d.id === id ? null : d))
          return
        }
        const row = mapRow(payload.new as Record<string, any>)
        // notify on relevant status transitions (compared against our last-known copy)
        const prev = commitmentsRef.current.find(c => c.id === row.id)
        if (prev && prev.status !== row.status) {
          if (row.status === 'to_check' && isAdmin && row.checker_id === currentProfile.id)
            showToast(`📥 Новий коміт на перевірці: «${row.title}»`)
          else if (row.status === 'in_progress' && row.executor_id === currentProfile.id
                   && (prev.status === 'to_check' || prev.status === 'expired'))
            showToast(`↩️ Повернуто на доопрацювання: «${row.title}»`)
        }
        setCommitments(cur => {
          const idx = cur.findIndex(c => c.id === row.id)
          if (idx >= 0) { const copy = [...cur]; copy[idx] = row; return copy }
          return [...cur, row]
        })
        setDetailTarget(d => (d && d.id === row.id ? row : d))
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [supabase, mapRow, isAdmin, currentProfile.id, showToast])

  // sweep overdue to_check → expired on load (Realtime delivers the flips)
  useEffect(() => {
    supabase.rpc('expire_overdue_commitments')
  }, [supabase])

  // counts for sidebar badges
  const myActiveCount = commitments.filter(c =>
    c.executor_id === currentProfile.id && (c.status === 'assigned' || c.status === 'in_progress')
  ).length
  const toCheckCount = commitments.filter(c => c.status === 'to_check' || c.status === 'expired').length

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push('/auth')
  }

  const handleStatusChange = useCallback((id: string, status: Status) => {
    const prevStatus = commitmentsRef.current.find(c => c.id === id)?.status
    const now = new Date().toISOString()
    setCommitments(prev => prev.map(c => c.id === id ? { ...c, status, updated_at: now } : c))
    setDetailTarget(d => (d && d.id === id ? { ...d, status, updated_at: now } : d))
    startTransition(async () => {
      const res = await updateCommitmentStatus(id, status)
      if (res.error && prevStatus) {
        // server rejected — revert optimistic change and tell the user
        setCommitments(prev => prev.map(c => c.id === id ? { ...c, status: prevStatus } : c))
        setDetailTarget(d => (d && d.id === id ? { ...d, status: prevStatus } : d))
        showToast('Не вдалося змінити статус — спробуй ще раз')
      }
    })
  }, [showToast])

  // executor claims a task from the shared pool → atomic; only one winner.
  const handleClaim = useCallback((id: string) => {
    const now = new Date().toISOString()
    // optimistic claim
    setCommitments(prev => prev.map(c => c.id === id
      ? { ...c, status: 'in_progress', executor_id: currentProfile.id, executor_name: currentProfile.name, updated_at: now }
      : c))
    startTransition(async () => {
      const res = await claimCommitment(id, currentProfile.id)
      if (!res.claimed) {
        // someone else won the race — Realtime will deliver the true owner and correct the card
        showToast('Цю задачу вже взяв інший виконавець')
      }
    })
  }, [currentProfile, showToast])

  const handleSaved = useCallback((c: Commitment) => {
    setCommitments(prev => {
      const idx = prev.findIndex(x => x.id === c.id)
      if (idx >= 0) { const copy = [...prev]; copy[idx] = c; return copy }
      return [...prev, c]
    })
    setEditTarget(null)
    setDetailTarget(d => (d && d.id === c.id ? c : d))
  }, [])

  const handleDeleted = useCallback((id: string) => {
    setCommitments(prev => prev.filter(c => c.id !== id))
    setDetailTarget(null)
  }, [])

  // Checker returns a commit to the executor → back to 'in_progress', optional reason appended
  const handleReturn = useCallback((c: Commitment, reason: string) => {
    const trimmed = reason.trim()
    const note = trimmed
      ? `${(c.description || '').trim()}${c.description ? '\n\n' : ''}↩️ Повернуто на доопрацювання: ${trimmed}`
      : c.description
    const now = new Date().toISOString()
    setCommitments(prev => prev.map(x => x.id === c.id ? { ...x, status: 'in_progress', description: note, updated_at: now } : x))
    setDetailTarget(null)
    startTransition(async () => {
      const res = await updateCommitment(c.id, { status: 'in_progress', description: note })
      if (res.error) {
        setCommitments(prev => prev.map(x => x.id === c.id ? c : x))  // restore original
        showToast('Не вдалося повернути завдання — спробуй ще раз')
      }
    })
  }, [showToast])

  const openNew = useCallback((deadline?: string) => {
    setNewDeadline(deadline)
    setEditTarget('new')
  }, [])

  return (
    <div className="sc-shell">
      <Sidebar
        currentProfile={currentProfile}
        viewMode={viewMode}
        onViewChange={setViewMode}
        myActiveCount={myActiveCount}
        toCheckCount={toCheckCount}
      />

      <div className="sc-main">
        <Topbar
          title={VIEW_TITLES[viewMode]}
          showSearch={viewMode === 'calendar' || viewMode === 'tasks'}
          searchQuery={searchQuery}
          onSearch={setSearchQuery}
          currentProfile={currentProfile}
          mockDate={mockDate}
          realToday={realToday}
          onMockDate={setMockDate}
          onSignOut={handleSignOut}
        />

        <div className="sc-content sc-view-anim" key={viewMode}>
          {viewMode === 'calendar' && (
            <CalendarView
              currentProfile={currentProfile}
              commitments={commitments}
              projects={projects}
              profiles={profiles}
              effectiveToday={effectiveToday}
              mockActive={!!mockDate}
              searchQuery={searchQuery}
              onStatusChange={handleStatusChange}
              onCardClick={setDetailTarget}
            />
          )}

          {viewMode === 'tasks' && (
            <ExecutorDashboard
              currentProfile={currentProfile}
              commitments={commitments}
              projects={projects}
              profiles={profiles}
              effectiveToday={effectiveToday}
              searchQuery={searchQuery}
              myProjectIds={myProjectIds}
              onStatusChange={handleStatusChange}
              onClaim={handleClaim}
              onCardClick={setDetailTarget}
              onAddNew={() => openNew()}
              onSaved={handleSaved}
            />
          )}

          {viewMode === 'analytics' && isAdmin && (
            <AnalyticsDashboard
              commitments={commitments}
              projects={projects}
              profiles={profiles}
              effectiveToday={effectiveToday}
            />
          )}

          {viewMode === 'admin' && isAdmin && (
            <AdminPanel
              currentProfile={currentProfile}
              profiles={profiles}
              projects={projects}
              projectMembers={projectMembers}
              commitments={commitments}
              onCardClick={setDetailTarget}
            />
          )}
        </div>
      </div>

      {/* Shared modals */}
      {detailTarget && (
        <DetailModal
          commitment={detailTarget}
          isAdmin={isAdmin}
          onClose={() => setDetailTarget(null)}
          onEdit={c => { setDetailTarget(null); setEditTarget(c) }}
          onDelete={handleDeleted}
          onStatusChange={handleStatusChange}
          onReturn={handleReturn}
        />
      )}

      {editTarget !== null && (
        <CommitmentModal
          commitment={editTarget === 'new' ? null : editTarget}
          currentProfile={currentProfile}
          projects={projects}
          profiles={profiles}
          myProjectIds={myProjectIds}
          defaultDeadline={newDeadline}
          onClose={() => { setEditTarget(null); setNewDeadline(undefined) }}
          onSaved={handleSaved}
        />
      )}

      {toast && <div className="sc-toast">{toast}</div>}
    </div>
  )
}
