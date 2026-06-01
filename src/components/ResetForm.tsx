'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Calendar } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

export default function ResetForm() {
  const router = useRouter()
  const [ready, setReady] = useState(false)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  // The recovery link signs the user in with a temporary session.
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) setError('Посилання для скидання недійсне або застаріле. Запроси новий лист.')
      setReady(true)
    })
  }, [])

  const handleReset = async () => {
    if (password.length < 6) { setError('Пароль має містити щонайменше 6 символів'); return }
    if (password !== confirm) { setError('Паролі не співпадають'); return }
    const supabase = createClient()
    setLoading(true); setError('')
    const { error: err } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (err) { setError(err.message); return }
    setDone(true)
    setTimeout(() => { router.push('/dashboard'); router.refresh() }, 1200)
  }

  return (
    <div className="sc-auth">
      <div className="sc-auth-card">
        <div className="sc-auth-logo">
          <Calendar size={28} color="#8b6fc9" />
          <span>Status</span>Check
        </div>
        <p className="sc-auth-sub">Встановлення нового пароля</p>

        {error && <div className="sc-auth-error">{error}</div>}

        {done ? (
          <div className="sc-auth-role-info">Пароль оновлено! Перенаправляємо…</div>
        ) : (
          <>
            <label className="sc-auth-label">Новий пароль</label>
            <input className="sc-auth-input" type="password" placeholder="мінімум 6 символів"
              value={password} onChange={e => setPassword(e.target.value)} disabled={!ready} />
            <label className="sc-auth-label">Повторіть пароль</label>
            <input className="sc-auth-input" type="password" placeholder="••••••••"
              value={confirm} onChange={e => setConfirm(e.target.value)} disabled={!ready}
              onKeyDown={e => e.key === 'Enter' && handleReset()} />
            <button className="sc-auth-btn" disabled={loading || !ready || !password || !confirm} onClick={handleReset}>
              {loading ? 'Зберігаємо…' : 'Зберегти пароль'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
