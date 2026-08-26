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

export default function KurumlarPage() {
  const [kurumlar, setKurumlar] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState({ ad: '', aciklama: '', whatsapp_no: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    const res = await fetch('/api/admin/kurumlar')
    if (res.ok) setKurumlar(await res.json())
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const openNew = () => { setEditing(null); setForm({ ad: '', aciklama: '', whatsapp_no: '' }); setShowForm(true); setError('') }
  const openEdit = (k: any) => { setEditing(k); setForm({ ad: k.ad, aciklama: k.aciklama || '', whatsapp_no: k.whatsapp_no || '' }); setShowForm(true); setError('') }

  const save = async () => {
    if (!form.ad.trim()) { setError('Kurum adı zorunlu'); return }
    setSaving(true)
    const res = await fetch('/api/admin/kurumlar', {
      method: editing ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editing ? { ...form, id: editing.id } : form)
    })
    setSaving(false)
    if (res.ok) { setShowForm(false); load() }
    else { const d = await res.json(); setError(d.error) }
  }

  const toggleAktif = async (k: any) => {
    await fetch('/api/admin/kurumlar', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: k.id, ad: k.ad, aktif: !k.aktif, whatsapp_no: k.whatsapp_no }) })
    load()
  }

  const remove = async (id: string) => {
    if (!confirm('Bu kurumu silmek istiyor musunuz?')) return
    await fetch(`/api/admin/kurumlar?id=${id}`, { method: 'DELETE' })
    load()
  }

  return (
    <div style={{ maxWidth: 760 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 28 }}>
        <div>
          <h1 style={s.pageTitle}>Kurumlar</h1>
          <p style={s.pageSubtitle}>{kurumlar.length} kurum kayıtlı</p>
        </div>
        <button onClick={openNew} style={s.btn}>+ Yeni Kurum</button>
      </div>

      {showForm && (
        <div style={s.overlay} onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div style={s.modal}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: '#0f0a1e' }}>{editing ? 'Kurumu Düzenle' : 'Yeni Kurum'}</h2>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#9ca3af' }}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div>
                <label style={s.label}>Kurum Adı *</label>
                <input style={s.input} value={form.ad} onChange={e => setForm({ ...form, ad: e.target.value })} placeholder="Örn: Flamingo Düğün Salonu" />
              </div>
              <div>
                <label style={s.label}>WhatsApp Numarası</label>
                <input style={s.input} value={form.whatsapp_no} onChange={e => setForm({ ...form, whatsapp_no: e.target.value })} placeholder="908502550939" />
                <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 5 }}>Başında 90 ile, boşluksuz. Müşteri bildirim gönderince bu numaraya yönlenir.</p>
              </div>
              <div>
                <label style={s.label}>Açıklama</label>
                <textarea style={{ ...s.input, resize: 'none' } as React.CSSProperties} rows={2} value={form.aciklama} onChange={e => setForm({ ...form, aciklama: e.target.value })} placeholder="İsteğe bağlı..." />
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
      ) : kurumlar.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <p style={{ fontSize: 40, marginBottom: 12 }}>🏢</p>
          <p style={{ color: '#9ca3af', fontSize: 14 }}>Henüz kurum eklenmemiş</p>
          <button onClick={openNew} style={{ ...s.btn, marginTop: 16 }}>+ İlk Kurumu Ekle</button>
        </div>
      ) : (
        kurumlar.map(k => (
          <div key={k.id} style={s.card}>
            <div style={s.avatar}>🏢</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontWeight: 700, fontSize: 14, color: '#0f0a1e', marginBottom: 4 }}>{k.ad}</p>
              {k.whatsapp_no && <p style={{ fontSize: 12, color: '#22c55e', marginBottom: 2 }}>💬 {k.whatsapp_no}</p>}
              {k.aciklama && <p style={{ fontSize: 12, color: '#9ca3af' }}>{k.aciklama}</p>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <button onClick={() => toggleAktif(k)} style={s.tag(k.aktif ? 'green' : 'gray') as React.CSSProperties}>
                {k.aktif ? '● Aktif' : '○ Pasif'}
              </button>
              <button onClick={() => openEdit(k)} style={s.iconBtn} title="Düzenle">✏️</button>
              <button onClick={() => remove(k.id)} style={{ ...s.iconBtn, borderColor: '#fecaca', color: '#ef4444' }} title="Sil">🗑️</button>
            </div>
          </div>
        ))
      )}
    </div>
  )
}
