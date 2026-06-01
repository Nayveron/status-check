'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { STATUS_CONFIG, STATUS_ORDER } from '@/lib/constants'
import { createCommitment, updateCommitment } from '@/lib/actions'
import type { Commitment, CommitmentFormData, Profile, Project } from '@/lib/types'

interface Props {
  commitment: Commitment | null  // null = create new
  currentProfile: Profile
  projects: Project[]
  profiles: Profile[]
  myProjectIds: Set<string>
  defaultDeadline?: string
  onClose: () => void
  onSaved: (c: Commitment) => void
}

export default function CommitmentModal({
  commitment, currentProfile, projects, profiles, myProjectIds, defaultDeadline, onClose, onSaved,
}: Props) {
  const isNew = !commitment
  const isAdmin = currentProfile.role === 'admin'

  // executors can only file tasks under projects they belong to (so they'll see them in their pool)
  const availableProjects = isAdmin ? projects : projects.filter(p => myProjectIds.has(p.id))

  const today = new Date().toISOString().split('T')[0]
  const defaultStatus = isNew ? (isAdmin ? 'to_check' : 'assigned') : commitment?.status ?? 'assigned'
  // executor-created tasks go to the SHARED pool (no owner) until someone claims them
  const defaultExecutor = commitment?.executor_id ?? ''

  const [form, setForm] = useState<CommitmentFormData>({
    title:        commitment?.title ?? '',
    description:  commitment?.description ?? '',
    status:       defaultStatus,
    project_id:   commitment?.project_id ?? (availableProjects[0]?.id ?? ''),
    executor_id:  defaultExecutor,
    checker_id:   commitment?.checker_id ?? (isAdmin ? currentProfile.id : ''),
    deadline:     commitment?.deadline ?? defaultDeadline ?? today,
    deadline_time: commitment?.deadline_time ?? '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const set = (k: keyof CommitmentFormData, v: string) => setForm(p => ({ ...p, [k]: v }))
  const canSave = form.title.trim() && form.deadline

  const handleSave = async () => {
    setLoading(true); setError('')
    let result: { error: string | null }

    if (isNew) {
      result = await createCommitment({ ...form, author_id: currentProfile.id })
    } else {
      result = await updateCommitment(commitment.id, form)
    }

    setLoading(false)
    if (result.error) { setError(result.error); return }

    // Optimistic UI: build a local Commitment object to pass back
    const projName = projects.find(p => p.id === form.project_id)?.name ?? null
    const execProfile = profiles.find(p => p.id === form.executor_id)
    const checkProfile = profiles.find(p => p.id === form.checker_id)
    const authorProfile = isNew ? currentProfile : profiles.find(p => p.id === commitment.author_id) ?? currentProfile

    const saved: Commitment = {
      id: commitment?.id ?? `temp-${Date.now()}`,
      title: form.title.trim(),
      description: form.description.trim(),
      status: form.status,
      project_id: form.project_id || null,
      project_name: projName,
      author_id: authorProfile.id,
      author_name: authorProfile.name,
      executor_id: form.executor_id || null,
      executor_name: execProfile?.name ?? null,
      checker_id: form.checker_id || null,
      checker_name: checkProfile?.name ?? null,
      deadline: form.deadline,
      deadline_time: form.deadline_time || null,
      created_at: commitment?.created_at ?? new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }
    onSaved(saved)
    onClose()
  }

  return (
    <div className="sc-overlay" onClick={onClose}>
      <div className="sc-modal" onClick={e => e.stopPropagation()}>
        <div className="sc-modal-header">
          <div className="sc-modal-title">{isNew ? 'Новий комітмент' : 'Редагувати'}</div>
          <button className="sc-modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="sc-modal-body">
          {error && <div style={{ color: '#dc2626', fontSize: 13, marginBottom: 12, background: '#fef2f2', padding: '8px 12px', borderRadius: 6 }}>{error}</div>}

          <div className="sc-field">
            <label className="sc-label">Назва</label>
            <input className="sc-input" placeholder="Що потрібно перевірити?"
              value={form.title} onChange={e => set('title', e.target.value)} />
          </div>
          <div className="sc-field">
            <label className="sc-label">Опис</label>
            <textarea className="sc-textarea" placeholder="Деталі…"
              value={form.description} onChange={e => set('description', e.target.value)} />
          </div>

          <div className="sc-row">
            <div className="sc-field">
              <label className="sc-label">Проєкт</label>
              <select className="sc-select" value={form.project_id} onChange={e => set('project_id', e.target.value)}>
                <option value="">— без проєкту —</option>
                {availableProjects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            {isAdmin && (
              <div className="sc-field">
                <label className="sc-label">Статус</label>
                <select className="sc-select" value={form.status} onChange={e => set('status', e.target.value as any)}>
                  {STATUS_ORDER.map(k => <option key={k} value={k}>{STATUS_CONFIG[k].label}</option>)}
                </select>
              </div>
            )}
          </div>

          {isAdmin ? (
            <div className="sc-row">
              <div className="sc-field">
                <label className="sc-label">Виконавець</label>
                <select className="sc-select" value={form.executor_id} onChange={e => set('executor_id', e.target.value)}>
                  <option value="">— не призначено —</option>
                  {profiles.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
              <div className="sc-field">
                <label className="sc-label">Перевіряє</label>
                <select className="sc-select" value={form.checker_id} onChange={e => set('checker_id', e.target.value)}>
                  <option value="">— не призначено —</option>
                  {profiles.filter(p => p.role === 'admin').map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
            </div>
          ) : (
            <div className="sc-field">
              <div style={{ fontSize: 12, color: 'var(--text-muted)', background: 'var(--surface-2)', padding: '9px 12px', borderRadius: 'var(--radius-sm)', lineHeight: 1.5 }}>
                Завдання потрапить у <strong>спільний пул «Нові»</strong> — будь-який виконавець може взяти його в роботу.
                Перевіряючого обереш пізніше, коли відправлятимеш на перевірку.
              </div>
            </div>
          )}

          <div className="sc-row">
            <div className="sc-field">
              <label className="sc-label">Дедлайн (дата)</label>
              <input className="sc-input" type="date" value={form.deadline} onChange={e => set('deadline', e.target.value)} />
            </div>
            <div className="sc-field">
              <label className="sc-label">Час (опціонально)</label>
              <input className="sc-input" type="time" value={form.deadline_time} onChange={e => set('deadline_time', e.target.value)} />
            </div>
          </div>

          <div className="sc-modal-actions">
            <button className="sc-btn sc-btn-secondary" onClick={onClose}>Скасувати</button>
            <button className="sc-btn sc-btn-primary" disabled={!canSave || loading} onClick={handleSave}>
              {loading ? 'Збереження…' : isNew ? 'Створити' : 'Зберегти'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
