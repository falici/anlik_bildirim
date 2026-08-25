import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Event QR Yönetim',
  description: 'Etkinlik bazlı şikayet ve istek yönetim sistemi',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body style={{ fontFamily: "'Inter', system-ui, -apple-system, sans-serif" }}>
        {children}
      </body>
    </html>
  )
}
