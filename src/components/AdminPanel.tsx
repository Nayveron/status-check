'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle, CheckCircle2, FolderOpen, ListChecks, Plus, ShieldCheck,
  Trash2, User, Users, X,
} from 'lucide-react'
import {
  addProjectMember, createProject, deleteProject, removeProjectMember, setUserRole, updateProject,
} from '@/lib/actions'
import { STATUS_CONFIG, STATUS_ORDER } from '@/lib/constants'
import type { Commitment, Profile, Project, ProjectMember } from '@/lib/types'
import Avatar from './Avatar'
import Dropdown from './Dropdown'

interface Props {
  currentProfile: Profile
  profiles: Profile[]
  projects: Project[]
  projectMembers: ProjectMember[]
  commitments: Commitment[]
  onCardClick: (c: Commitment) => void
}

export default function AdminPanel({ currentProfile, profiles, projects, projectMembers, commitments, onCardClick }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  const [newProject, setNewProject] = useState('')
  const [newDeadline, setNewDeadline] = useState('')
  const [tasksProject, setTasksProject] = useState<Project | null>(null)
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'user'>('all')

  const isSuper = !!currentProfile.is_super
  const adminCount = profiles.filter(p => p.role === 'admin').length
  const executors = profiles.filter(p => p.role === 'user')

  // super first, then checkers, then executors; filtered by the role chips
  const roleRank = (p: Profile) => (p.is_super ? 0 : p.role === 'admin' ? 1 : 2)
  const teamList = [...profiles]
    .filter(p => roleFilter === 'all' || p.role === roleFilter)
    .sort((a, b) => roleRank(a) - roleRank(b) || a.name.localeCompare(b.name))
  const profileById = (id: string) => profiles.find(p => p.id === id)

  // overdue projects first, then by soonest deadline, then no-deadline, then by name
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const sortedProjects = [...projects].sort((a, b) => {
    if (a.deadline && b.deadline) return a.deadline.localeCompare(b.deadline)
    if (a.deadline) return -1
    if (b.deadline) return 1
    return a.name.localeCompare(b.name)
  })

  const run = (fn: () => Promise<{ error: string | null }>) => {
    setError('')
    startTransition(async () => {
      const res = await fn()
      if (res.error) { setError(res.error); return }
      router.refresh()
    })
  }

  const changeRole = (p: Profile, role: 'admin' | 'user') => {
    if (p.role === role) return
    if (p.is_super) {
      setError('Не можна змінити роль супер-перевіряючого.')
      return
    }
    // regular checkers may manage executors only — touching other checkers needs super
    if (!isSuper && p.role === 'admin') {
      setError('Змінювати перевіряючих може лише супер-перевіряючий.')
      return
    }
    if (role === 'user' && p.role === 'admin' && adminCount <= 1) {
      setError('Не можна зняти роль з останнього перевіряючого.')
      return
    }
    setBusyId(p.id)
    startTransition(async () => {
      const res = await setUserRole(p.id, role)
      setBusyId(null)
      if (res.error) { setError(res.error); return }
      router.refresh()
    })
  }

  const addProject = () => {
    if (!newProject.trim()) return
    run(async () => {
      const r = await createProject(newProject, newDeadline || undefined)
      if (!r.error) { setNewProject(''); setNewDeadline('') }
      return r
    })
  }

  const fmtDeadline = (iso: string | null) =>
    iso ? new Date(iso + 'T00:00:00').toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' }) : null
  const daysLeft = (iso: string) => {
    const d = new Date(iso + 'T00:00:00'); const t = new Date(); t.setHours(0, 0, 0, 0)
    return Math.round((d.getTime() - t.getTime()) / 86400000)
  }
  // workload per executor = their active tasks (in work / awaiting check)
  const loadOf = (id: string) =>
    commitments.filter(c => c.executor_id === id && (c.status === 'in_progress' || c.status === 'to_check')).length
  const projectsOf = (id: string) => projectMembers.filter(m => m.profile_id === id).length

  return (
    <div className="sc-admin">
      {error && <div className="sc-auth-error" style={{ maxWidth: 760 }}>{error}</div>}

      {/* Team / roles */}
      <div className="sc-admin-card">
        <div className="sc-admin-card-head">
          <Users size={18} color="#8b6fc9" />
          <div style={{ flex: 1 }}>
            <div className="sc-admin-card-title">Команда</div>
            <div className="sc-admin-card-sub">
              {isSuper ? 'Признач, хто перевіряючий, а хто виконавець' : 'Виконавців призначаєш ти; перевіряючих змінює лише супер'}
            </div>
          </div>
          <div className="sc-seg">
            <button className={`sc-seg-btn ${roleFilter === 'all' ? 'active' : ''}`} onClick={() => setRoleFilter('all')}>Усі</button>
            <button className={`sc-seg-btn ${roleFilter === 'admin' ? 'active' : ''}`} onClick={() => setRoleFilter('admin')}>Перевіряючі</button>
            <button className={`sc-seg-btn ${roleFilter === 'user' ? 'active' : ''}`} onClick={() => setRoleFilter('user')}>Виконавці</button>
          </div>
        </div>
        <div className="sc-admin-list">
          {teamList.map(p => {
            const isMe = p.id === currentProfile.id
            const busy = busyId === p.id
            // super row never editable in UI; regular admin can't touch other checkers
            const locked = p.is_super || (!isSuper && p.role === 'admin')
            return (
              <div key={p.id} className="sc-admin-row">
                <Avatar color={p.color} initials={p.initials} name={p.name} size={38} />
                <div className="sc-admin-row-info">
                  <div className="sc-admin-row-name">
                    {p.name}
                    {p.is_super && <span className="sc-super-star" title="Супер-перевіряючий">★</span>}
                    {isMe && <span className="sc-admin-you">(ти)</span>}
                  </div>
                  <div className="sc-admin-row-meta">
                    {p.is_super ? 'супер-перевіряючий' : p.role === 'admin' ? 'перевіряючий' : `${projectsOf(p.id)} проєкт. · ${loadOf(p.id)} в роботі`}
                  </div>
                </div>
                <div className={`sc-seg ${busy ? 'busy' : ''}`}>
                  <button className={`sc-seg-btn ${p.role === 'user' ? 'active' : ''}`} disabled={pending || locked} onClick={() => changeRole(p, 'user')}>
                    <User size={13} /> Виконавець
                  </button>
                  <button className={`sc-seg-btn ${p.role === 'admin' ? 'active' : ''}`} disabled={pending || locked} onClick={() => changeRole(p, 'admin')}>
                    <ShieldCheck size={13} /> Перевіряючий
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Projects */}
      <div className="sc-admin-card">
        <div className="sc-admin-card-head">
          <FolderOpen size={18} color="#8b6fc9" />
          <div>
            <div className="sc-admin-card-title">Проєкти</div>
            <div className="sc-admin-card-sub">Дедлайни, опис та хто закріплений. Пул завдань бачать лише учасники проєкту.</div>
          </div>
        </div>

        <div className="sc-admin-add">
          <input className="sc-input" placeholder="Назва нового проєкту…"
            value={newProject} onChange={e => setNewProject(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addProject()} />
          <input className="sc-input" type="date" style={{ maxWidth: 170 }}
            value={newDeadline} onChange={e => setNewDeadline(e.target.value)} title="Дедлайн проєкту (необов'язково)" />
          <button className="sc-add-btn" disabled={pending || !newProject.trim()} onClick={addProject}>
            <Plus size={15} /> Додати
          </button>
        </div>

        <div className="sc-proj-grid">
          {projects.length === 0 && <span className="sc-admin-sub-empty">Поки немає проєктів</span>}
          {sortedProjects.map(pr => {
            const memberIds = projectMembers.filter(m => m.project_id === pr.id).map(m => m.profile_id)
            const candidates = executors.filter(e => !memberIds.includes(e.id))
            const tasks = commitments.filter(c => c.project_id === pr.id)
            const cnt = {
              total: tasks.length,
              assigned: tasks.filter(c => c.status === 'assigned').length,
              in_progress: tasks.filter(c => c.status === 'in_progress').length,
              to_check: tasks.filter(c => c.status === 'to_check').length,
              done: tasks.filter(c => c.status === 'done').length,
              expired: tasks.filter(c => c.status === 'expired').length,
            }
            const progress = cnt.total ? Math.round((cnt.done / cnt.total) * 100) : 0
            const dl = pr.deadline ? daysLeft(pr.deadline) : null
            return (
              <div key={pr.id} className="sc-proj-card">
                <div className="sc-proj-head">
                  <button className="sc-proj-name-btn" onClick={() => setTasksProject(pr)} title="Переглянути завдання проєкту">
                    {pr.name}
                  </button>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="sc-admin-chip-x" disabled={tasks.length === 0} title="Завдання проєкту"
                      onClick={() => setTasksProject(pr)}>
                      <ListChecks size={12} />
                    </button>
                    <button className="sc-admin-chip-x" disabled={pending} title="Видалити проєкт"
                      onClick={() => run(() => deleteProject(pr.id))}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>

                {/* task stats */}
                <div className="sc-proj-stats">
                  <span className="sc-proj-stat" title="Усього">{cnt.total} завд.</span>
                  {cnt.assigned > 0 && <span className="sc-proj-stat" style={{ color: STATUS_CONFIG.assigned.border }}>{cnt.assigned} нові</span>}
                  {cnt.in_progress > 0 && <span className="sc-proj-stat" style={{ color: STATUS_CONFIG.in_progress.border }}>{cnt.in_progress} в роботі</span>}
                  {cnt.to_check > 0 && <span className="sc-proj-stat" style={{ color: STATUS_CONFIG.to_check.border }}>{cnt.to_check} перевірка</span>}
                  {cnt.expired > 0 && <span className="sc-proj-stat" style={{ color: STATUS_CONFIG.expired.border }}><AlertTriangle size={11} /> {cnt.expired}</span>}
                </div>
                <div className="sc-proj-progress" title={`${cnt.done}/${cnt.total} виконано`}>
                  <div className="sc-proj-progress-bar" style={{ width: `${progress}%` }} />
                </div>
                <div className="sc-proj-progress-label"><CheckCircle2 size={11} /> {progress}% виконано</div>

                <label className="sc-proj-label">Дедлайн проєкту</label>
                <input className="sc-input" type="date" defaultValue={pr.deadline ?? ''}
                  onChange={e => run(() => updateProject(pr.id, { deadline: e.target.value || null }))} />
                {pr.deadline && (
                  <div className={`sc-proj-deadline-hint ${dl !== null && dl < 0 ? 'overdue' : ''}`}>
                    {dl !== null && dl < 0 ? `прострочено на ${-dl} дн.` : dl === 0 ? 'дедлайн сьогодні' : `за ${dl} дн. · ${fmtDeadline(pr.deadline)}`}
                  </div>
                )}

                <label className="sc-proj-label">Опис</label>
                <input className="sc-input" placeholder="Короткий опис проєкту…" defaultValue={pr.description ?? ''}
                  onBlur={e => { if ((e.target.value) !== (pr.description ?? '')) run(() => updateProject(pr.id, { description: e.target.value })) }} />

                <label className="sc-proj-label">Учасники ({memberIds.length})</label>
                <div className="sc-proj-members">
                  {memberIds.length === 0 && <span className="sc-admin-sub-empty">Нікого не закріплено</span>}
                  {memberIds.map(id => {
                    const m = profileById(id)
                    if (!m) return null
                    return (
                      <span key={id} className="sc-proj-member">
                        <Avatar color={m.color} initials={m.initials} name={m.name} size={22} />
                        {m.name}
                        <button className="sc-proj-member-x" disabled={pending} title="Прибрати"
                          onClick={() => run(() => removeProjectMember(pr.id, id))}>
                          <X size={11} />
                        </button>
                      </span>
                    )
                  })}
                </div>
                {candidates.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <Dropdown
                      value=""
                      placeholder="+ Закріпити виконавця"
                      options={[
                        { value: '', label: '+ Закріпити виконавця' },
                        ...candidates.map(c => ({ value: c.id, label: c.name, color: c.color })),
                      ]}
                      onChange={id => { if (id) run(() => addProjectMember(pr.id, id)) }}
                      minWidth={200}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Project tasks modal */}
      {tasksProject && (
        <ProjectTasksModal
          project={tasksProject}
          commitments={commitments.filter(c => c.project_id === tasksProject.id)}
          onClose={() => setTasksProject(null)}
          onPick={c => { setTasksProject(null); onCardClick(c) }}
        />
      )}
    </div>
  )
}

/* ── Project tasks modal ── */
function ProjectTasksModal({
  project, commitments, onClose, onPick,
}: {
  project: Project
  commitments: Commitment[]
  onClose: () => void
  onPick: (c: Commitment) => void
}) {
  const fmt = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })
  return (
    <div className="sc-overlay" onClick={onClose}>
      <div className="sc-modal" onClick={e => e.stopPropagation()}>
        <div className="sc-modal-header">
          <div className="sc-modal-title">Завдання · {project.name}</div>
          <button className="sc-modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="sc-modal-body">
          {commitments.length === 0 && <div className="sc-admin-sub-empty">У проєкті ще немає завдань</div>}
          {STATUS_ORDER.filter(s => commitments.some(c => c.status === s)).map(s => {
            const cfg = STATUS_CONFIG[s]
            const list = commitments.filter(c => c.status === s)
            return (
              <div key={s} style={{ marginBottom: 14 }}>
                <div className="sc-detail-label" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                  <span className="sc-stat-chip-dot" style={{ background: cfg.border, width: 9, height: 9, boxShadow: 'none' }} />
                  {cfg.label} · {list.length}
                </div>
                {list.map(c => (
                  <button key={c.id} className="sc-proj-task-row" onClick={() => onPick(c)}>
                    <span className="sc-proj-task-bar" style={{ background: cfg.border }} />
                    <span className="sc-proj-task-title">{c.title}</span>
                    {c.executor_name && <Avatar name={c.executor_name} size={20} />}
                    <span className="sc-proj-task-date">{fmt(c.deadline)}</span>
                  </button>
                ))}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
