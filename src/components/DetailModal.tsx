'use client'

import { useEffect, useState } from 'react'
import { History, Pencil, RotateCcw, Trash2, X } from 'lucide-react'
import { CHECKER_STATUSES, STATUS_CONFIG } from '@/lib/constants'
import { deleteCommitment } from '@/lib/actions'
import { createClient } from '@/lib/supabase/client'
import type { Commitment, CommitmentEvent, Status } from '@/lib/types'

interface Props {
  commitment: Commitment
  isAdmin: boolean
  onClose: () => void
  onEdit: (c: Commitment) => void
  onDelete: (id: string) => void
  onStatusChange: (id: string, status: Status) => void
  onReturn?: (c: Commitment, reason: string) => void
}

const fmtDate = (iso: string) => {
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' })
}
const fmtDateTime = (iso: string) => {
  const d = new Date(iso)
  return d.toLocaleString('uk-UA', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function MetaItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="sc-detail-label">{label}</div>
      <div className="sc-detail-value">{value}</div>
    </div>
  )
}

export default function DetailModal({ commitment: c, isAdmin, onClose, onEdit, onDelete, onStatusChange, onReturn }: Props) {
  const s = STATUS_CONFIG[c.status]
  const Icon = s.icon

  const [returnOpen, setReturnOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [events, setEvents] = useState<CommitmentEvent[] | null>(null)

  // load activity history for this commitment
  useEffect(() => {
    let active = true
    const supabase = createClient()
    supabase
      .from('commitment_events')
      .select('id, type, from_status, to_status, created_at, actor:profiles(name)')
      .eq('commitment_id', c.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        if (!active) return
        setEvents((data ?? []).map((e: any) => ({
          id: e.id,
          type: e.type,
          from_status: e.from_status,
          to_status: e.to_status,
          created_at: e.created_at,
          actor_name: e.actor?.name ?? null,
        })))
      })
    return () => { active = false }
  }, [c.id, c.updated_at])

  // checker can return a commit that's awaiting check (or already expired) back to the executor.
  // requires an assigned executor — otherwise the commit would land in nobody's board.
  const canReturn = isAdmin && !!onReturn && !!c.executor_id && (c.status === 'to_check' || c.status === 'expired')

  const handleDelete = async () => {
    onDelete(c.id)
    onClose()
    await deleteCommitment(c.id)
  }

  return (
    <div className="sc-overlay" onClick={onClose}>
      <div className="sc-modal" onClick={e => e.stopPropagation()}>
        <div className="sc-modal-header">
          <div className="sc-modal-title">{c.title}</div>
          <button className="sc-modal-close" onClick={onClose}><X size={18} /></button>
        </div>
        <div className="sc-modal-body">
          <span className="sc-detail-status" style={{ background: s.bg, color: s.fg }}>
            <Icon size={14} /> {s.label}
          </span>

          {c.description && <div className="sc-detail-desc">{c.description}</div>}

          <div className="sc-detail-meta">
            <MetaItem label="Проєкт" value={c.project_name ?? '—'} />
            <MetaItem label="Дедлайн" value={
              <span style={{ fontFamily: 'var(--mono)' }}>
                {fmtDate(c.deadline)}{c.deadline_time ? ` · ${c.deadline_time.slice(0,5)}` : ''}
              </span>
            } />
            <MetaItem label="Автор" value={c.author_name ?? '—'} />
            <MetaItem label="Виконавець" value={c.executor_name ?? '—'} />
            <MetaItem label="Перевіряє" value={c.checker_name ?? '—'} />
            <MetaItem label="Створено" value={
              <span style={{ fontFamily: 'var(--mono)' }}>{fmtDate(c.created_at.slice(0,10))}</span>
            } />
            <MetaItem label="Останнє оновлення" value={
              <span style={{ fontFamily: 'var(--mono)' }}>{fmtDateTime(c.updated_at)}</span>
            } />
          </div>

          {isAdmin && (
            <>
              <div className="sc-detail-label" style={{ marginBottom: 8 }}>Змінити статус</div>
              <div className="sc-status-btns">
                {CHECKER_STATUSES.map(key => {
                  const val = STATUS_CONFIG[key]
                  const BtnIcon = val.icon
                  return (
                    <button key={key}
                      className={`sc-status-btn ${c.status === key ? 'active' : ''}`}
                      style={{ background: val.bg, color: val.fg }}
                      onClick={() => onStatusChange(c.id, key)}>
                      <BtnIcon size={13} /> {val.label}
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {/* Activity history */}
          {events && events.length > 0 && (
            <>
              <div className="sc-detail-label" style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <History size={13} /> Історія
              </div>
              <div className="sc-history">
                {events.map(ev => (
                  <div key={ev.id} className="sc-history-row">
                    <span className="sc-history-dot" style={{ background: ev.to_status ? STATUS_CONFIG[ev.to_status].border : 'var(--text-muted)' }} />
                    <div className="sc-history-text">
                      <div>
                        {ev.type === 'created'
                          ? <>Створено{ev.to_status ? <> · <b>{STATUS_CONFIG[ev.to_status].label}</b></> : null}</>
                          : <>{ev.from_status ? STATUS_CONFIG[ev.from_status].label : '—'} → <b>{ev.to_status ? STATUS_CONFIG[ev.to_status].label : '—'}</b></>}
                      </div>
                      <div className="sc-history-meta">{ev.actor_name ?? 'Система'} · {fmtDateTime(ev.created_at)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Return-to-executor panel */}
          {canReturn && returnOpen && (
            <div className="sc-return-panel">
              <div className="sc-detail-label" style={{ marginBottom: 6 }}>Повернути виконавцю на доопрацювання</div>
              <textarea
                className="sc-textarea"
                placeholder="Що треба доробити? (виконавець побачить це в описі)"
                value={reason}
                onChange={e => setReason(e.target.value)}
              />
              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 10 }}>
                <button className="sc-btn sc-btn-secondary" onClick={() => { setReturnOpen(false); setReason('') }}>Скасувати</button>
                <button className="sc-btn sc-btn-primary" onClick={() => { onReturn!(c, reason); }}>
                  <RotateCcw size={14} /> Повернути в роботу
                </button>
              </div>
            </div>
          )}

          <div className="sc-modal-actions">
            {isAdmin && (
              <button className="sc-btn sc-btn-danger" onClick={handleDelete}>
                <Trash2 size={14} /> Видалити
              </button>
            )}
            {canReturn && !returnOpen && (
              <button className="sc-btn sc-btn-secondary" onClick={() => setReturnOpen(true)} style={{ marginRight: 'auto' }}>
                <RotateCcw size={14} /> Повернути виконавцю
              </button>
            )}
            <button className="sc-btn sc-btn-secondary" onClick={onClose}>Закрити</button>
            {isAdmin && (
              <button className="sc-btn sc-btn-primary" onClick={() => onEdit(c)}>
                <Pencil size={14} /> Редагувати
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
