'use client'

import { useState, useMemo, useCallback } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { CHECKER_STATUSES, STATUS_CONFIG, MONTH_NAMES, DAY_NAMES } from '@/lib/constants'
import { effectiveStatus } from '@/lib/status'
import type { Commitment, Profile, Project, Status } from '@/lib/types'
import CommitmentCard from './CommitmentCard'
import DayPanel from './DayPanel'
import Dropdown from './Dropdown'

interface Props {
  currentProfile: Profile
  commitments: Commitment[]
  projects: Project[]
  profiles: Profile[]
  effectiveToday: Date
  mockActive: boolean
  searchQuery: string
  onStatusChange: (id: string, status: Status) => void
  onCardClick: (c: Commitment) => void
}

function getDaysInMonth(year: number, month: number) {
  const first = new Date(year, month, 1)
  const startDay = (first.getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const prevMonthDays = new Date(year, month, 0).getDate()
  const cells: { day: number; current: boolean; date: Date }[] = []
  for (let i = startDay - 1; i >= 0; i--)
    cells.push({ day: prevMonthDays - i, current: false, date: new Date(year, month - 1, prevMonthDays - i) })
  for (let i = 1; i <= daysInMonth; i++)
    cells.push({ day: i, current: true, date: new Date(year, month, i) })
  const remaining = 42 - cells.length
  for (let i = 1; i <= remaining; i++)
    cells.push({ day: i, current: false, date: new Date(year, month + 1, i) })
  return cells
}

const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()

export default function CalendarView({
  currentProfile, commitments, projects, profiles, effectiveToday, mockActive,
  searchQuery, onStatusChange, onCardClick,
}: Props) {
  const isAdmin = currentProfile.role === 'admin'

  const [viewYear, setViewYear] = useState(effectiveToday.getFullYear())
  const [viewMonth, setViewMonth] = useState(effectiveToday.getMonth())
  const [filterProject, setFilterProject] = useState('')
  const [filterStatus, setFilterStatus] = useState<Status | ''>('')
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)

  const days = useMemo(() => getDaysInMonth(viewYear, viewMonth), [viewYear, viewMonth])

  // a checker sees ONLY commitments assigned to them; overdue to_check shown as expired
  const effCommitments = useMemo(
    () => commitments
      .filter(c => c.checker_id === currentProfile.id)
      .map(c => {
        const s = effectiveStatus(c, effectiveToday)
        return s === c.status ? c : { ...c, status: s }
      }),
    [commitments, effectiveToday, currentProfile.id]
  )

  const q = searchQuery.trim().toLowerCase()
  const filtered = useMemo(() => effCommitments.filter(c => {
    if (!CHECKER_STATUSES.includes(c.status)) return false
    if (filterProject && c.project_id !== filterProject) return false
    if (filterStatus && c.status !== filterStatus) return false
    if (q && !c.title.toLowerCase().includes(q)) return false
    return true
  }), [effCommitments, filterProject, filterStatus, q])

  // stats ignore the status filter (so the bar always shows full counts)
  const statsBase = useMemo(() => effCommitments.filter(c => {
    if (!CHECKER_STATUSES.includes(c.status)) return false
    if (filterProject && c.project_id !== filterProject) return false
    if (q && !c.title.toLowerCase().includes(q)) return false
    return true
  }), [effCommitments, filterProject, q])

  const projectOptions = useMemo(
    () => [{ value: '', label: 'Всі проєкти' }, ...projects.map(p => ({ value: p.id, label: p.name }))],
    [projects]
  )

  const stats = useMemo(() => {
    const counts = Object.fromEntries(CHECKER_STATUSES.map(k => [k, 0])) as Record<Status, number>
    statsBase.forEach(c => { if (counts[c.status] !== undefined) counts[c.status]++ })
    return counts
  }, [statsBase])

  const getForDay = useCallback((date: Date) =>
    filtered.filter(c => sameDay(new Date(c.deadline + 'T00:00:00'), date))
      .sort((a, b) => {
        if (a.deadline_time && b.deadline_time) return a.deadline_time.localeCompare(b.deadline_time)
        return a.deadline_time ? -1 : b.deadline_time ? 1 : 0
      }), [filtered])

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  const handleCellClick = (date: Date) =>
    setSelectedDate(prev => prev && sameDay(prev, date) ? null : date)

  return (
    <>
      <div className="sc-toolbar">
        <div className="sc-toolbar-left">
          <div className="sc-month-nav">
            <button onClick={prevMonth}><ChevronLeft size={16} /></button>
            <span className="sc-month-label">{MONTH_NAMES[viewMonth]} {viewYear}</span>
            <button onClick={nextMonth}><ChevronRight size={16} /></button>
          </div>
        </div>
        <div className="sc-toolbar-right">
          <Dropdown value={filterProject} options={projectOptions} onChange={setFilterProject} placeholder="Всі проєкти" />
        </div>
      </div>

      <div className="sc-stats">
        {CHECKER_STATUSES.map(key => {
          const val = STATUS_CONFIG[key]
          const isOn = filterStatus === key
          const dim = filterStatus !== '' && !isOn
          return (
            <button
              key={key}
              className={`sc-stat-chip ${isOn ? 'on' : ''} ${dim ? 'dim' : ''}`}
              style={{ '--chip': val.border } as React.CSSProperties}
              onClick={() => setFilterStatus(isOn ? '' : key)}
              title={isOn ? 'Прибрати фільтр' : `Показати лише ${val.label}`}
            >
              <span className="sc-stat-chip-dot" />
              <span className="sc-stat-chip-label">{val.label}</span>
              <span className="sc-stat-chip-count">{stats[key] ?? 0}</span>
            </button>
          )
        })}
      </div>

      {mockActive && (
        <div className="sc-mock-banner">
          🎭 Демо-режим: «Сьогодні» = {effectiveToday.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
      )}

      <div className="sc-calendar">
        <div className="sc-cal-header">
          {DAY_NAMES.map(d => <div key={d} className="sc-cal-header-cell">{d}</div>)}
        </div>
        <div className="sc-cal-grid">
          {days.map((cell, i) => {
            const dayCommitments = getForDay(cell.date)
            const isToday = sameDay(cell.date, effectiveToday)
            const isSelected = selectedDate ? sameDay(cell.date, selectedDate) : false
            const maxShow = 3
            return (
              <div key={i}
                className={`sc-cal-cell ${cell.current ? '' : 'other-month'} ${isSelected ? 'selected' : ''}`}
                onClick={() => handleCellClick(cell.date)}>
                <div className={`sc-cal-day ${isToday ? 'is-today' : ''} ${isSelected ? 'is-selected' : ''}`}>
                  {cell.day}
                </div>
                {dayCommitments.slice(0, maxShow).map(c => (
                  <CommitmentCard key={c.id} commitment={c} onClick={e => { e.stopPropagation(); onCardClick(c) }} />
                ))}
                {dayCommitments.length > maxShow && (
                  <div className="sc-card-more">+{dayCommitments.length - maxShow} ще</div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {selectedDate && (
        <DayPanel
          date={selectedDate}
          commitments={getForDay(selectedDate)}
          isAdmin={isAdmin}
          onClose={() => setSelectedDate(null)}
          onStatusChange={onStatusChange}
          onCardClick={onCardClick}
        />
      )}
    </>
  )
}
