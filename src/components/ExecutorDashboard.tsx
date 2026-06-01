'use client'

import { useState } from 'react'
import { Plus, Send, X } from 'lucide-react'
import { EXECUTOR_COLS, STATUS_CONFIG } from '@/lib/constants'
import { updateCommitment } from '@/lib/actions'
import type { Commitment, Profile, Project, Status } from '@/lib/types'
import Avatar from './Avatar'

interface Props {
  currentProfile: Profile
  commitments: Commitment[]
  projects: Project[]
  profiles: Profile[]
  effectiveToday: Date
  searchQuery?: string
  myProjectIds: Set<string>
  onStatusChange: (id: string, status: Status) => void
  onClaim: (id: string) => void
  onCardClick: (c: Commitment) => void
  onAddNew: () => void
  onSaved: (c: Commitment) => void
}

// forward-only pipeline: assigned → in_progress → to_check
const ORDER: Record<string, number> = { assigned: 0, in_progress: 1, to_check: 2 }
const canMove = (from: Status, to: Status) => (ORDER[to] ?? 99) > (ORDER[from] ?? -1)

const toISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const dateOnly = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

export default function ExecutorDashboard({
  currentProfile, commitments, profiles, effectiveToday, searchQuery = '', myProjectIds,
  onStatusChange, onClaim, onCardClick, onAddNew, onSaved,
}: Props) {
  const [drag, setDrag] = useState<{ id: string; status: Status } | null>(null)
  const [dragOverCol, setDragOverCol] = useState<Status | null>(null)
  const [submitTarget, setSubmitTarget] = useState<Commitment | null>(null)

  const q = searchQuery.trim().toLowerCase()
  const match = (c: Commitment) => !q || c.title.toLowerCase().includes(q)
  // pool/team scoping: I only see tasks of projects I belong to (+ tasks with no project)
  const inMyProjects = (c: Commitment) => c.project_id === null || myProjectIds.has(c.project_id)

  // "Нові" = shared pool of MY projects. "В процесі" = team within my projects.
  // "На перевірці" = personal (only my submissions).
  const poolAssigned   = commitments.filter(c => c.status === 'assigned' && inMyProjects(c) && match(c))
  const teamInProgress = commitments.filter(c => c.status === 'in_progress' && inMyProjects(c) && match(c))
  const myToCheck      = commitments.filter(c => c.status === 'to_check' && c.executor_id === currentProfile.id && match(c))
  const colCards = (status: Status) =>
    status === 'assigned' ? poolAssigned : status === 'in_progress' ? teamInProgress : myToCheck

  const myInProgressCount = teamInProgress.filter(c => c.executor_id === currentProfile.id).length

  // a card is draggable if: it's an unclaimed pool task (anyone can claim) OR my own in-progress task
  const canDrag = (c: Commitment) =>
    c.status === 'assigned' || (c.status === 'in_progress' && c.executor_id === currentProfile.id)

  const handleDragStart = (e: React.DragEvent, c: Commitment) => {
    setDrag({ id: c.id, status: c.status })
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', c.id)
  }
  const handleDragEnd = () => { setDrag(null); setDragOverCol(null) }

  const handleDragOver = (e: React.DragEvent, target: Status) => {
    // only a valid drop target if moving forward
    if (!drag || !canMove(drag.status, target)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverCol(target)
  }

  const handleDrop = (e: React.DragEvent, target: Status) => {
    e.preventDefault()
    const d = drag
    setDrag(null); setDragOverCol(null)
    if (!d || !canMove(d.status, target)) return
    const card = commitments.find(c => c.id === d.id)
    if (!card) return
    if (target === 'to_check') {
      setSubmitTarget(card)            // open submission form (also claims if still unclaimed)
    } else if (target === 'in_progress') {
      onClaim(card.id)                 // claim from the shared pool → becomes mine
    }
  }

  const fmtDeadline = (iso: string, time: string | null) => {
    const d = new Date(iso + 'T00:00:00')
    const str = d.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })
    return time ? `${str} · ${time.slice(0, 5)}` : str
  }
  const isOverdue = (iso: string) => dateOnly(new Date(iso + 'T00:00:00')) < dateOnly(effectiveToday)

  return (
    <div className="sc-exec-board">
      <div className="sc-exec-header">
        <div>
          <div className="sc-exec-title">Дошка завдань</div>
          <div className="sc-exec-sub">
            {poolAssigned.length} у спільному пулі · {teamInProgress.length} в роботі (команда, {myInProgressCount} моїх) · {myToCheck.length} моїх на перевірці
          </div>
        </div>
        <button className="sc-add-btn" onClick={onAddNew}>
          <Plus size={14} /> Нове завдання
        </button>
      </div>

      <div className="sc-exec-kanban">
        {EXECUTOR_COLS.map(col => {
          const cards = colCards(col.status)
          const isOver = dragOverCol === col.status
          const cfg = STATUS_CONFIG[col.status]
          return (
            <div
              key={col.status}
              className={`sc-exec-col ${isOver ? 'drag-over' : ''} ${col.readOnly ? 'read-only' : ''}`}
              onDragOver={e => handleDragOver(e, col.status)}
              onDragLeave={() => setDragOverCol(null)}
              onDrop={e => handleDrop(e, col.status)}
            >
              <div className="sc-exec-col-head" style={{ borderColor: cfg.border }}>
                <span className="sc-exec-col-title" style={{ color: cfg.fg }}>{col.label}</span>
                <span className="sc-exec-col-count" style={{ background: cfg.bg, color: cfg.fg }}>{cards.length}</span>
                {col.status === 'assigned' && <span className="sc-exec-col-hint">спільний пул</span>}
                {col.readOnly && <span className="sc-exec-col-hint">перетягни сюди щоб відправити</span>}
              </div>

              <div className="sc-exec-cards">
                {cards.length === 0 ? (
                  <div className="sc-exec-empty">{col.readOnly ? '↑ Відправлені завдання' : '—'}</div>
                ) : (
                  cards.map(c => (
                    <ExecCard
                      key={c.id}
                      commitment={c}
                      draggable={canDrag(c)}
                      isMine={c.executor_id === currentProfile.id}
                      isDragging={drag?.id === c.id}
                      isOverdue={isOverdue(c.deadline)}
                      onDragStart={e => handleDragStart(e, c)}
                      onDragEnd={handleDragEnd}
                      onClick={() => onCardClick(c)}
                      fmtDeadline={fmtDeadline}
                    />
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>

      {submitTarget && (
        <SubmitForm
          commitment={submitTarget}
          currentProfile={currentProfile}
          profiles={profiles}
          effectiveToday={effectiveToday}
          onCancel={() => setSubmitTarget(null)}
          onDone={(updated) => { onSaved(updated); setSubmitTarget(null) }}
          fmtDeadline={fmtDeadline}
        />
      )}
    </div>
  )
}

/* ── Kanban card (varies by status) ── */
interface CardProps {
  commitment: Commitment
  draggable: boolean
  isMine: boolean
  isDragging: boolean
  isOverdue: boolean
  onDragStart: (e: React.DragEvent) => void
  onDragEnd: () => void
  onClick: () => void
  fmtDeadline: (iso: string, time: string | null) => string
}

function ExecCard({ commitment: c, draggable, isMine, isDragging, isOverdue, onDragStart, onDragEnd, onClick, fmtDeadline }: CardProps) {
  const cfg = STATUS_CONFIG[c.status]
  return (
    <div
      className={`sc-exec-card ${isDragging ? 'dragging' : ''} ${draggable ? '' : 'no-drag'} ${isMine && c.status === 'in_progress' ? 'mine' : ''}`}
      style={{ borderLeftColor: cfg.border }}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
    >
      <div className="sc-exec-card-title">{c.title}</div>
      {c.description && <div className="sc-exec-card-desc">{c.description}</div>}

      <div className="sc-exec-card-footer">
        <span className={`sc-exec-deadline ${isOverdue ? 'overdue' : ''}`}>
          {fmtDeadline(c.deadline, c.deadline_time)}
        </span>
        {c.project_name && <span className="sc-exec-project">{c.project_name}</span>}
      </div>

      {/* in_progress → show the team member who took it (highlight if it's me); to_check → checker */}
      {c.status === 'in_progress' && c.executor_name && (
        <div className="sc-exec-card-person">
          <Avatar name={c.executor_name} size={18} /> {c.executor_name}{isMine ? ' (ти)' : ''}
        </div>
      )}
      {c.status === 'to_check' && c.checker_name && (
        <div className="sc-exec-card-person muted">→ Перевіряє: {c.checker_name}</div>
      )}
    </div>
  )
}

/* ── Submission form (drag → "На перевірці") ── */
interface SubmitProps {
  commitment: Commitment
  currentProfile: Profile
  profiles: Profile[]
  effectiveToday: Date
  onCancel: () => void
  onDone: (updated: Commitment) => void
  fmtDeadline: (iso: string, time: string | null) => string
}

function SubmitForm({ commitment: c, currentProfile, profiles, effectiveToday, onCancel, onDone }: SubmitProps) {
  const admins = profiles.filter(p => p.role === 'admin')
  const now = new Date()
  const nowTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  const [description, setDescription] = useState(c.description ?? '')
  const [date, setDate] = useState(toISO(effectiveToday))
  const [time, setTime] = useState(nowTime)
  const [checkerId, setCheckerId] = useState(c.checker_id ?? admins[0]?.id ?? '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const willExpire = dateOnly(new Date(date + 'T00:00:00')) < dateOnly(effectiveToday)
  const newStatus: Status = willExpire ? 'expired' : 'to_check'

  const handleSubmit = async () => {
    setLoading(true); setError('')
    const res = await updateCommitment(c.id, {
      description: description.trim(),
      deadline: date,
      deadline_time: time,
      checker_id: checkerId,
      executor_id: currentProfile.id,   // claim on submit (covers pool → to_check directly)
      status: newStatus,
    })
    setLoading(false)
    if (res.error) { setError(res.error); return }

    const checker = admins.find(p => p.id === checkerId)
    onDone({
      ...c,
      description: description.trim(),
      deadline: date,
      deadline_time: time || null,
      checker_id: checkerId || null,
      checker_name: checker?.name ?? null,
      executor_id: currentProfile.id,
      executor_name: currentProfile.name,
      status: newStatus,
      updated_at: new Date().toISOString(),
    })
  }

  return (
    <div className="sc-overlay" onClick={onCancel}>
      <div className="sc-modal" style={{ maxWidth: 460 }} onClick={e => e.stopPropagation()}>
        <div className="sc-modal-header">
          <div className="sc-modal-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Send size={18} color="#8b6fc9" /> Відправити на перевірку
          </div>
          <button className="sc-modal-close" onClick={onCancel}><X size={18} /></button>
        </div>
        <div className="sc-modal-body">
          {error && <div style={{ color: '#c0344f', fontSize: 13, marginBottom: 12, background: '#fdecef', padding: '8px 12px', borderRadius: 6 }}>{error}</div>}

          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>{c.title}</div>

          <div className="sc-field">
            <label className="sc-label">Опис / коментар до перевірки</label>
            <textarea className="sc-textarea" placeholder="Що саме перевірити, посилання, нюанси…"
              value={description} onChange={e => setDescription(e.target.value)} />
          </div>

          <div className="sc-row">
            <div className="sc-field">
              <label className="sc-label">Дата</label>
              <input className="sc-input" type="date" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div className="sc-field">
              <label className="sc-label">Час</label>
              <input className="sc-input" type="time" value={time} onChange={e => setTime(e.target.value)} />
            </div>
          </div>

          <div className="sc-field">
            <label className="sc-label">Перевіряючий</label>
            <select className="sc-select" value={checkerId} onChange={e => setCheckerId(e.target.value)}>
              <option value="">— оберіть перевіряючого —</option>
              {admins.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>

          {willExpire ? (
            <div style={{ background: '#ffe1e1', color: '#991b1b', borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: 13, marginBottom: 16 }}>
              ⚠️ Обрана дата вже минула — завдання отримає статус <strong>Expired</strong>
            </div>
          ) : (
            <div style={{ background: 'var(--accent-light)', color: 'var(--accent-hover)', borderRadius: 'var(--radius-sm)', padding: '10px 14px', fontSize: 13, marginBottom: 16 }}>
              ✓ Завдання отримає статус <strong>To Check</strong> і з’явиться у календарі перевіряючого
            </div>
          )}

          <div className="sc-modal-actions">
            <button className="sc-btn sc-btn-secondary" onClick={onCancel}>Скасувати</button>
            <button className="sc-btn sc-btn-primary" disabled={loading} onClick={handleSubmit}>
              <Send size={14} /> {loading ? 'Відправляємо…' : 'Відправити'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
