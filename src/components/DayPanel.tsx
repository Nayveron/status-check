'use client'

import { useState } from 'react'
import { X } from 'lucide-react'
import { CHECKER_STATUSES, STATUS_CONFIG } from '@/lib/constants'
import type { Commitment, Status } from '@/lib/types'
import Avatar from './Avatar'

interface Props {
  date: Date
  commitments: Commitment[]
  isAdmin: boolean
  onClose: () => void
  onStatusChange: (id: string, status: Status) => void
  onCardClick: (c: Commitment) => void
}

const MONTH_SHORT = ['Січ','Лют','Бер','Кві','Тра','Чер','Лип','Сер','Вер','Жов','Лис','Гру']
const DAY_UK = ['неділя','понеділок','вівторок','середа','четвер','п\'ятниця','субота']
const fmtUpd = (iso: string) =>
  new Date(iso).toLocaleString('uk-UA', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })

export default function DayPanel({ date, commitments, isAdmin, onClose, onStatusChange, onCardClick }: Props) {
  const [dragId, setDragId] = useState<string | null>(null)
  const [dragOverCol, setDragOverCol] = useState<Status | null>(null)

  const label = `${date.getDate()} ${MONTH_SHORT[date.getMonth()]} ${date.getFullYear()}`
  const dayName = DAY_UK[date.getDay()]

  const byStatus = (status: Status) => commitments.filter(c => c.status === status)

  const handleDragStart = (e: React.DragEvent, id: string) => {
    if (!isAdmin) return
    setDragId(id)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', id)
  }

  const handleDragEnd = () => {
    setDragId(null)
    setDragOverCol(null)
  }

  const handleDragOver = (e: React.DragEvent, status: Status) => {
    if (!isAdmin) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOverCol(status)
  }

  const handleDrop = (e: React.DragEvent, status: Status) => {
    if (!isAdmin) return
    e.preventDefault()
    const id = e.dataTransfer.getData('text/plain')
    if (id) onStatusChange(id, status)
    setDragId(null)
    setDragOverCol(null)
  }

  return (
    <>
      {/* backdrop closes panel on outside click */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 39 }} onClick={onClose} />

      <div className="sc-day-panel" onClick={e => e.stopPropagation()}>
        {/* Panel header */}
        <div className="sc-panel-header">
          <div>
            <div className="sc-panel-date">{label}</div>
            <div className="sc-panel-date-sub">{dayName} · {commitments.length} комітментів</div>
          </div>
          <div className="sc-panel-actions">
            <button className="sc-panel-close" onClick={onClose}><X size={18} /></button>
          </div>
        </div>

        {/* Kanban columns */}
        <div className="sc-kanban">
          {CHECKER_STATUSES.map(status => {
            const cfg = STATUS_CONFIG[status]
            const Icon = cfg.icon
            const cards = byStatus(status)
            const isOver = dragOverCol === status

            return (
              <div
                key={status}
                className={`sc-kanban-col ${isOver ? 'drag-over' : ''}`}
                onDragOver={e => handleDragOver(e, status)}
                onDragLeave={() => setDragOverCol(null)}
                onDrop={e => handleDrop(e, status)}
              >
                {/* Column header */}
                <div className="sc-kanban-col-header" style={{ color: cfg.border }}>
                  <Icon size={13} />
                  <span>{cfg.label}</span>
                  <span className="sc-kanban-col-count" style={{ background: cfg.border, color: '#fff' }}>{cards.length}</span>
                </div>

                {/* Cards */}
                <div className="sc-kanban-cards">
                  {cards.length === 0 ? (
                    <div className="sc-kanban-empty">—</div>
                  ) : (
                    cards.map(c => (
                      <KanbanCard
                        key={c.id}
                        commitment={c}
                        draggable={isAdmin}
                        isDragging={dragId === c.id}
                        onDragStart={e => handleDragStart(e, c.id)}
                        onDragEnd={handleDragEnd}
                        onClick={() => onCardClick(c)}
                      />
                    ))
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}

interface CardProps {
  commitment: Commitment
  draggable: boolean
  isDragging: boolean
  onDragStart: (e: React.DragEvent) => void
  onDragEnd: () => void
  onClick: () => void
}

function KanbanCard({ commitment: c, draggable, isDragging, onDragStart, onDragEnd, onClick }: CardProps) {
  const cfg = STATUS_CONFIG[c.status]
  return (
    <div
      className={`sc-kanban-card ${isDragging ? 'dragging' : ''} ${draggable ? '' : 'no-drag'}`}
      style={{ borderLeftColor: cfg.border }}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
    >
      <div className="sc-kanban-card-title">{c.title}</div>
      <div className="sc-kanban-card-meta">
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {c.deadline_time && (
            <span className="sc-kanban-card-time">{c.deadline_time.slice(0,5)}</span>
          )}
          {c.project_name && (
            <span style={{ fontSize: 10, color: 'var(--panel-fg-muted)', borderLeft: c.deadline_time ? '1px solid rgba(255,255,255,0.15)' : 'none', paddingLeft: c.deadline_time ? 4 : 0 }}>
              {c.project_name}
            </span>
          )}
        </div>
        <div className="sc-kanban-card-avatars">
          {c.executor_name && <Avatar name={c.executor_name} size={18} />}
        </div>
      </div>
      <div className="sc-kanban-card-updated">↻ оновлено {fmtUpd(c.updated_at)}</div>
    </div>
  )
}
