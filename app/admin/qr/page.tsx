'use client'
import { useState, useEffect } from 'react'
import { Kurum, QRKod } from '@/types'
import QRCodeLib from 'qrcode'

export default function QRPage() {
  const [kurumlar, setKurumlar] = useState<Kurum[]>([])
  const [qrlar, setQrlar] = useState<QRKod[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState<string | null>(null)
  const [qrImages, setQrImages] = useState<Record<string, string>>({})
  const appUrl = typeof window !== 'undefined' ? window.location.origin : ''

  const load = async () => {
    const [kRes, qRes] = await Promise.all([fetch('/api/admin/kurumlar'), fetch('/api/admin/qr')])
    const k = kRes.ok ? await kRes.json() : []
    const q = qRes.ok ? await qRes.json() : []
    setKurumlar(k); setQrlar(q); setLoading(false)
    const images: Record<string, string> = {}
    for (const qr of q) {
      images[qr.id] = await QRCodeLib.toDataURL(`${appUrl}/form/${qr.token}`, {
        width: 280, margin: 2, color: { dark: '#0f0a1e', light: '#ffffff' }
      })
    }
    setQrImages(images)
  }
  useEffect(() => { load() }, [])

  const generate = async (kurumId: string) => {
    setGenerating(kurumId)
    await fetch('/api/admin/qr', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ kurum_id: kurumId }) })
    setGenerating(null); load()
  }

  const download = (kurumAd: string, dataUrl: string) => {
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `qr-${kurumAd.replace(/\s+/g, '-').toLowerCase()}.png`
    a.click()
  }

  const getQR = (kurumId: string) => qrlar.find(q => q.kurum_id === kurumId)

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f0a1e', marginBottom: 4 }}>QR Kodlar</h1>
        <p style={{ fontSize: 13, color: '#9ca3af' }}>Her kuruma ait tek QR. Okutulduğunda o anki aktif etkinliği açar.</p>
      </div>

      {loading ? (
        <p style={{ color: '#9ca3af', textAlign: 'center', padding: 40 }}>Yükleniyor...</p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {kurumlar.map(k => {
            const qr = getQR(k.id)
            const img = qr ? qrImages[qr.id] : null
            const url = qr ? `${appUrl}/form/${qr.token}` : null
            return (
              <div key={k.id} style={{ background: '#fff', border: '1px solid #ede9f8', borderRadius: 20, padding: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 12, background: '#f0eeff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>🏢</div>
                  <div>
                    <p style={{ fontWeight: 700, fontSize: 14, color: '#0f0a1e' }}>{k.ad}</p>
                    <p style={{ fontSize: 11, color: k.aktif ? '#22c55e' : '#9ca3af', fontWeight: 600 }}>{k.aktif ? '● Aktif' : '○ Pasif'}</p>
                  </div>
                </div>

                {qr && img ? (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
                      <div style={{ background: '#f8f7ff', borderRadius: 16, padding: 16, border: '1px solid #ede9f8' }}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={img} alt="QR" style={{ width: 160, height: 160, display: 'block' }} />
                      </div>
                    </div>
                    <div style={{ background: '#f8f7ff', borderRadius: 10, padding: '8px 12px', marginBottom: 14 }}>
                      <p style={{ fontSize: 11, color: '#9ca3af', fontFamily: 'monospace', wordBreak: 'break-all' }}>{url}</p>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <a href={url!} target="_blank" rel="noopener" style={{ flex: 1, border: '1.5px solid #e5e7eb', borderRadius: 10, padding: '9px', fontSize: 12, fontWeight: 600, color: '#374151', textAlign: 'center', textDecoration: 'none' }}>
                        🔗 Önizle
                      </a>
                      <button onClick={() => download(k.ad, img)} style={{ flex: 1, border: '1.5px solid #e5e7eb', borderRadius: 10, padding: '9px', fontSize: 12, fontWeight: 600, color: '#374151', cursor: 'pointer', background: '#fff' }}>
                        ⬇️ İndir
                      </button>
                      <button onClick={() => generate(k.id)} disabled={generating === k.id} style={{ flex: 1, border: '1.5px solid #fde68a', borderRadius: 10, padding: '9px', fontSize: 12, fontWeight: 600, color: '#92400e', cursor: 'pointer', background: '#fef9c3', opacity: generating === k.id ? 0.6 : 1 }}>
                        {generating === k.id ? '...' : '🔄 Yenile'}
                      </button>
                    </div>
                  </>
                ) : (
                  <div style={{ textAlign: 'center', padding: '24px 0' }}>
                    <p style={{ fontSize: 40, marginBottom: 12 }}>⬛</p>
                    <p style={{ fontSize: 13, color: '#9ca3af', marginBottom: 16 }}>QR kodu henüz oluşturulmadı</p>
                    <button onClick={() => generate(k.id)} disabled={generating === k.id}
                      style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer', opacity: generating === k.id ? 0.7 : 1 }}>
                      {generating === k.id ? 'Oluşturuluyor...' : '⬛ QR Oluştur'}
                    </button>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
