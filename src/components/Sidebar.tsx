'use client'

import { useLayoutEffect, useRef, useState } from 'react'
import { BarChart3, Calendar, LayoutList, Users } from 'lucide-react'
import type { Profile } from '@/lib/types'
import type { ViewMode } from './AppShell'
import Avatar from './Avatar'

interface Props {
  currentProfile: Profile
  viewMode: ViewMode
  onViewChange: (v: ViewMode) => void
  myActiveCount: number
  toCheckCount: number
}

interface CaretBox { top: number; left: number; width: number; height: number }

export default function Sidebar({ currentProfile, viewMode, onViewChange, myActiveCount, toCheckCount }: Props) {
  const isAdmin = currentProfile.role === 'admin'

  const items: { id: ViewMode; label: string; icon: typeof Calendar; badge?: number }[] = isAdmin
    ? [
        { id: 'calendar',  label: 'Календар',  icon: Calendar,  badge: toCheckCount || undefined },
        { id: 'analytics', label: 'Аналітика', icon: BarChart3 },
        { id: 'admin',     label: 'Команда',   icon: Users },
      ]
    : [
        { id: 'tasks', label: 'Мої завдання', icon: LayoutList, badge: myActiveCount || undefined },
      ]

  // ── physical slider caret ──
  const navRef = useRef<HTMLElement>(null)
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const [caret, setCaret] = useState<CaretBox | null>(null)
  const [animate, setAnimate] = useState(false)

  useLayoutEffect(() => {
    const measure = () => {
      const el = itemRefs.current[viewMode]
      if (!el) return
      setCaret({ top: el.offsetTop, left: el.offsetLeft, width: el.offsetWidth, height: el.offsetHeight })
    }
    measure()
    // enable transition only after the first positioning (so it doesn't fly in on mount)
    const t = requestAnimationFrame(() => setAnimate(true))
    window.addEventListener('resize', measure)
    return () => { cancelAnimationFrame(t); window.removeEventListener('resize', measure) }
  }, [viewMode, isAdmin, myActiveCount, toCheckCount])

  return (
    <aside className="sc-sidebar">
      <div className="sc-sidebar-logo">
        <Calendar size={22} color="#a98eda" />
        <div><span>Status</span>Check</div>
      </div>

      <nav className="sc-nav" ref={navRef}>
        <div className="sc-nav-label">Меню</div>

        {/* single floating caret */}
        {caret && (
          <span
            className={`sc-nav-caret ${animate ? 'animate' : ''}`}
            style={{
              width: caret.width,
              height: caret.height,
              transform: `translate(${caret.left}px, ${caret.top}px)`,
            }}
          />
        )}

        {items.map(item => {
          const Icon = item.icon
          return (
            <button
              key={item.id}
              ref={el => { itemRefs.current[item.id] = el }}
              className={`sc-nav-item ${viewMode === item.id ? 'active' : ''}`}
              onClick={() => onViewChange(item.id)}
            >
              <Icon size={18} />
              <span>{item.label}</span>
              {item.badge ? <span className="sc-nav-badge">{item.badge}</span> : null}
            </button>
          )
        })}
      </nav>

      <div className="sc-sidebar-footer">
        <Avatar color={currentProfile.color} initials={currentProfile.initials} name={currentProfile.name} size={36} />
        <div className="sc-sidebar-user">
          <div className="sc-sidebar-user-name">{currentProfile.name}</div>
          <div className="sc-sidebar-user-role">
            {currentProfile.is_super ? 'Супер-перевіряючий' : isAdmin ? 'Перевіряючий' : 'Виконавець'}
          </div>
        </div>
      </div>
    </aside>
  )
}
