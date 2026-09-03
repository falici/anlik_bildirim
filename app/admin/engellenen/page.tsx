'use client'
import { useState, useEffect } from 'react'

interface Engellenen {
  id: string
  telefon: string
  sebep?: string
  olusturulma: string
  kurum?: { id: string; ad: string }
}

export default function EngellenenPage() {
  const [liste, setListe] = useState<Engellenen[]>([])
  const [kurumlar, setKurumlar] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ kurum_id: '', telefon: '', sebep: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [filterKurum, setFilterKurum] = useState('')

  const load = async () => {
    const params = filterKurum ? `?kurum_id=${filterKurum}` : ''
    const res = await fetch(`/api/admin/engellenen${params}`)
    if (res.ok) setListe(await res.json())
    setLoading(false)
  }

  useEffect(() => {
    fetch('/api/admin/kurumlar').then(r => r.json()).then(setKurumlar)
  }, [])
  useEffect(() => { load() }, [filterKurum])

  const ekle = async () => {
    if (!form.kurum_id || !form.telefon.trim()) { setError('Kurum ve telefon zorunlu'); return }
    setSaving(true); setError('')
    const res = await fetch('/api/admin/engellenen', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    })
    setSaving(false)
    if (res.ok) { setForm({ kurum_id: '', telefon: '', sebep: '' }); load() }
    else { const d = await res.json(); setError(d.error) }
  }

  const kaldir = async (id: string) => {
    if (!confirm('Bu engeli kaldırmak istiyor musunuz?')) return
    await fetch(`/api/admin/engellenen?id=${id}`, { method: 'DELETE' })
    load()
  }

  const s = {
    card: { background: '#fff', border: '1px solid #ede9f8', borderRadius: 16, padding: '18px 20px', marginBottom: 10 } as React.CSSProperties,
    input: { width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#111', outline: 'none', boxSizing: 'border-box' as const, fontFamily: 'inherit' },
    label: { display: 'block', fontSize: 11, fontWeight: 600 as const, color: '#6b7280', letterSpacing: '0.05em', textTransform: 'uppercase' as const, marginBottom: 6 },
  }

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f0a1e', marginBottom: 4 }}>🚫 Engellenen Numaralar</h1>
        <p style={{ fontSize: 13, color: '#9ca3af' }}>Engellenen numaralardan gelen WA mesajları yanıtsız bırakılır.</p>
      </div>

      {/* Yeni engel ekle */}
      <div style={{ background: '#fff', border: '1px solid #ede9f8', borderRadius: 16, padding: 24, marginBottom: 24 }}>
        <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0f0a1e', marginBottom: 16 }}>Numara Engelle</h3>
        <div className="grid-cols-1 sm:grid-cols-2" style={{ display: 'grid', gap: 14, marginBottom: 14 }}>
          <div>
            <label style={s.label}>Kurum *</label>
            <select value={form.kurum_id} onChange={e => setForm({ ...form, kurum_id: e.target.value })}
              style={{ ...s.input, cursor: 'pointer' }}>
              <option value="">Seçin...</option>
              {kurumlar.map(k => <option key={k.id} value={k.id}>{k.ad}</option>)}
            </select>
          </div>
          <div>
            <label style={s.label}>Telefon *</label>
            <input style={s.input} value={form.telefon}
              onChange={e => setForm({ ...form, telefon: e.target.value })}
              placeholder="905XXXXXXXXX" />
          </div>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={s.label}>Engel Sebebi</label>
          <input style={s.input} value={form.sebep}
            onChange={e => setForm({ ...form, sebep: e.target.value })}
            placeholder="Örn: Sahte talep, spam" />
        </div>
        {error && <p style={{ fontSize: 13, color: '#ef4444', marginBottom: 10 }}>{error}</p>}
        <button onClick={ekle} disabled={saving}
          style={{ background: '#dc2626', border: 'none', borderRadius: 10, padding: '10px 24px', fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
          {saving ? 'Ekleniyor...' : '🚫 Engelle'}
        </button>
      </div>

      {/* Filtre */}
      <div style={{ marginBottom: 16 }}>
        <select value={filterKurum} onChange={e => setFilterKurum(e.target.value)}
          style={{ border: '1.5px solid #e5e7eb', borderRadius: 10, padding: '8px 14px', fontSize: 13, color: '#374151', outline: 'none', background: '#fff', cursor: 'pointer' }}>
          <option value="">🏢 Tüm Kurumlar</option>
          {kurumlar.map(k => <option key={k.id} value={k.id}>{k.ad}</option>)}
        </select>
      </div>

      {/* Liste */}
      {loading ? (
        <p style={{ color: '#9ca3af', textAlign: 'center', padding: 40 }}>Yükleniyor...</p>
      ) : liste.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <p style={{ fontSize: 36, marginBottom: 12 }}>✅</p>
          <p style={{ color: '#9ca3af', fontSize: 14 }}>Engellenen numara yok</p>
        </div>
      ) : (
        liste.map(e => (
          <div key={e.id} style={s.card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <span style={{ fontWeight: 700, fontSize: 14, color: '#0f0a1e', fontFamily: 'monospace' }}>
                    {e.telefon}
                  </span>
                  <span style={{ fontSize: 11, color: '#9ca3af' }}>— {e.kurum?.ad}</span>
                </div>
                {e.sebep && <p style={{ fontSize: 12, color: '#6b7280' }}>Sebep: {e.sebep}</p>}
                <p style={{ fontSize: 11, color: '#d1d5db', marginTop: 2 }}>
                  {new Date(new Date(e.olusturulma).getTime() + 3 * 60 * 60 * 1000).toLocaleString('tr-TR')}
                </p>
              </div>
              <button onClick={() => kaldir(e.id)}
                style={{ background: '#fef2f2', border: '1.5px solid #fecaca', borderRadius: 10, padding: '8px 16px', fontSize: 12, fontWeight: 700, color: '#dc2626', cursor: 'pointer' }}>
                Engeli Kaldır
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  )
}
