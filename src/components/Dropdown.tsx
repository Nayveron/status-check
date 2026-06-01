'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'

export interface DropdownOption {
  value: string
  label: string
  color?: string  // optional swatch dot
}

interface Props {
  value: string
  options: DropdownOption[]
  onChange: (value: string) => void
  /** label shown when value === '' (also the first/reset option) */
  placeholder?: string
  minWidth?: number
}

export default function Dropdown({ value, options, onChange, placeholder = 'Усі', minWidth = 170 }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      document.removeEventListener('keydown', onEsc)
    }
  }, [open])

  const selected = options.find(o => o.value === value)
  const isActive = value !== ''
  const label = selected?.label ?? placeholder

  return (
    <div className="sc-dd" ref={ref} style={{ minWidth }}>
      <button
        type="button"
        className={`sc-dd-trigger ${isActive ? 'active' : ''} ${open ? 'open' : ''}`}
        onClick={() => setOpen(o => !o)}
      >
        {selected?.color && <span className="sc-dd-swatch" style={{ background: selected.color }} />}
        <span className="sc-dd-label">{label}</span>
        <ChevronDown size={15} className="sc-dd-chevron" />
      </button>

      {open && (
        <div className="sc-dd-menu" role="listbox">
          {options.map(opt => {
            const active = opt.value === value
            return (
              <button
                key={opt.value || '__all'}
                type="button"
                role="option"
                aria-selected={active}
                className={`sc-dd-option ${active ? 'active' : ''}`}
                onClick={() => { onChange(opt.value); setOpen(false) }}
              >
                {opt.color && <span className="sc-dd-swatch" style={{ background: opt.color }} />}
                <span className="sc-dd-option-label">{opt.label}</span>
                {active && <Check size={15} className="sc-dd-check" />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
