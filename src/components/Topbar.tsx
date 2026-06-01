'use client'

import { useState } from 'react'
import { LogOut, Search, X } from 'lucide-react'
import type { Profile } from '@/lib/types'

interface Props {
  title: string
  showSearch: boolean
  searchQuery: string
  onSearch: (q: string) => void
  currentProfile: Profile
  mockDate: Date | null
  realToday: Date
  onMockDate: (d: Date | null) => void
  onSignOut: () => void
}

const MONTH_SHORT = ['Січ','Лют','Бер','Кві','Тра','Чер','Лип','Сер','Вер','Жов','Лис','Гру']

export default function Topbar({
  title, showSearch, searchQuery, onSearch, currentProfile,
  mockDate, realToday, onMockDate, onSignOut,
}: Props) {
  const [showMockPicker, setShowMockPicker] = useState(false)

  // demo control: visible by default; set NEXT_PUBLIC_DEMO=0 to hide on a "clean" prod
  const demoMode = process.env.NEXT_PUBLIC_DEMO !== '0'

  const mockDateStr = mockDate
    ? `${mockDate.getDate()} ${MONTH_SHORT[mockDate.getMonth()]} ${mockDate.getFullYear()}`
    : null

  return (
    <header className="sc-topbar">
      <div className="sc-topbar-title">{title}</div>

      {showSearch ? (
        <div className="sc-search">
          <Search size={15} />
          <input
            type="text"
            placeholder="Пошук за назвою…"
            value={searchQuery}
            onChange={e => onSearch(e.target.value)}
          />
          {searchQuery && (
            <button onClick={() => onSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', display: 'flex' }}>
              <X size={14} />
            </button>
          )}
        </div>
      ) : (
        <div style={{ flex: 1 }} />
      )}

      <div className="sc-topbar-right">
        {/* Mock date control (demo only) */}
        {demoMode && (
        <div className="sc-mock-date-wrap">
          <button
            className={`sc-icon-btn ${mockDate ? 'sc-mock-active' : ''}`}
            title="Змінити 'сьогодні' для демо"
            onClick={() => setShowMockPicker(v => !v)}
          >
            📅 {mockDateStr ?? 'Сьогодні'}
          </button>
          {showMockPicker && (
            <div className="sc-mock-picker">
              <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>ДЕМО: яка дата «сьогодні»</div>
              <input
                type="date"
                className="sc-input"
                style={{ marginBottom: 0 }}
                defaultValue={(mockDate ?? realToday).toISOString().split('T')[0]}
                onChange={e => {
                  if (e.target.value) onMockDate(new Date(e.target.value + 'T00:00:00'))
                  setShowMockPicker(false)
                }}
              />
              {mockDate && (
                <button className="sc-icon-btn" onClick={() => { onMockDate(null); setShowMockPicker(false) }}>
                  <X size={13} /> Скинути до реального
                </button>
              )}
            </div>
          )}
        </div>
        )}

        <span className={`sc-role-badge ${currentProfile.role}`}>
          {currentProfile.role === 'admin' ? 'Checker' : 'Executor'}
        </span>
        <button className="sc-icon-btn" onClick={onSignOut}>
          <LogOut size={14} /> Вийти
        </button>
      </div>
    </header>
  )
}
