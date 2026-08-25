'use client'
import { useState, useEffect, useRef } from 'react'
import { QrCode, RefreshCw, Download, Building2, ExternalLink } from 'lucide-react'
import { Kurum, QRKod } from '@/types'
import QRCodeLib from 'qrcode'

export default function QRPage() {
  const [kurumlar, setKurumlar] = useState<Kurum[]>([])
  const [qrlar, setQrlar] = useState<QRKod[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState<string | null>(null)
  const [qrImages, setQrImages] = useState<Record<string, string>>({})

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '')

  const load = async () => {
    const [kRes, qRes] = await Promise.all([
      fetch('/api/admin/kurumlar'),
      fetch('/api/admin/qr')
    ])
    const k = kRes.ok ? await kRes.json() : []
    const q = qRes.ok ? await qRes.json() : []
    setKurumlar(k)
    setQrlar(q)
    setLoading(false)

    // QR görsel üret
    const images: Record<string, string> = {}
    for (const qr of q) {
      const url = `${appUrl}/form/${qr.token}`
      images[qr.id] = await QRCodeLib.toDataURL(url, {
        width: 300,
        margin: 2,
        color: { dark: '#1e293b', light: '#ffffff' }
      })
    }
    setQrImages(images)
  }

  useEffect(() => { load() }, [])

  const generate = async (kurumId: string) => {
    setGenerating(kurumId)
    const res = await fetch('/api/admin/qr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kurum_id: kurumId })
    })
    setGenerating(null)
    if (res.ok) load()
  }

  const download = (kurumAd: string, dataUrl: string) => {
    const a = document.createElement('a')
    a.href = dataUrl
    a.download = `qr-${kurumAd.replace(/\s+/g, '-').toLowerCase()}.png`
    a.click()
  }

  const getQR = (kurumId: string) => qrlar.find(q => q.kurum_id === kurumId)

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">QR Kodlar</h1>
        <p className="text-sm text-slate-500 mt-0.5">Her kuruma ait tek bir QR kod. Okutulduğunda o anki aktif etkinliği açar.</p>
      </div>

      {loading ? (
        <div className="text-center py-16 text-slate-400">Yükleniyor...</div>
      ) : kurumlar.length === 0 ? (
        <div className="text-center py-16">
          <Building2 className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500">Önce kurum eklemeniz gerekiyor</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {kurumlar.map(k => {
            const qr = getQR(k.id)
            const imgUrl = qr ? qrImages[qr.id] : null
            const formUrl = qr ? `${appUrl}/form/${qr.token}` : null

            return (
              <div key={k.id} className="bg-white rounded-xl border border-slate-200 p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-9 h-9 bg-indigo-50 rounded-lg flex items-center justify-center">
                    <Building2 className="w-4 h-4 text-indigo-500" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-900 text-sm">{k.ad}</p>
                    <p className={`text-xs ${k.aktif ? 'text-green-600' : 'text-slate-400'}`}>
                      {k.aktif ? '● Aktif' : '○ Pasif'}
                    </p>
                  </div>
                </div>

                {qr && imgUrl ? (
                  <div className="space-y-4">
                    <div className="flex justify-center">
                      <div className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={imgUrl} alt="QR Kod" className="w-48 h-48" />
                      </div>
                    </div>
                    <div className="bg-slate-50 rounded-lg px-3 py-2">
                      <p className="text-xs text-slate-500 truncate font-mono">{formUrl}</p>
                    </div>
                    <div className="flex gap-2">
                      <a href={formUrl!} target="_blank" rel="noopener"
                        className="flex-1 flex items-center justify-center gap-1.5 border border-slate-200 text-slate-700 py-2 rounded-lg text-xs font-medium hover:bg-slate-50 transition-colors">
                        <ExternalLink className="w-3.5 h-3.5" /> Önizle
                      </a>
                      <button onClick={() => download(k.ad, imgUrl)}
                        className="flex-1 flex items-center justify-center gap-1.5 border border-slate-200 text-slate-700 py-2 rounded-lg text-xs font-medium hover:bg-slate-50 transition-colors">
                        <Download className="w-3.5 h-3.5" /> İndir
                      </button>
                      <button onClick={() => generate(k.id)} disabled={generating === k.id}
                        className="flex items-center justify-center gap-1.5 border border-orange-200 text-orange-700 bg-orange-50 hover:bg-orange-100 py-2 px-3 rounded-lg text-xs font-medium transition-colors disabled:opacity-60">
                        <RefreshCw className={`w-3.5 h-3.5 ${generating === k.id ? 'animate-spin' : ''}`} />
                        Yenile
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center py-6">
                    <div className="w-24 h-24 bg-slate-100 rounded-xl flex items-center justify-center mb-4">
                      <QrCode className="w-10 h-10 text-slate-300" />
                    </div>
                    <p className="text-sm text-slate-500 mb-4 text-center">Bu kurum için QR kod henüz oluşturulmadı</p>
                    <button onClick={() => generate(k.id)} disabled={generating === k.id}
                      className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                      <QrCode className="w-4 h-4" />
                      {generating === k.id ? 'Oluşturuluyor...' : 'QR Oluştur'}
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
