'use client'
import { useState, useEffect } from 'react'
import { Kurum } from '@/types'

const s = {
  pageTitle: { fontSize: 22, fontWeight: 700, color: '#0f0a1e', marginBottom: 4 } as React.CSSProperties,
  pageSubtitle: { fontSize: 13, color: '#9ca3af', marginBottom: 28 } as React.CSSProperties,
  btn: { display: 'inline-flex', alignItems: 'center', gap: 8, background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', border: 'none', borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer' } as React.CSSProperties,
  card: { background: '#fff', border: '1px solid #ede9f8', borderRadius: 16, padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 16, marginBottom: 10 } as React.CSSProperties,
  avatar: { width: 42, height: 42, borderRadius: 12, background: '#f0eeff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 } as React.CSSProperties,
  tag: (color: string) => ({ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: color === 'green' ? '#dcfce7' : '#f3f4f6', color: color === 'green' ? '#166534' : '#6b7280' }) as React.CSSProperties,
  iconBtn: { background: 'none', border: '1px solid #e5e7eb', borderRadius: 8, padding: '6px 10px', cursor: 'pointer', fontSize: 14, color: '#6b7280' } as React.CSSProperties,
  overlay: { position: 'fixed', inset: 0, background: 'rgba(15,10,30,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 20 } as React.CSSProperties,
  modal: { background: '#fff', borderRadius: 20, padding: 28, width: '100%', maxWidth: 440, boxShadow: '0 24px 60px rgba(0,0,0,0.15)' } as React.CSSProperties,
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: '#6b7280', letterSpacing: '0.05em', textTransform: 'uppercase' as const, marginBottom: 8 },
  input: { width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 10, padding: '11px 14px', fontSize: 14, color: '#111', outline: 'none', boxSizing: 'border-box' as const, fontFamily: 'inherit' },
}

interface Personel {
  id: string
  kurum_id: string
  ad: string
  telefon: string
  rol?: string
  aktif: boolean
  kurum?: { id: string; ad: string }
}

export default function OperasyonPersonelPage() {
  const [personeller, setPersoneller] = useState<Personel[]>([])
  const [kurumlar, setKurumlar] = useState<Kurum[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Personel | null>(null)
  const [form, setForm] = useState({ kurum_id: '', ad: '', telefon: '', rol: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    const res = await fetch('/api/admin/operasyon-personel')
    if (res.ok) setPersoneller(await res.json())
    setLoading(false)
  }
  useEffect(() => {
    load()
    fetch('/api/admin/kurumlar').then(r => r.json()).then(setKurumlar)
  }, [])

  const openNew = () => { setEditing(null); setForm({ kurum_id: kurumlar[0]?.id || '', ad: '', telefon: '', rol: '' }); setShowForm(true); setError('') }
  const openEdit = (p: Personel) => { setEditing(p); setForm({ kurum_id: p.kurum_id, ad: p.ad, telefon: p.telefon, rol: p.rol || '' }); setShowForm(true); setError('') }

  const save = async () => {
    if (!form.kurum_id) { setError('Kurum seçimi zorunlu'); return }
    if (!form.ad.trim()) { setError('Ad zorunlu'); return }
    if (!form.telefon.trim()) { setError('Telefon zorunlu'); return }
    setSaving(true)
    const res = await fetch('/api/admin/operasyon-personel', {
      method: editing ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editing ? { ...form, id: editing.id, aktif: editing.aktif } : form)
    })
    setSaving(false)
    if (res.ok) { setShowForm(false); load() }
    else { const d = await res.json(); setError(d.error) }
  }

  const toggleAktif = async (p: Personel) => {
    await fetch('/api/admin/operasyon-personel', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: p.id, kurum_id: p.kurum_id, ad: p.ad, rol: p.rol, aktif: !p.aktif })
    })
    load()
  }

  const remove = async (id: string) => {
    if (!confirm('Bu personeli silmek istiyor musunuz?')) return
    await fetch(`/api/admin/operasyon-personel?id=${id}`, { method: 'DELETE' })
    load()
  }

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={s.pageTitle}>Operasyon Personeli</h1>
          <p style={s.pageSubtitle}>{personeller.length} personel kayıtlı · bu numaralar WhatsApp&apos;a yazınca bakım/onarım asistanına bağlanır</p>
        </div>
        <button onClick={openNew} style={s.btn} disabled={!kurumlar.length}>+ Yeni Personel</button>
      </div>

      {showForm && (
        <div style={s.overlay} onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div style={s.modal}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: '#0f0a1e' }}>{editing ? 'Personeli Düzenle' : 'Yeni Personel'}</h2>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#9ca3af' }}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={s.label}>Kurum *</label>
                <select style={s.input} value={form.kurum_id} onChange={e => setForm({ ...form, kurum_id: e.target.value })}>
                  <option value="">Seçiniz</option>
                  {kurumlar.map(k => <option key={k.id} value={k.id}>{k.ad}</option>)}
                </select>
              </div>
              <div>
                <label style={s.label}>Ad Soyad *</label>
                <input style={s.input} value={form.ad} onChange={e => setForm({ ...form, ad: e.target.value })} placeholder="Örn: Mehmet Yılmaz" />
              </div>
              <div>
                <label style={s.label}>Telefon *</label>
                <input style={s.input} value={form.telefon} onChange={e => setForm({ ...form, telefon: e.target.value })} placeholder="905XXXXXXXXX" />
              </div>
              <div>
                <label style={s.label}>Rol</label>
                <input style={s.input} value={form.rol} onChange={e => setForm({ ...form, rol: e.target.value })} placeholder="Örn: Elektrikçi, Temizlikçi, Teknisyen" />
              </div>
              {error && <p style={{ fontSize: 13, color: '#ef4444' }}>{error}</p>}
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button onClick={() => setShowForm(false)} style={{ flex: 1, border: '1.5px solid #e5e7eb', borderRadius: 10, padding: '11px', fontSize: 13, fontWeight: 600, color: '#6b7280', cursor: 'pointer', background: '#fff' }}>İptal</button>
                <button onClick={save} disabled={saving} style={{ flex: 1, background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', border: 'none', borderRadius: 10, padding: '11px', fontSize: 13, fontWeight: 700, color: '#fff', cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>{saving ? 'Kaydediliyor...' : 'Kaydet'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <p style={{ color: '#9ca3af', textAlign: 'center', padding: 40 }}>Yükleniyor...</p>
      ) : personeller.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <p style={{ fontSize: 40, marginBottom: 12 }}>🔧</p>
          <p style={{ color: '#9ca3af', fontSize: 14 }}>Henüz operasyon personeli eklenmemiş</p>
          <button onClick={openNew} style={{ ...s.btn, marginTop: 16 }} disabled={!kurumlar.length}>+ İlk Personeli Ekle</button>
        </div>
      ) : (
        personeller.map(p => (
          <div key={p.id} style={s.card}>
            <div style={s.avatar}>🔧</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontWeight: 700, fontSize: 14, color: '#0f0a1e', marginBottom: 4 }}>{p.ad}{p.rol ? ` · ${p.rol}` : ''}</p>
              <p style={{ fontSize: 12, color: '#22c55e', marginBottom: 2 }}>💬 {p.telefon}</p>
              <p style={{ fontSize: 12, color: '#9ca3af' }}>🏢 {p.kurum?.ad}</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <button onClick={() => toggleAktif(p)} style={s.tag(p.aktif ? 'green' : 'gray') as React.CSSProperties}>
                {p.aktif ? '● Aktif' : '○ Pasif'}
              </button>
              <button onClick={() => openEdit(p)} style={s.iconBtn} title="Düzenle">✏️</button>
              <button onClick={() => remove(p.id)} style={{ ...s.iconBtn, borderColor: '#fecaca', color: '#ef4444' }} title="Sil">🗑️</button>
            </div>
          </div>
        ))
      )}
    </div>
  )
}
