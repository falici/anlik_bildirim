'use client'
import { useState, useEffect } from 'react'
import { Event, Kurum } from '@/types'
import { format } from 'date-fns'
import { tr } from 'date-fns/locale'

const s = {
  pageTitle: { fontSize: 22, fontWeight: 700, color: '#0f0a1e', marginBottom: 4 } as React.CSSProperties,
  pageSubtitle: { fontSize: 13, color: '#9ca3af', marginBottom: 28 } as React.CSSProperties,
  btn: { display: 'inline-flex', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', border: 'none', borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer' } as React.CSSProperties,
  card: { background: '#fff', border: '1px solid #ede9f8', borderRadius: 16, padding: '18px 20px', marginBottom: 10 } as React.CSSProperties,
  overlay: { position: 'fixed', inset: 0, background: 'rgba(15,10,30,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 20 } as React.CSSProperties,
  modal: { background: '#fff', borderRadius: 20, padding: 28, width: '100%', maxWidth: 500, boxShadow: '0 24px 60px rgba(0,0,0,0.15)', maxHeight: '90vh', overflowY: 'auto' as const } as React.CSSProperties,
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: '#6b7280', letterSpacing: '0.05em', textTransform: 'uppercase' as const, marginBottom: 8 },
  input: { width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 10, padding: '11px 14px', fontSize: 14, color: '#111', outline: 'none', boxSizing: 'border-box' as const, fontFamily: 'inherit' },
  iconBtn: { background: 'none', border: '1px solid #e5e7eb', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 14, color: '#6b7280' } as React.CSSProperties,
}

