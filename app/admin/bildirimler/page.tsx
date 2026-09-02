'use client'
import { useState, useEffect, useCallback } from 'react'
import { Kurum } from '@/types'
import { format } from 'date-fns'
import { tr } from 'date-fns/locale'

interface Bildirim {
  id: string
  kayit_no?: string
  telefon: string
  kategoriler: string[]
  diger_not?: string
  ek_aciklama?: string
  kapatan_not?: string
  durum: 'acik' | 'kapali'
  tip?: 'misafir' | 'operasyon'
  medya_url?: string
  medya_tip?: string
  olusturulma: string
  kurum?: { id: string; ad: string }
  event?: { id: string; ad: string }
}

const formatDate = (d: string) =>
  format(new Date(new Date(d).getTime() + 3 * 60 * 60 * 1000), 'dd MMM HH:mm', { locale: tr })

export default function BildirimlerPage() {
  const [bildirimler, setBildirimler] = useState<Bildirim[]>([])
  const [kurumlar, setKurumlar] = useState<Kurum[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const [filterKurum, setFilterKurum] = useState('')
  const [filterDurum, setFilterDurum] = useState('acik')
  const [filterTip, setFilterTip] = useState<'misafir' | 'operasyon'>('misafir')
  const [lastRefresh, setLastRefresh] = useState(new Date())
  const [kapatanNot, setKapatanNot] = useState<Record<string, string>>({})
  const [showNotInput, setShowNotInput] = useState<string | null>(null)
  const [bilgilendir, setBilgilendir] = useState(true)

  const load = useCallback(async () => {
    const params = new URLSearchParams()
    if (filterKurum) params.set('kurum_id', filterKurum)
    if (filterDurum) params.set('durum', filterDurum)
    params.set('tip', filterTip)
    const res = await fetch(`/api/admin/bildirimler?${params}`)
    if (res.ok) setBildirimler(await res.json())
    setLoading(false)
    setLastRefresh(new Date())
  }, [filterKurum, filterDurum, filterTip])

  useEffect(() => { fetch('/api/admin/kurumlar').then(r => r.json()).then(setKurumlar) }, [])
  useEffect(() => { load() }, [load])
  useEffect(() => { const t = setInterval(load, 30000); return () => clearInterval(t) }, [load])

  const toggleDurum = async (b: Bildirim) => {
    const yeniDurum = b.durum === 'acik' ? 'kapali' : 'acik'

    // Kapatılıyorsa not iste
    if (yeniDurum === 'kapali') {
      setShowNotInput(b.id)
      setBilgilendir(true)
      return
    }

    setUpdating(b.id)
    await fetch('/api/admin/bildirimler', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: b.id, durum: yeniDurum })
    })
    setUpdating(null)
    load()
  }

  const kapat = async (b: Bildirim) => {
    setUpdating(b.id)
    await fetch('/api/admin/bildirimler', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: b.id, durum: 'kapali', kapatan_not: kapatanNot[b.id] || null, bilgilendir })
    })
    setUpdating(null)
    setShowNotInput(null)
    setKapatanNot(prev => { const n = { ...prev }; delete n[b.id]; return n })
    load()
  }

  const acik = bildirimler.filter(b => b.durum === 'acik').length
  const kapali = bildirimler.filter(b => b.durum === 'kapali').length

  const selectStyle = { border: '1.5px solid #e5e7eb', borderRadius: 10, padding: '8px 14px', fontSize: 13, color: '#374151', outline: 'none', background: '#fff', cursor: 'pointer' }

  return (
    <div style={{ maxWidth: 1400 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f0a1e', marginBottom: 4 }}>Bildirimler</h1>
          <p style={{ fontSize: 12, color: '#9ca3af' }}>
            Son: {format(lastRefresh, 'HH:mm:ss')} · otomatik yenileniyor
          </p>
        </div>
        <button onClick={load} style={{ border: '1.5px solid #e5e7eb', borderRadius: 10, padding: '9px 16px', fontSize: 13, fontWeight: 600, color: '#374151', cursor: 'pointer', background: '#fff' }}>
          🔄 Yenile
        </button>
      </div>

      {/* Tip sekmesi */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 20, background: '#f3f1fb', padding: 4, borderRadius: 12, width: 'fit-content' }}>
        {(['misafir', 'operasyon'] as const).map(tip => (
          <button key={tip} onClick={() => setFilterTip(tip)} style={{
            border: 'none', borderRadius: 9, padding: '8px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            background: filterTip === tip ? '#fff' : 'transparent',
            color: filterTip === tip ? '#6d28d9' : '#9ca3af',
            boxShadow: filterTip === tip ? '0 1px 4px rgba(0,0,0,0.08)' : 'none'
          }}>
            {tip === 'misafir' ? '💬 Misafir' : '🔧 Operasyon'}
          </button>
        ))}
      </div>

      {/* Özet */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 24, maxWidth: 500 }}>
        <div style={{ background: '#fff', border: '1px solid #ede9f8', borderRadius: 16, padding: '18px 20px' }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Açık</p>
          <p style={{ fontSize: 32, fontWeight: 800, color: '#dc2626' }}>{acik}</p>
        </div>
        <div style={{ background: '#fff', border: '1px solid #ede9f8', borderRadius: 16, padding: '18px 20px' }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Kapalı</p>
          <p style={{ fontSize: 32, fontWeight: 800, color: '#22c55e' }}>{kapali}</p>
        </div>
      </div>

      {/* Filtreler */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <select value={filterKurum} onChange={e => setFilterKurum(e.target.value)} style={selectStyle}>
          <option value="">🏢 Tüm Kurumlar</option>
          {kurumlar.map(k => <option key={k.id} value={k.id}>{k.ad}</option>)}
        </select>
        <select value={filterDurum} onChange={e => setFilterDurum(e.target.value)} style={selectStyle}>
          <option value="acik">🔴 Açık</option>
          <option value="kapali">✅ Kapalı</option>
          <option value="">📋 Tümü</option>
        </select>
      </div>

      {/* Liste */}
      {loading ? (
        <p style={{ color: '#9ca3af', textAlign: 'center', padding: 40 }}>Yükleniyor...</p>
      ) : bildirimler.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <p style={{ fontSize: 40, marginBottom: 12 }}>💬</p>
          <p style={{ color: '#9ca3af', fontSize: 14 }}>
            {filterDurum === 'acik' ? 'Açık bildirim yok' : filterDurum === 'kapali' ? 'Kapalı bildirim yok' : 'Bildirim yok'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {bildirimler.map(b => (
            <div key={b.id} style={{
              background: '#fff', border: `1px solid ${b.durum === 'acik' ? '#fecaca' : '#bbf7d0'}`,
              borderRadius: 16, padding: '16px', display: 'flex', flexDirection: 'column', gap: 8
            }}>
              {/* Üst — kayıt no + durum + saat */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                {b.kayit_no && (
                  <span style={{ background: '#f0eeff', color: '#6d28d9', fontSize: 11, fontWeight: 800, padding: '2px 8px', borderRadius: 20, fontFamily: 'monospace' }}>
                    {b.kayit_no}
                  </span>
                )}
                <span style={{ background: b.durum === 'acik' ? '#fef2f2' : '#f0fdf4', color: b.durum === 'acik' ? '#dc2626' : '#16a34a', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>
                  {b.durum === 'acik' ? '● Açık' : '✓ Kapalı'}
                </span>
                <span style={{ fontSize: 10, color: '#d1d5db', marginLeft: 'auto' }}>{formatDate(b.olusturulma)}</span>
              </div>

              {/* Kurum / etkinlik */}
              <div style={{ fontSize: 11, color: '#9ca3af' }}>
                🏢 {b.kurum?.ad}{b.event?.ad ? ` · 📅 ${b.event.ad}` : ''}
              </div>

              {/* Kategoriler */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {b.kategoriler.map(k => (
                  <span key={k} style={{ background: '#f0eeff', color: '#6d28d9', fontSize: 11, fontWeight: 600, padding: '3px 9px', borderRadius: 20 }}>{k}</span>
                ))}
              </div>

              {/* Misafir notu */}
              {b.diger_not && (
                <div style={{ background: '#f8f7ff', border: '1px solid #ede9f8', borderRadius: 10, padding: '7px 10px' }}>
                  <p style={{ fontSize: 12, color: '#6b7280', fontStyle: 'italic' }}>&quot;{b.diger_not}&quot;</p>
                </div>
              )}

              {/* Sonradan eklenen ek açıklama */}
              {b.ek_aciklama && (
                <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 10, padding: '7px 10px' }}>
                  <p style={{ fontSize: 10, color: '#92400e', fontWeight: 600, marginBottom: 2 }}>Ek Açıklama:</p>
                  <p style={{ fontSize: 12, color: '#78350f', whiteSpace: 'pre-line' }}>{b.ek_aciklama}</p>
                </div>
              )}

              {/* Operasyon fotoğrafı */}
              {b.medya_url && b.medya_tip?.startsWith('image/') && (
                <a href={b.medya_url} target="_blank" rel="noopener noreferrer">
                  <img src={b.medya_url} alt="Talep fotoğrafı" style={{ width: '100%', maxHeight: 140, borderRadius: 10, border: '1px solid #ede9f8', objectFit: 'cover' }} />
                </a>
              )}
              {b.medya_url && !b.medya_tip?.startsWith('image/') && (
                <a href={b.medya_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#6d28d9' }}>
                  📎 Ekli dosyayı görüntüle
                </a>
              )}

              {/* Kapatan notu */}
              {b.kapatan_not && (
                <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '7px 10px' }}>
                  <p style={{ fontSize: 10, color: '#15803d', fontWeight: 600, marginBottom: 2 }}>Çözüm Notu:</p>
                  <p style={{ fontSize: 12, color: '#166534' }}>{b.kapatan_not}</p>
                </div>
              )}

              {/* Telefon */}
              <p style={{ fontSize: 11, color: '#6b7280', fontWeight: 600 }}>📞 {b.telefon}</p>

              {/* Not input — kapanırken */}
              {showNotInput === b.id ? (
                <div>
                  <textarea
                    value={kapatanNot[b.id] || ''}
                    onChange={e => setKapatanNot(prev => ({ ...prev, [b.id]: e.target.value }))}
                    placeholder="Çözüm notu ekle (isteğe bağlı)..."
                    rows={2}
                    autoFocus
                    style={{ width: '100%', border: '1.5px solid #bbf7d0', borderRadius: 10, padding: '8px 12px', fontSize: 13, resize: 'none', outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit' }}
                  />
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#374151', margin: '8px 0' }}>
                    <input type="checkbox" checked={bilgilendir} onChange={e => setBilgilendir(e.target.checked)} />
                    Müşteriye WhatsApp&apos;tan bilgilendirme gönder
                  </label>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => setShowNotInput(null)}
                      style={{ flex: 1, border: '1.5px solid #e5e7eb', borderRadius: 8, padding: '7px', fontSize: 12, fontWeight: 600, color: '#6b7280', cursor: 'pointer', background: '#fff' }}>
                      İptal
                    </button>
                    <button onClick={() => kapat(b)} disabled={updating === b.id}
                      style={{ flex: 2, background: '#16a34a', border: 'none', borderRadius: 8, padding: '7px', fontSize: 12, fontWeight: 700, color: '#fff', cursor: 'pointer' }}>
                      {updating === b.id ? 'Kapatılıyor...' : '✓ Kapat'}
                    </button>
                  </div>
                </div>
              ) : (
                <button onClick={() => toggleDurum(b)} disabled={updating === b.id}
                  style={{
                    width: '100%',
                    background: b.durum === 'acik' ? '#f0fdf4' : '#fef2f2',
                    color: b.durum === 'acik' ? '#16a34a' : '#dc2626',
                    border: `1.5px solid ${b.durum === 'acik' ? '#bbf7d0' : '#fecaca'}`,
                    borderRadius: 10, padding: '9px 14px', fontSize: 12, fontWeight: 700,
                    cursor: updating === b.id ? 'not-allowed' : 'pointer',
                    opacity: updating === b.id ? 0.6 : 1
                  }}>
                  {updating === b.id ? '...' : b.durum === 'acik' ? '✓ Kapat' : '↩ Aç'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
