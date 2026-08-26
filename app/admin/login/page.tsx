'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const [form, setForm] = useState({ username: '', password: '' })
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    const res = await fetch('/api/admin/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    })
    const data = await res.json()
    setLoading(false)
    if (res.ok) router.push('/admin/kurumlar')
    else setError(data.error)
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#0f0a1e',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      fontFamily: 'system-ui,-apple-system,sans-serif'
    }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16, margin: '0 auto 16px',
            background: 'linear-gradient(135deg,#7c3aed,#4f46e5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26
          }}>⬛</div>
          <h1 style={{ color: '#fff', fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Event QR</h1>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 13 }}>Yönetim Paneline Giriş</p>
        </div>

        {/* Form */}
        <div style={{
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 20, padding: 28
        }}>
          <form onSubmit={submit}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
                Kullanıcı Adı
              </label>
              <input
                type="text" value={form.username}
                onChange={e => setForm({ ...form, username: e.target.value })}
                required placeholder="admin"
                style={{
                  width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 12, padding: '12px 16px', fontSize: 14, color: '#fff',
                  outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit'
                }}
              />
            </div>

            <div style={{ marginBottom: 24 }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>
                Şifre
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPass ? 'text' : 'password'} value={form.password}
                  onChange={e => setForm({ ...form, password: e.target.value })}
                  required placeholder="••••••••"
                  style={{
                    width: '100%', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 12, padding: '12px 44px 12px 16px', fontSize: 14, color: '#fff',
                    outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit'
                  }}
                />
                <button type="button" onClick={() => setShowPass(!showPass)} style={{
                  position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                  background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'rgba(255,255,255,0.3)'
                }}>{showPass ? '🙈' : '👁️'}</button>
              </div>
            </div>

            {error && (
              <div style={{
                background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#f87171', marginBottom: 16
              }}>{error}</div>
            )}

            <button type="submit" disabled={loading} style={{
              width: '100%', background: 'linear-gradient(135deg,#7c3aed,#4f46e5)',
              border: 'none', borderRadius: 12, padding: '13px', fontSize: 14, fontWeight: 700,
              color: '#fff', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
              transition: 'opacity 0.15s'
            }}>
              {loading ? 'Giriş yapılıyor...' : 'Giriş Yap →'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