export default function EventsPage() {
  const [events, setEvents] = useState<any[]>([])
  const [kurumlar, setKurumlar] = useState<Kurum[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [filterKurum, setFilterKurum] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({ kurum_id: '', ad: '', aciklama: '', baslangic: '', bitis: '', konum: '' })

  const load = async () => {
    const [evRes, kRes] = await Promise.all([fetch('/api/admin/events'), fetch('/api/admin/kurumlar')])
    if (evRes.ok) setEvents(await evRes.json())
    if (kRes.ok) setKurumlar(await kRes.json())
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const openNew = () => { setEditing(null); setForm({ kurum_id: filterKurum, ad: '', aciklama: '', baslangic: '', bitis: '', konum: '' }); setShowForm(true); setError('') }
  const openEdit = (ev: any) => {
    setEditing(ev)
    setForm({ kurum_id: ev.kurum_id, ad: ev.ad, aciklama: ev.aciklama || '', baslangic: ev.baslangic.slice(0, 16), bitis: ev.bitis.slice(0, 16), konum: ev.konum || '' })
    setShowForm(true); setError('')
  }

  const save = async () => {
    if (!form.kurum_id || !form.ad || !form.baslangic || !form.bitis) { setError('Zorunlu alanları doldurun'); return }
    setSaving(true)
    const res = await fetch('/api/admin/events', {
      method: editing ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editing ? { ...form, id: editing.id } : form)
    })
    setSaving(false)
    if (res.ok) { setShowForm(false); load() }
    else { const d = await res.json(); setError(d.error) }
  }

  const toggleAktif = async (ev: any) => {
    await fetch('/api/admin/events', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: ev.id, ad: ev.ad, baslangic: ev.baslangic, bitis: ev.bitis, kurum_id: ev.kurum_id, aktif: !ev.aktif }) })
    load()
  }

  const remove = async (id: string) => {
    if (!confirm('Bu etkinliği silmek istiyor musunuz?')) return
    await fetch(`/api/admin/events?id=${id}`, { method: 'DELETE' })
    load()
  }

  const isActive = (ev: any) => {
    const now = new Date()
    return new Date(ev.baslangic) <= now && new Date(ev.bitis) >= now && ev.aktif
  }

  const filtered = filterKurum ? events.filter(e => e.kurum_id === filterKurum) : events

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={s.pageTitle}>Etkinlikler</h1>
          <p style={s.pageSubtitle}>{filtered.length} etkinlik</p>
        </div>
        <button onClick={openNew} style={s.btn}>+ Yeni Etkinlik</button>
      </div>

      {/* Filtre */}
      <div style={{ marginBottom: 20 }}>
        <select value={filterKurum} onChange={e => setFilterKurum(e.target.value)}
          style={{ border: '1.5px solid #e5e7eb', borderRadius: 10, padding: '9px 14px', fontSize: 13, color: '#374151', outline: 'none', background: '#fff', cursor: 'pointer' }}>
          <option value="">Tüm Kurumlar</option>
          {kurumlar.map(k => <option key={k.id} value={k.id}>{k.ad}</option>)}
        </select>
      </div>

      {showForm && (
        <div style={s.overlay} onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div style={s.modal}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: '#0f0a1e' }}>{editing ? 'Etkinliği Düzenle' : 'Yeni Etkinlik'}</h2>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#9ca3af' }}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={s.label}>Kurum *</label>
                <select value={form.kurum_id} onChange={e => setForm({ ...form, kurum_id: e.target.value })}
                  style={{ ...s.input, cursor: 'pointer' }}>
                  <option value="">Seçin...</option>
                  {kurumlar.filter(k => k.aktif).map(k => <option key={k.id} value={k.id}>{k.ad}</option>)}
                </select>
              </div>
              <div>
                <label style={s.label}>Etkinlik Adı *</label>
                <input style={s.input} value={form.ad} onChange={e => setForm({ ...form, ad: e.target.value })} placeholder="Ahmet & Ayşe Düğün Töreni" />
              </div>
              <div className="grid-cols-1 sm:grid-cols-2" style={{ display: 'grid', gap: 12 }}>
                <div>
                  <label style={s.label}>Başlangıç *</label>
                  <input type="datetime-local" style={s.input} value={form.baslangic} onChange={e => setForm({ ...form, baslangic: e.target.value })} />
                </div>
                <div>
                  <label style={s.label}>Bitiş *</label>
                  <input type="datetime-local" style={s.input} value={form.bitis} onChange={e => setForm({ ...form, bitis: e.target.value })} />
                </div>
              </div>
              <div>
                <label style={s.label}>Konum</label>
                <input style={s.input} value={form.konum} onChange={e => setForm({ ...form, konum: e.target.value })} placeholder="Salon A, 2. Kat" />
              </div>
              <div>
                <label style={s.label}>Açıklama</label>
                <textarea style={{ ...s.input, resize: 'none' } as React.CSSProperties} rows={2} value={form.aciklama} onChange={e => setForm({ ...form, aciklama: e.target.value })} />
              </div>
              {error && <p style={{ fontSize: 13, color: '#ef4444' }}>{error}</p>}
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setShowForm(false)} style={{ flex: 1, border: '1.5px solid #e5e7eb', borderRadius: 10, padding: '11px', fontSize: 13, fontWeight: 600, color: '#6b7280', cursor: 'pointer', background: '#fff' }}>İptal</button>
                <button onClick={save} disabled={saving} style={{ flex: 1, background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', border: 'none', borderRadius: 10, padding: '11px', fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <p style={{ color: '#9ca3af', textAlign: 'center', padding: 40 }}>Yükleniyor...</p>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <p style={{ fontSize: 40, marginBottom: 12 }}>📅</p>
          <p style={{ color: '#9ca3af', fontSize: 14 }}>Henüz etkinlik eklenmemiş</p>
        </div>
      ) : (
        filtered.map(ev => (
          <div key={ev.id} style={s.card}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: isActive(ev) ? '#dcfce7' : '#f3f4f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>
                {isActive(ev) ? '🟢' : '📅'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 6 }}>
                  <p style={{ fontWeight: 700, fontSize: 14, color: '#0f0a1e' }}>{ev.ad}</p>
                  {isActive(ev) && <span style={{ fontSize: 11, fontWeight: 700, background: '#dcfce7', color: '#166534', padding: '2px 10px', borderRadius: 20 }}>🔴 Canlı</span>}
                  <span style={{ fontSize: 11, color: '#9ca3af' }}>{ev.kurum?.ad}</span>
                </div>
                <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 2 }}>
                  📅 {format(new Date(ev.baslangic), 'dd MMM yy HH:mm', { locale: tr })} → {format(new Date(ev.bitis), 'dd MMM yy HH:mm', { locale: tr })}
                </p>
                {ev.konum && <p style={{ fontSize: 12, color: '#9ca3af' }}>📍 {ev.konum}</p>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <button onClick={() => toggleAktif(ev)}
                  style={{ fontSize: 11, fontWeight: 700, padding: '4px 12px', borderRadius: 20, border: 'none', cursor: 'pointer', background: ev.aktif ? '#dcfce7' : '#f3f4f6', color: ev.aktif ? '#166534' : '#6b7280' }}>
                  {ev.aktif ? '● Aktif' : '○ Pasif'}
                </button>
                <button onClick={() => openEdit(ev)} style={s.iconBtn}>✏️</button>
                <button onClick={() => remove(ev.id)} style={{ ...s.iconBtn, borderColor: '#fecaca', color: '#ef4444' }}>🗑️</button>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  )
}
