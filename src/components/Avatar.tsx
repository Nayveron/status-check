const PALETTE = ['#8b6fc9', '#06b6d4', '#c026d3', '#ea580c', '#04c585', '#ff3b4e', '#3b6bff', '#d97706']

function deriveInitials(name: string) {
  return name.split(' ').map(w => w[0] || '').join('').toUpperCase().slice(0, 2)
}
function hashColor(name: string) {
  return PALETTE[(name.charCodeAt(0) || 0) % PALETTE.length]
}

interface Props {
  /** full name — used for tooltip and to derive initials/color when not given */
  name?: string | null
  color?: string
  initials?: string
  size?: number
}

/** Single source of truth for user avatars (initials chip). */
export default function Avatar({ name, color, initials, size = 28 }: Props) {
  const label = name ?? ''
  // prefer first letters of name words (Ім'я Прізвище → ІП); fall back to stored initials
  const ini = label ? deriveInitials(label) : (initials ?? '')
  const col = color ?? hashColor(label)
  return (
    <span
      className="sc-avatar"
      title={name ?? undefined}
      style={{ background: col, width: size, height: size, fontSize: Math.round(size * 0.38) }}
    >
      {ini}
    </span>
  )
}
