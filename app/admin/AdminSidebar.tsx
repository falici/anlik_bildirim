'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { QrCode, Building2, Calendar, ScanQrCode, LogOut } from 'lucide-react'

const nav = [
  { href: '/admin/kurumlar', label: 'Kurumlar', icon: Building2 },
  { href: '/admin/events', label: 'Etkinlikler', icon: Calendar },
  { href: '/admin/qr', label: 'QR Kodlar', icon: ScanQrCode },
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
    <aside className="w-56 shrink-0 bg-white border-r border-slate-200 flex flex-col">
      {/* Logo */}
      <div className="p-5 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <QrCode className="w-4 h-4 text-white" />
          </div>
          <div>
            <p className="font-semibold text-slate-900 text-sm leading-none">Event QR</p>
            <p className="text-xs text-slate-400 mt-0.5">Yönetim</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-1">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href)
          return (
            <Link key={href} href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                ${active ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}>
              <Icon className={`w-4 h-4 ${active ? 'text-indigo-600' : 'text-slate-400'}`} />
              {label}
            </Link>
          )
        })}
      </nav>

      {/* Logout */}
      <div className="p-3 border-t border-slate-100">
        <button onClick={logout}
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-red-50 hover:text-red-600 w-full transition-colors">
          <LogOut className="w-4 h-4" />
          Çıkış Yap
        </button>
      </div>
    </aside>
  )
}
