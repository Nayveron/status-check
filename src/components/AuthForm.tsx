'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Calendar } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { USER_COLORS } from '@/lib/constants'

type Tab = 'signin' | 'signup' | 'forgot'

export default function AuthForm() {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('signin')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')

  const [signEmail, setSignEmail] = useState('')
  const [signPassword, setSignPassword] = useState('')

  const [regEmail, setRegEmail] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [regName, setRegName] = useState('')
  const [regColor, setRegColor] = useState(USER_COLORS[0])

  const [forgotEmail, setForgotEmail] = useState('')

  // surface a failed/expired email link (confirm route redirects here on error)
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get('error') === 'confirm') {
      setError('Посилання недійсне або застаріле. Увійди або запроси новий лист.')
      window.history.replaceState(null, '', '/auth')
    }
  }, [])

  const switchTab = (t: Tab) => { setTab(t); setError(''); setInfo('') }

  const handleSignIn = async () => {
    const supabase = createClient()
    setLoading(true); setError('')
    const { error: err } = await supabase.auth.signInWithPassword({ email: signEmail, password: signPassword })
    setLoading(false)
    if (err) { setError(err.message); return }
    router.push('/dashboard')
    router.refresh()
  }

  const handleSignUp = async () => {
    if (!regName.trim()) { setError('Введіть ім\'я'); return }
    const supabase = createClient()
    setLoading(true); setError(''); setInfo('')
    const initials = regName.trim().split(' ').map(w => w[0] || '').join('').toUpperCase().slice(0, 2)
    // NOTE: role is intentionally NOT sent — every new account is an executor ('user').
    // Admins (checkers) are promoted in the database by the owner.
    const { data, error: err } = await supabase.auth.signUp({
      email: regEmail,
      password: regPassword,
      options: {
        data: { name: regName.trim(), color: regColor, initials },
        emailRedirectTo: `${window.location.origin}/auth/confirm?next=/dashboard`,
      },
    })
    setLoading(false)
    if (err) { setError(err.message); return }
    if (!data.session) {
      // email confirmation is ON — no session yet
      setInfo('Готово! Ми надіслали лист на пошту — підтверди адресу, щоб увійти.')
      setTab('signin')
      return
    }
    router.push('/dashboard')
    router.refresh()
  }

  const handleForgot = async () => {
    const supabase = createClient()
    setLoading(true); setError(''); setInfo('')
    const { error: err } = await supabase.auth.resetPasswordForEmail(forgotEmail, {
      redirectTo: `${window.location.origin}/auth/confirm?next=/auth/reset`,
    })
    setLoading(false)
    if (err) { setError(err.message); return }
    setInfo('Лист для скидання пароля надіслано. Перевір пошту.')
  }

  return (
    <div className="sc-auth">
      <div className="sc-auth-card">
        <div className="sc-auth-logo">
          <Calendar size={28} color="#8b6fc9" />
          <span>Status</span>Check
        </div>
        <p className="sc-auth-sub">Відстеження дедлайнів та комітментів команди</p>

        {tab !== 'forgot' && (
          <div className="sc-auth-tabs">
            <button className={`sc-auth-tab ${tab === 'signin' ? 'active' : ''}`} onClick={() => switchTab('signin')}>
              Увійти
            </button>
            <button className={`sc-auth-tab ${tab === 'signup' ? 'active' : ''}`} onClick={() => switchTab('signup')}>
              Зареєструватись
            </button>
          </div>
        )}

        {error && <div className="sc-auth-error">{error}</div>}
        {info && <div className="sc-auth-role-info">{info}</div>}

        {tab === 'signin' && (
          <>
            <label className="sc-auth-label">Email</label>
            <input className="sc-auth-input" type="email" placeholder="you@company.com"
              value={signEmail} onChange={e => setSignEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSignIn()} />
            <label className="sc-auth-label">Пароль</label>
            <input className="sc-auth-input" type="password" placeholder="••••••••"
              value={signPassword} onChange={e => setSignPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSignIn()} />
            <button className="sc-auth-btn" disabled={loading || !signEmail || !signPassword} onClick={handleSignIn}>
              {loading ? 'Входимо…' : 'Увійти'}
            </button>
            <button className="sc-auth-link" onClick={() => switchTab('forgot')}>Забули пароль?</button>
          </>
        )}

        {tab === 'signup' && (
          <>
            <label className="sc-auth-label">Повне ім'я</label>
            <input className="sc-auth-input" type="text" placeholder="Іван Петренко"
              value={regName} onChange={e => setRegName(e.target.value)} />
            <label className="sc-auth-label">Email</label>
            <input className="sc-auth-input" type="email" placeholder="you@company.com"
              value={regEmail} onChange={e => setRegEmail(e.target.value)} />
            <label className="sc-auth-label">Пароль</label>
            <input className="sc-auth-input" type="password" placeholder="мінімум 6 символів"
              value={regPassword} onChange={e => setRegPassword(e.target.value)} />
            <label className="sc-auth-label">Колір аватара</label>
            <div className="sc-auth-color-row">
              {USER_COLORS.map(c => (
                <div key={c} className={`sc-auth-color-dot ${regColor === c ? 'selected' : ''}`}
                  style={{ background: c }} onClick={() => setRegColor(c)} />
              ))}
            </div>
            <button className="sc-auth-btn" disabled={loading || !regEmail || !regPassword || !regName} onClick={handleSignUp}>
              {loading ? 'Реєструємось…' : 'Зареєструватись'}
            </button>
          </>
        )}

        {tab === 'forgot' && (
          <>
            <label className="sc-auth-label">Email для скидання пароля</label>
            <input className="sc-auth-input" type="email" placeholder="you@company.com"
              value={forgotEmail} onChange={e => setForgotEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleForgot()} />
            <button className="sc-auth-btn" disabled={loading || !forgotEmail} onClick={handleForgot}>
              {loading ? 'Надсилаємо…' : 'Надіслати лист'}
            </button>
            <button className="sc-auth-link" onClick={() => switchTab('signin')}>← Назад до входу</button>
          </>
        )}
      </div>
    </div>
  )
}
