'use client'
import { useState, useEffect } from 'react'
import { Plus, Pencil, Trash2, Building2, X, ToggleLeft, ToggleRight } from 'lucide-react'
import { Kurum } from '@/types'

export default function KurumlarPage() {
  const [kurumlar, setKurumlar] = useState<Kurum[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Kurum | null>(null)
  const [form, setForm] = useState({ ad: '', aciklama: '', whatsapp_no: '' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = async () => {
    const res = await fetch('/api/admin/kurumlar')
    if (res.ok) setKurumlar(await res.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openNew = () => {
    setEditing(null)
    setForm({ ad: '', aciklama: '', whatsapp_no: '' })
    setShowForm(true); setError('')
  }

  const openEdit = (k: any) => {
    setEditing(k)
    setForm({ ad: k.ad, aciklama: k.aciklama || '', whatsapp_no: k.whatsapp_no || '' })
    setShowForm(true); setError('')
  }

  const save = async () => {
    if (!form.ad.trim()) { setError('Kurum adı zorunlu'); return }
    setSaving(true)
    const method = editing ? 'PUT' : 'POST'
    const body = editing ? { ...form, id: editing.id } : form
    const res = await fetch('/api/admin/kurumlar', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    setSaving(false)
    if (res.ok) { setShowForm(false); load() }
    else { const d = await res.json(); setError(d.error) }
  }

  const toggleAktif = async (k: any) => {
    await fetch('/api/admin/kurumlar', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: k.id, ad: k.ad, aktif: !k.aktif, whatsapp_no: k.whatsapp_no })
    })
    load()
  }

  const remove = async (id: string) => {
    if (!confirm('Bu kurumu silmek istiyor musunuz?')) return
    await fetch(`/api/admin/kurumlar?id=${id}`, { method: 'DELETE' })
    load()
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Kurumlar</h1>
          <p className="text-sm text-slate-500 mt-0.5">{kurumlar.length} kurum kayıtlı</p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          <Plus className="w-4 h-4" /> Yeni Kurum
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-slate-900">{editing ? 'Kurumu Düzenle' : 'Yeni Kurum'}</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Kurum Adı *</label>
                <input type="text" value={form.ad} onChange={e => setForm({ ...form, ad: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Örn: Flamingo Düğün Salonu" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  WhatsApp Yönlendirme Numarası
                </label>
                <input type="tel" value={form.whatsapp_no} onChange={e => setForm({ ...form, whatsapp_no: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="905XXXXXXXXX (başında 90 ile)" />
                <p className="text-xs text-slate-400 mt-1">Müşteri formu gönderince bu numaraya WhatsApp açılır</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Açıklama</label>
                <textarea value={form.aciklama} onChange={e => setForm({ ...form, aciklama: e.target.value })}
                  rows={2}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  placeholder="İsteğe bağlı..." />
              </div>
              {error && <p className="text-red-600 text-sm">{error}</p>}
              <div className="flex gap-3 pt-1">
                <button onClick={() => setShowForm(false)}
                  className="flex-1 border border-slate-200 text-slate-700 py-2.5 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
                  İptal
                </button>
                <button onClick={save} disabled={saving}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white py-2.5 rounded-lg text-sm font-medium transition-colors">
                  {saving ? 'Kaydediliyor...' : 'Kaydet'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-slate-400">Yükleniyor...</div>
      ) : kurumlar.length === 0 ? (
        <div className="text-center py-16">
          <Building2 className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500">Henüz kurum eklenmemiş</p>
          <button onClick={openNew} className="mt-4 text-indigo-600 text-sm font-medium hover:underline">
            İlk kurumu ekle →
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {kurumlar.map((k: any) => (
            <div key={k.id} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4">
              <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center shrink-0">
                <Building2 className="w-5 h-5 text-indigo-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-slate-900 truncate">{k.ad}</p>
                {k.whatsapp_no && (
                  <p className="text-xs text-green-600 mt-0.5">💬 {k.whatsapp_no}</p>
                )}
                {k.aciklama && <p className="text-sm text-slate-500 truncate mt-0.5">{k.aciklama}</p>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => toggleAktif(k)}
                  className={`text-sm flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-colors
                    ${k.aktif ? 'bg-green-50 text-green-700 hover:bg-green-100' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                  {k.aktif ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                  {k.aktif ? 'Aktif' : 'Pasif'}
                </button>
                <button onClick={() => openEdit(k)}
                  className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => remove(k.id)}
                  className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
