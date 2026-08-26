'use client'
import { useState, useEffect, useCallback } from 'react'
import { Kurum } from '@/types'
import { format } from 'date-fns'
import { tr } from 'date-fns/locale'

type Durum = 'beklemede' | 'isleniyor' | 'tamamlandi'

interface Bildirim {
  id: string
  telefon: string
  kategoriler: string[]
  diger_not?: string
  durum: Durum
  olusturulma: string
  kurum?: { id: string; ad: string }
  event?: { id: string; ad: string }
}

const durumCfg = {
  beklemede:  { label: 'Beklemede',  bg: '#fef9c3', color: '#854d0e', dot: '#eab308' },
  isleniyor:  { label: 'İşleniyor',  bg: '#dbeafe', color: '#1e40af', dot: '#3b82f6' },
  tamamlandi: { label: 'Tamamlandı', bg: '#dcfce7', color: '#166534', dot: '#22c55e' },
}
const nextDurum: Record<Durum, Durum> = { beklemede: 'isleniyor', isleniyor: 'tamamlandi', tamamlandi: 'beklemede' }
const nextLabel: Record<Durum, string> = { beklemede: '▶ İşleme Al', isleniyor: '✓ Tamamlandı', tamamlandi: '↩ Yeniden Aç' }

export default function BildirimlerPage() {
  const [bildirimler, setBildirimler] = useState<Bildirim[]>([])
  const [kurumlar, setKurumlar] = useState<Kurum[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)
  const [filterKurum, setFilterKurum] = useState('')
  const [filterDurum, setFilterDurum] = useState('')
  const [lastRefresh, setLastRefresh] = useState(new Date())

  const load = useCallback(async () => {
    const params = new URLSearchParams()
    if (filterKurum) params.set('kurum_id', filterKurum)
    if (filterDurum) params.set('durum', filterDurum)
    const res = await fetch(`/api/admin/bildirimler?${params}`)
    if (res.ok) setBildirimler(await res.json())
    setLoading(false); setLastRefresh(new Date())
  }, [filterKurum, filterDurum])

  useEffect(() => { fetch('/api/admin/kurumlar').then(r => r.json()).then(setKurumlar) }, [])
  useEffect(() => { load() }, [load])
  useEffect(() => { const t = setInterval(load, 30000); return () => clearInterval(t) }, [load])

  const changeDurum = async (b: Bildirim) => {
    setUpdating(b.id)
    await fetch('/api/admin/bildirimler', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: b.id, durum: nextDurum[b.durum] }) })
    setUpdating(null); load()
  }

  const bekleyen = bildirimler.filter(b => b.durum === 'beklemede').length
  const islenen = bildirimler.filter(b => b.durum === 'isleniyor').length
  const tamamlanan = bildirimler.filter(b => b.durum === 'tamamlandi').length

  const selectStyle = { border: '1.5px solid #e5e7eb', borderRadius: 10, padding: '8px 14px', fontSize: 13, color: '#374151', outline: 'none', background: '#fff', cursor: 'pointer' }

  return (
    <div style={{ maxWidth: 820 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f0a1e', marginBottom: 4 }}>Bildirimler</h1>
          <p style={{ fontSize: 12, color: '#9ca3af' }}>
            Son güncelleme: {format(lastRefresh, 'HH:mm:ss')} · 30 sn'de bir yenileniyor
          </p>
        </div>
        <button onClick={load} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: '1.5px solid #e5e7eb', borderRadius: 10, padding: '9px 16px', fontSize: 13, fontWeight: 600, color: '#374151', cursor: 'pointer', background: '#fff' }}>
          🔄 Yenile
        </button>
      </div>

      {/* Özet */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Beklemede', count: bekleyen, bg: '#fef9c3', color: '#854d0e' },
          { label: 'İşleniyor', count: islenen, bg: '#dbeafe', color: '#1e40af' },
          { label: 'Tamamlandı', count: tamamlanan, bg: '#dcfce7', color: '#166534' },
        ].map(s => (
          <div key={s.label} style={{ background: '#fff', border: '1px solid #ede9f8', borderRadius: 16, padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{s.label}</p>
              <span style={{ background: s.bg, color: s.color, fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20 }}>●</span>
            </div>
            <p style={{ fontSize: 32, fontWeight: 800, color: s.color, marginTop: 8, lineHeight: 1 }}>{s.count}</p>
          </div>
        ))}
      </div>

      {/* Filtreler */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <select value={filterKurum} onChange={e => setFilterKurum(e.target.value)} style={selectStyle}>
          <option value="">🏢 Tüm Kurumlar</option>
          {kurumlar.map(k => <option key={k.id} value={k.id}>{k.ad}</option>)}
        </select>
        <select value={filterDurum} onChange={e => setFilterDurum(e.target.value)} style={selectStyle}>
          <option value="">🔘 Tüm Durumlar</option>
          <option value="beklemede">Beklemede</option>
          <option value="isleniyor">İşleniyor</option>
          <option value="tamamlandi">Tamamlandı</option>
        </select>
      </div>

      {/* Liste */}
      {loading ? (
        <p style={{ color: '#9ca3af', textAlign: 'center', padding: 40 }}>Yükleniyor...</p>
      ) : bildirimler.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <p style={{ fontSize: 40, marginBottom: 12 }}>💬</p>
          <p style={{ color: '#9ca3af', fontSize: 14 }}>Henüz bildirim yok</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {bildirimler.map(b => {
            const cfg = durumCfg[b.durum]
            return (
              <div key={b.id} style={{ background: '#fff', border: '1px solid #ede9f8', borderRadius: 16, padding: '18px 20px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {/* Üst */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
                      <span style={{ background: cfg.bg, color: cfg.color, fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>
                        ● {cfg.label}
                      </span>
                      <span style={{ fontSize: 12, color: '#9ca3af' }}>🏢 {b.kurum?.ad}</span>
                      <span style={{ fontSize: 12, color: '#9ca3af' }}>📅 {b.event?.ad}</span>
                    </div>

                    {/* Kategoriler */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: b.diger_not ? 10 : 0 }}>
                      {b.kategoriler.map(k => (
                        <span key={k} style={{ background: '#f0eeff', color: '#6d28d9', fontSize: 12, fontWeight: 600, padding: '4px 12px', borderRadius: 20 }}>{k}</span>
                      ))}
                    </div>

                    {/* Not */}
                    {b.diger_not && (
                      <div style={{ background: '#f8f7ff', border: '1px solid #ede9f8', borderRadius: 10, padding: '10px 14px', marginBottom: 10 }}>
                        <p style={{ fontSize: 13, color: '#6b7280', fontStyle: 'italic' }}>"{b.diger_not}"</p>
                      </div>
                    )}

                    {/* Alt */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 12, color: '#6b7280', fontWeight: 600 }}>📞 {b.telefon}</span>
                      <span style={{ fontSize: 11, color: '#d1d5db' }}>
                        {format(new Date(b.olusturulma), 'dd MMM HH:mm', { locale: tr })}
                      </span>
                    </div>
                  </div>

                  {/* Aksiyon */}
                  <button onClick={() => changeDurum(b)} disabled={updating === b.id}
                    style={{
                      flexShrink: 0, background: cfg.bg, color: cfg.color,
                      border: `1.5px solid ${cfg.dot}30`, borderRadius: 10,
                      padding: '9px 16px', fontSize: 12, fontWeight: 700,
                      cursor: updating === b.id ? 'not-allowed' : 'pointer',
                      opacity: updating === b.id ? 0.6 : 1, whiteSpace: 'nowrap'
                    }}>
                    {updating === b.id ? '...' : nextLabel[b.durum]}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
