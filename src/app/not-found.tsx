import Link from 'next/link'
import { Calendar } from 'lucide-react'

export default function NotFound() {
  return (
    <div className="sc-fallback">
      <div className="sc-fallback-logo">
        <Calendar size={26} color="#8b6fc9" />
        <div><span>Status</span>Check</div>
      </div>
      <div className="sc-fallback-code">404</div>
      <div className="sc-fallback-title">Сторінку не знайдено</div>
      <p className="sc-fallback-text">Можливо, посилання застаріле або сторінку було видалено.</p>
      <Link href="/dashboard" className="sc-auth-btn" style={{ width: 'auto', padding: '11px 22px', textDecoration: 'none' }}>
        На головну
      </Link>
    </div>
  )
}
