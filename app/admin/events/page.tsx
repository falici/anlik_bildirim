'use client'
import { useState, useEffect } from 'react'
import { Plus, Calendar, Clock, MapPin, Trash2, Pencil, X, ToggleLeft, ToggleRight } from 'lucide-react'
import { Event, Kurum } from '@/types'
import { format } from 'date-fns'
import { tr } from 'date-fns/locale'

export default function EventsPage() {
  const [events, setEvents] = useState<Event[]>([])
  const [kurumlar, setKurumlar] = useState<Kurum[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<Event | null>(null)
  const [filterKurum, setFilterKurum] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [form, setForm] = useState({
    kurum_id: '', ad: '', aciklama: '', baslangic: '', bitis: '', konum: ''
  })

  const load = async () => {
    const [evRes, kRes] = await Promise.all([
      fetch('/api/admin/events'),
      fetch('/api/admin/kurumlar')
    ])
    if (evRes.ok) setEvents(await evRes.json())
    if (kRes.ok) setKurumlar(await kRes.json())
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const openNew = () => {
    setEditing(null)
    setForm({ kurum_id: filterKurum, ad: '', aciklama: '', baslangic: '', bitis: '', konum: '' })
    setShowForm(true); setError('')
  }

  const openEdit = (ev: Event) => {
    setEditing(ev)
    setForm({
      kurum_id: ev.kurum_id,
      ad: ev.ad,
      aciklama: ev.aciklama || '',
      baslangic: ev.baslangic.slice(0, 16),
      bitis: ev.bitis.slice(0, 16),
      konum: ev.konum || ''
    })
    setShowForm(true); setError('')
  }

  const save = async () => {
    if (!form.kurum_id || !form.ad || !form.baslangic || !form.bitis) {
      setError('Zorunlu alanları doldurun'); return
    }
    setSaving(true)
    const method = editing ? 'PUT' : 'POST'
    const body = editing ? { ...form, id: editing.id } : form
    const res = await fetch('/api/admin/events', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
    setSaving(false)
    if (res.ok) { setShowForm(false); load() }
    else { const d = await res.json(); setError(d.error) }
  }

  const toggleAktif = async (ev: Event) => {
    await fetch('/api/admin/events', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: ev.id, ad: ev.ad, baslangic: ev.baslangic, bitis: ev.bitis, kurum_id: ev.kurum_id, aktif: !ev.aktif })
    })
    load()
  }

  const remove = async (id: string) => {
    if (!confirm('Bu etkinliği silmek istiyor musunuz?')) return
    await fetch(`/api/admin/events?id=${id}`, { method: 'DELETE' })
    load()
  }

  const isActive = (ev: Event) => {
    const now = new Date()
    return new Date(ev.baslangic) <= now && new Date(ev.bitis) >= now && ev.aktif
  }

  const filtered = filterKurum ? events.filter(e => e.kurum_id === filterKurum) : events

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Etkinlikler</h1>
          <p className="text-sm text-slate-500 mt-0.5">{filtered.length} etkinlik</p>
        </div>
        <button onClick={openNew}
          className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
          <Plus className="w-4 h-4" /> Yeni Etkinlik
        </button>
      </div>

      {/* Filter */}
      <div className="mb-5">
        <select value={filterKurum} onChange={e => setFilterKurum(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
          <option value="">Tüm Kurumlar</option>
          {kurumlar.map(k => <option key={k.id} value={k.id}>{k.ad}</option>)}
        </select>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="font-semibold text-slate-900">{editing ? 'Etkinliği Düzenle' : 'Yeni Etkinlik'}</h2>
              <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Kurum *</label>
                <select value={form.kurum_id} onChange={e => setForm({ ...form, kurum_id: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="">Seçin...</option>
                  {kurumlar.filter(k => k.aktif).map(k => <option key={k.id} value={k.id}>{k.ad}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Etkinlik Adı *</label>
                <input type="text" value={form.ad} onChange={e => setForm({ ...form, ad: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Örn: Ahmet & Ayşe Düğün Töreni" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Başlangıç *</label>
                  <input type="datetime-local" value={form.baslangic} onChange={e => setForm({ ...form, baslangic: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">Bitiş *</label>
                  <input type="datetime-local" value={form.bitis} onChange={e => setForm({ ...form, bitis: e.target.value })}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Konum</label>
                <input type="text" value={form.konum} onChange={e => setForm({ ...form, konum: e.target.value })}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Örn: Salon A, 2. Kat" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Açıklama</label>
                <textarea value={form.aciklama} onChange={e => setForm({ ...form, aciklama: e.target.value })}
                  rows={2}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" />
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
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Calendar className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500">Henüz etkinlik eklenmemiş</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(ev => (
            <div key={ev.id} className="bg-white rounded-xl border border-slate-200 p-4">
              <div className="flex items-start gap-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0
                  ${isActive(ev) ? 'bg-green-100' : 'bg-slate-100'}`}>
                  <Calendar className={`w-5 h-5 ${isActive(ev) ? 'text-green-600' : 'text-slate-400'}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-slate-900">{ev.ad}</p>
                    {isActive(ev) && (
                      <span className="bg-green-100 text-green-700 text-xs font-medium px-2 py-0.5 rounded-full">🔴 Canlı</span>
                    )}
                    <span className="text-xs text-slate-400">{(ev as any).kurum?.ad}</span>
                  </div>
                  <div className="flex items-center gap-4 mt-1.5 flex-wrap">
                    <span className="text-xs text-slate-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {format(new Date(ev.baslangic), 'dd MMM yy HH:mm', { locale: tr })} –{' '}
                      {format(new Date(ev.bitis), 'dd MMM yy HH:mm', { locale: tr })}
                    </span>
                    {ev.konum && (
                      <span className="text-xs text-slate-500 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />{ev.konum}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button onClick={() => toggleAktif(ev)}
                    className={`text-xs flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-colors
                      ${ev.aktif ? 'bg-green-50 text-green-700 hover:bg-green-100' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`}>
                    {ev.aktif ? <ToggleRight className="w-3.5 h-3.5" /> : <ToggleLeft className="w-3.5 h-3.5" />}
                    {ev.aktif ? 'Aktif' : 'Pasif'}
                  </button>
                  <button onClick={() => openEdit(ev)}
                    className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => remove(ev.id)}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
