import { STATUS_CONFIG } from '@/lib/constants'
import type { Commitment } from '@/lib/types'

interface Props {
  commitment: Commitment
  onClick: (e: React.MouseEvent) => void
}

export default function CommitmentCard({ commitment: c, onClick }: Props) {
  const s = STATUS_CONFIG[c.status]
  return (
    <div
      className="sc-card"
      style={{ background: s.bg, color: s.fg, borderLeftColor: s.border }}
      onClick={onClick}
    >
      {c.deadline_time && <span className="sc-card-time">{c.deadline_time.slice(0,5)}</span>}
      {c.title}
    </div>
  )
}
