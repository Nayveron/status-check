'use client'

import { Calendar } from 'lucide-react'

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="sc-fallback">
      <div className="sc-fallback-logo">
        <Calendar size={26} color="#8b6fc9" />
        <div><span>Status</span>Check</div>
      </div>
      <div className="sc-fallback-code">Упс…</div>
      <div className="sc-fallback-title">Щось пішло не так</div>
      <p className="sc-fallback-text">Сталася неочікувана помилка. Спробуй оновити сторінку.</p>
      <button className="sc-auth-btn" style={{ width: 'auto', padding: '11px 22px' }} onClick={() => reset()}>
        Спробувати ще раз
      </button>
    </div>
  )
}
