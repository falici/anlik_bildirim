'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

const nav = [
  { href: '/admin/kurumlar', label: 'Kurumlar', icon: '🏢' },
  { href: '/admin/events', label: 'Etkinlikler', icon: '📅' },
  { href: '/admin/qr', label: 'QR Kodlar', icon: '⬛' },
  { href: '/admin/bildirimler', label: 'Bildirimler', icon: '💬' },
  { href: '/admin/operasyon-personel', label: 'Operasyon Personeli', icon: '🔧' },
  { href: '/admin/ai-ayarlari', label: 'AI & WhatsApp', icon: '🤖' },
  { href: '/admin/engellenen', label: 'Engellenenler', icon: '🚫' },
]

export default function AdminSidebar() {
  const pathname = usePathname()
  const router = useRouter()

  const logout = async () => {
    await fetch('/api/admin/login', { method: 'DELETE' })
    router.push('/admin/login')
  }

  if (pathname === '/admin/login') return null

  return (
    <aside style={{
      width: 220, minWidth: 220, height: '100vh', position: 'sticky', top: 0,
      background: '#0f0a1e', display: 'flex', flexDirection: 'column',
      borderRight: '1px solid rgba(255,255,255,0.06)'
    }}>
      <div style={{ padding: '28px 20px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>⬛</div>
          <div>
            <p style={{ color: '#fff', fontWeight: 700, fontSize: 14, lineHeight: 1 }}>Event QR</p>
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 3 }}>Yönetim Paneli</p>
          </div>
        </div>
      </div>
      <nav style={{ flex: 1, padding: '16px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {nav.map(({ href, label, icon }) => {
          const active = pathname.startsWith(href)
          return (
            <Link key={href} href={href} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', borderRadius: 10, textDecoration: 'none',
              background: active ? 'rgba(124,58,237,0.2)' : 'transparent',
              border: active ? '1px solid rgba(124,58,237,0.3)' : '1px solid transparent',
              transition: 'all 0.15s'
            }}>
              <span style={{ fontSize: 16 }}>{icon}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: active ? '#a78bfa' : 'rgba(255,255,255,0.45)' }}>{label}</span>
            </Link>
          )
        })}
      </nav>
      <div style={{ padding: '12px 10px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <button onClick={logout} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 10, background: 'transparent', border: '1px solid transparent', cursor: 'pointer' }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.1)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
          <span style={{ fontSize: 16 }}>🚪</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.35)' }}>Çıkış Yap</span>
        </button>
      </div>
    </aside>
  )
}
