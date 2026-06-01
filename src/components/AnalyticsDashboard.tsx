'use client'

import { useMemo } from 'react'
import {
  ResponsiveContainer, PieChart, Pie, Cell,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  AreaChart, Area,
} from 'recharts'
import { AlertTriangle, BarChart3, CheckCircle2, ListChecks, ShieldCheck, Timer } from 'lucide-react'
import { CHECKER_STATUSES, STATUS_CONFIG, STATUS_ORDER } from '@/lib/constants'
import { effectiveStatus } from '@/lib/status'
import type { Commitment, Profile, Project, Status } from '@/lib/types'

interface Props {
  commitments: Commitment[]
  projects: Project[]
  profiles: Profile[]
  effectiveToday: Date
}

/* Monday-based week start, returns ISO yyyy-mm-dd */
function weekStart(iso: string): string {
  const d = new Date(iso.slice(0, 10) + 'T00:00:00')
  const dow = (d.getDay() + 6) % 7 // 0 = Monday
  d.setDate(d.getDate() - dow)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const weekLabel = (iso: string) => {
  const d = new Date(iso + 'T00:00:00')
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function AnalyticsDashboard({ commitments, projects, profiles, effectiveToday }: Props) {
  const data = useMemo(() => {
    // overdue to_check counts as expired (respects demo/mock "today")
    const eff = commitments.map(c => {
      const s = effectiveStatus(c, effectiveToday)
      return s === c.status ? c : { ...c, status: s }
    })
    // A "commit" = a task that reached the checker (assigned / in_progress are still pre-commit tasks)
    const commits = eff.filter(c => CHECKER_STATUSES.includes(c.status))
    const pipeline = eff.filter(c => c.status === 'assigned' || c.status === 'in_progress').length

    const byStatusCount = Object.fromEntries(STATUS_ORDER.map(s => [s, 0])) as Record<Status, number>
    commits.forEach(c => { if (byStatusCount[c.status] !== undefined) byStatusCount[c.status]++ })

    const total = commits.length
    const done = byStatusCount.done
    const expired = byStatusCount.expired
    const toCheck = byStatusCount.to_check
    const onTime = done + expired > 0 ? Math.round((done / (done + expired)) * 100) : null

    // 1. status distribution — checker-side statuses only (real commits)
    const statusPie = CHECKER_STATUSES
      .filter(s => byStatusCount[s] > 0)
      .map(s => ({ name: STATUS_CONFIG[s].label, value: byStatusCount[s], color: STATUS_CONFIG[s].border }))

    // 2. timeliness donut: on-time vs overdue vs awaiting check
    const timelinessPie = [
      { name: 'Вчасно', value: done, color: STATUS_CONFIG.done.border },
      { name: 'Прострочено', value: expired, color: STATUS_CONFIG.expired.border },
      { name: 'Очікує перевірки', value: toCheck, color: STATUS_CONFIG.to_check.border },
    ].filter(d => d.value > 0)

    // 3. by project (stacked: done / expired / other-commits)
    const projData = projects.map(p => {
      const list = commits.filter(c => c.project_id === p.id)
      return {
        name: p.name,
        Виконано: list.filter(c => c.status === 'done').length,
        Прострочено: list.filter(c => c.status === 'expired').length,
        Інші: list.filter(c => c.status !== 'done' && c.status !== 'expired').length,
      }
    }).filter(p => p.Виконано + p.Прострочено + p.Інші > 0)

    // 4. by executor (commits total vs done), sorted by done desc
    const execMap = new Map<string, { name: string; Всього: number; Виконано: number }>()
    commits.forEach(c => {
      if (!c.executor_id) return
      const name = c.executor_name ?? '—'
      const row = execMap.get(c.executor_id) ?? { name, Всього: 0, Виконано: 0 }
      row.Всього++
      if (c.status === 'done') row.Виконано++
      execMap.set(c.executor_id, row)
    })
    const execData = [...execMap.values()].sort((a, b) => b.Виконано - a.Виконано || b.Всього - a.Всього).slice(0, 8)

    // 5. trend over weeks: created vs completed(done by deadline week)
    const weekMap = new Map<string, { week: string; Створено: number; Завершено: number }>()
    const ensure = (w: string) => {
      if (!weekMap.has(w)) weekMap.set(w, { week: w, Створено: 0, Завершено: 0 })
      return weekMap.get(w)!
    }
    commits.forEach(c => {
      ensure(weekStart(c.created_at)).Створено++
      if (c.status === 'done') ensure(weekStart(c.deadline)).Завершено++
    })
    const trend = [...weekMap.values()]
      .sort((a, b) => a.week.localeCompare(b.week))
      .slice(-8)
      .map(r => ({ ...r, label: weekLabel(r.week) }))

    return { total, done, expired, toCheck, pipeline, onTime, statusPie, timelinessPie, projData, execData, trend }
  }, [commitments, projects, profiles, effectiveToday])

  if (data.total === 0 && data.pipeline === 0) {
    return (
      <div className="sc-analytics">
        <div className="sc-an-empty">
          <BarChart3 size={48} color="var(--text-muted)" />
          <div className="sc-an-empty-title">Поки що немає даних для аналітики</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>Коли з’являться комітменти — тут будуть графіки.</div>
        </div>
      </div>
    )
  }

  const cards = [
    { label: 'Комітментів', value: data.total, icon: ListChecks, bg: '#ede9fe', fg: '#5b21b6', caption: data.pipeline > 0 ? `${data.pipeline} в роботі` : undefined },
    { label: 'На перевірці', value: data.toCheck, icon: Timer, bg: STATUS_CONFIG.to_check.bg, fg: STATUS_CONFIG.to_check.fg },
    { label: 'Виконано', value: data.done, icon: CheckCircle2, bg: STATUS_CONFIG.done.bg, fg: STATUS_CONFIG.done.fg },
    { label: 'Прострочено', value: data.expired, icon: AlertTriangle, bg: STATUS_CONFIG.expired.bg, fg: STATUS_CONFIG.expired.fg },
    { label: 'Вчасно', value: data.onTime === null ? '—' : `${data.onTime}%`, icon: ShieldCheck, bg: '#f0ebfa', fg: '#7a5fb8', caption: 'виконано в строк' },
  ]

  return (
    <div className="sc-analytics">
      {/* Stat cards */}
      <div className="sc-an-stats">
        {cards.map(c => {
          const Icon = c.icon
          return (
            <div key={c.label} className="sc-an-stat">
              <div className="sc-an-stat-icon" style={{ background: c.bg, color: c.fg }}>
                <Icon size={20} />
              </div>
              <div className="sc-an-stat-val">{c.value}</div>
              <div className="sc-an-stat-label">{c.label}{c.caption ? ` · ${c.caption}` : ''}</div>
            </div>
          )
        })}
      </div>

      <div className="sc-an-grid">
        {/* Status distribution donut */}
        <div className="sc-an-card">
          <div className="sc-an-card-title">Розподіл за статусами</div>
          <div className="sc-an-card-sub">Лише комітменти (відправлені на перевірку та далі)</div>
          <div style={{ position: 'relative' }}>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={data.statusPie} dataKey="value" nameKey="name"
                  cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={2} stroke="none">
                  {data.statusPie.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div style={{
              position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
              textAlign: 'center', pointerEvents: 'none',
            }}>
              <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1 }}>{data.total}</div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>комітів</div>
            </div>
          </div>
          <div className="sc-an-legend">
            {data.statusPie.map(e => (
              <div key={e.name} className="sc-an-legend-item">
                <span className="sc-an-legend-dot" style={{ background: e.color }} />
                {e.name} · <strong>{e.value}</strong>
              </div>
            ))}
          </div>
        </div>

        {/* Timeliness donut */}
        <div className="sc-an-card">
          <div className="sc-an-card-title">Дотримання дедлайнів</div>
          <div className="sc-an-card-sub">Виконано в строк, прострочено та в очікуванні</div>
          <div style={{ position: 'relative' }}>
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={data.timelinessPie} dataKey="value" nameKey="name"
                  cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={2} stroke="none">
                  {data.timelinessPie.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div style={{
              position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
              textAlign: 'center', pointerEvents: 'none',
            }}>
              <div style={{ fontSize: 30, fontWeight: 800, lineHeight: 1, color: 'var(--accent)' }}>
                {data.onTime === null ? '—' : `${data.onTime}%`}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>в строк</div>
            </div>
          </div>
          <div className="sc-an-legend">
            {data.timelinessPie.map(e => (
              <div key={e.name} className="sc-an-legend-item">
                <span className="sc-an-legend-dot" style={{ background: e.color }} />
                {e.name} · <strong>{e.value}</strong>
              </div>
            ))}
          </div>
        </div>

        {/* By project */}
        <div className="sc-an-card">
          <div className="sc-an-card-title">За проєктами</div>
          <div className="sc-an-card-sub">Комітменти у розрізі статусів</div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.projData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#6f6b85' }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#6f6b85' }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Виконано" stackId="a" fill={STATUS_CONFIG.done.border} radius={[0, 0, 0, 0]} />
              <Bar dataKey="Прострочено" stackId="a" fill={STATUS_CONFIG.expired.border} />
              <Bar dataKey="Інші" stackId="a" fill="#a98eda" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* By executor */}
        <div className="sc-an-card">
          <div className="sc-an-card-title">Рейтинг виконавців</div>
          <div className="sc-an-card-sub">Усього призначено vs виконано</div>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={data.execData} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" horizontal={false} />
              <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#6f6b85' }} />
              <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11, fill: '#6f6b85' }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Всього" fill="#d6c9ef" radius={[0, 4, 4, 0]} />
              <Bar dataKey="Виконано" fill={STATUS_CONFIG.done.border} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Trend over time */}
        <div className="sc-an-card wide">
          <div className="sc-an-card-title">Динаміка у часі</div>
          <div className="sc-an-card-sub">
            Створено (за датою створення) та завершено (наближено — за тижнем дедлайну виконаних) · останні 8 тижнів
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={data.trend} margin={{ top: 8, right: 16, left: -16, bottom: 0 }}>
              <defs>
                <linearGradient id="gCreated" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#a98eda" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#a98eda" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gDone" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={STATUS_CONFIG.done.border} stopOpacity={0.4} />
                  <stop offset="100%" stopColor={STATUS_CONFIG.done.border} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#6f6b85' }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: '#6f6b85' }} />
              <Tooltip />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="Створено" stroke="#8b6fc9" fill="url(#gCreated)" strokeWidth={2} />
              <Area type="monotone" dataKey="Завершено" stroke={STATUS_CONFIG.done.border} fill="url(#gDone)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
