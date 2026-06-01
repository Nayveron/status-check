import { AlertTriangle, Archive, Check, Clock, Inbox, Lightbulb, Timer, type LucideIcon } from 'lucide-react'
import type { Status } from './types'

export const STATUS_CONFIG: Record<Status, {
  label: string
  bg: string
  fg: string
  border: string
  icon: LucideIcon
}> = {
  assigned:      { label: 'Assigned',      bg: '#e8f6ff', fg: '#0369a1', border: '#06b6d4', icon: Inbox },
  in_progress:   { label: 'In Progress',   bg: '#dde9ff', fg: '#1e40af', border: '#3b6bff', icon: Timer },
  to_check:      { label: 'To Check',      bg: '#fff2d6', fg: '#92400e', border: '#ff9d00', icon: Clock },
  expired:       { label: 'Expired',       bg: '#ffe1e1', fg: '#991b1b', border: '#ff3b4e', icon: AlertTriangle },
  done:          { label: 'Done',          bg: '#cdfbe7', fg: '#065f46', border: '#04c585', icon: Check },
  not_actual:    { label: 'Not Actual',    bg: '#eef0f4', fg: '#4b5563', border: '#8b94a6', icon: Archive },
  ideas_backlog: { label: 'Ideas Backlog', bg: '#ece4ff', fg: '#5b21b6', border: '#9b5cff', icon: Lightbulb },
}

// Checker sees these 5 statuses in the calendar
export const CHECKER_STATUSES: Status[] = ['to_check', 'expired', 'done', 'not_actual', 'ideas_backlog']

// Full order for admin forms / day panel
export const STATUS_ORDER: Status[] = ['assigned', 'in_progress', 'to_check', 'expired', 'done', 'not_actual', 'ideas_backlog']

// Executor dashboard: 3 columns
export const EXECUTOR_COLS: { status: Status; label: string; readOnly?: boolean }[] = [
  { status: 'assigned',    label: 'Нові' },
  { status: 'in_progress', label: 'В процесі' },
  { status: 'to_check',   label: 'На перевірці', readOnly: true },
]

export const MONTH_NAMES = [
  'Січень','Лютий','Березень','Квітень','Травень','Червень',
  'Липень','Серпень','Вересень','Жовтень','Листопад','Грудень',
]

export const DAY_NAMES = ['Пн','Вт','Ср','Чт','Пт','Сб','Нд']

export const USER_COLORS = [
  '#6366f1', '#0891b2', '#c026d3', '#ea580c', '#059669',
  '#dc2626', '#7c3aed', '#0284c7', '#d97706', '#16a34a',
]
