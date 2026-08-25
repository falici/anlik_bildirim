'use client'
import { useState, useEffect, useCallback } from 'react'
import { MessageSquare, CheckCircle2, Clock, Loader2, RefreshCw, Phone, Building2, Calendar, SlidersHorizontal } from 'lucide-react'
import { Kurum } from '@/types'
import { format } from 'date-fns'
import { tr } from 'date-fns/locale'

type Durum = 'beklemede' | 'isleniyor' | 'tamamlandi'

interface Bildirim {
  id: string
  telefon: string
  whatsapp_id?: string
  kategoriler: string[]
  diger_not?: string
  durum: Durum
  olusturulma: string
  kurum?: { id: string; ad: string }
  event?: { id: string; ad: string }
}

const durumConfig = {
  beklemede:   { label: 'Beklemede',  bg: '#fef9c3', text: '#854d0e', border: '#fde047' },
  isleniyor:   { label: 'İşleniyor',  bg: '#dbeafe', text: '#1e40af', border: '#93c5fd' },
  tamamlandi:  { label: 'Tamamlandı', bg: '#dcfce7', text: '#166534', border: '#86efac' },
}

const nextDurum: Record<Durum, Durum> = {
  beklemede: 'isleniyor',
  isleniyor: 'tamamlandi',
  tamamlandi: 'beklemede',
}

const nextLabel: Record<Durum, string> = {
  beklemede: '▶ İşleme Al',
  isleniyor: '✓ Tamamlandı',
  tamamlandi: '↩ Yeniden Aç',
}

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
    setLoading(false)
    setLastRefresh(new Date())
  }, [filterKurum, filterDurum])

  useEffect(() => {
    fetch('/api/admin/kurumlar').then(r => r.json()).then(setKurumlar)
  }, [])

  useEffect(() => { load() }, [load])

  // Otomatik yenile — 30 saniyede bir
  useEffect(() => {
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [load])

  const changeDurum = async (b: Bildirim) => {
    setUpdating(b.id)
    const yeni = nextDurum[b.durum]
    await fetch('/api/admin/bildirimler', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: b.id, durum: yeni })
    })
    setUpdating(null)
    load()
  }

  const bekleyen = bildirimler.filter(b => b.durum === 'beklemede').length
  const islenen = bildirimler.filter(b => b.durum === 'isleniyor').length
  const tamamlanan = bildirimler.filter(b => b.durum === 'tamamlandi').length

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Bildirimler</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Son güncelleme: {format(lastRefresh, 'HH:mm:ss')} · otomatik yenileniyor
          </p>
        </div>
        <button onClick={load}
          className="flex items-center gap-2 border border-slate-200 text-slate-600 text-sm font-medium px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors">
          <RefreshCw className="w-3.5 h-3.5" /> Yenile
        </button>
      </div>

      {/* Özet kartlar */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: 'Beklemede', count: bekleyen, color: '#854d0e', bg: '#fef9c3' },
          { label: 'İşleniyor', count: islenen, color: '#1e40af', bg: '#dbeafe' },
          { label: 'Tamamlandı', count: tamamlanan, color: '#166534', bg: '#dcfce7' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-slate-200 p-4">
            <p className="text-xs text-slate-400 font-medium mb-1">{s.label}</p>
            <p className="text-2xl font-bold" style={{ color: s.color }}>{s.count}</p>
          </div>
        ))}
      </div>

      {/* Filtreler */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-slate-400" />
          <select value={filterKurum} onChange={e => setFilterKurum(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
            <option value="">Tüm Kurumlar</option>
            {kurumlar.map(k => <option key={k.id} value={k.id}>{k.ad}</option>)}
          </select>
        </div>
        <select value={filterDurum} onChange={e => setFilterDurum(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
          <option value="">Tüm Durumlar</option>
          <option value="beklemede">Beklemede</option>
          <option value="isleniyor">İşleniyor</option>
          <option value="tamamlandi">Tamamlandı</option>
        </select>
      </div>

      {/* Liste */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Yükleniyor...
        </div>
      ) : bildirimler.length === 0 ? (
        <div className="text-center py-16">
          <MessageSquare className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400">Henüz bildirim yok</p>
        </div>
      ) : (
        <div className="space-y-3">
          {bildirimler.map(b => {
            const cfg = durumConfig[b.durum]
            return (
              <div key={b.id} className="bg-white rounded-xl border border-slate-200 p-4">
                <div className="flex items-start gap-4">
                  {/* Sol — bilgi */}
                  <div className="flex-1 min-w-0">
                    {/* Üst satır */}
                    <div className="flex items-center gap-2 flex-wrap mb-2">
                      <span className="text-xs font-semibold px-2.5 py-1 rounded-full border"
                        style={{ background: cfg.bg, color: cfg.text, borderColor: cfg.border }}>
                        {cfg.label}
                      </span>
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Building2 className="w-3 h-3" /> {b.kurum?.ad}
                      </span>
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> {b.event?.ad}
                      </span>
                    </div>

                    {/* Kategoriler */}
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {b.kategoriler.map(k => (
                        <span key={k} className="bg-indigo-50 text-indigo-700 text-xs font-medium px-2.5 py-1 rounded-full">
                          {k}
                        </span>
                      ))}
                    </div>

                    {/* Not */}
                    {b.diger_not && (
                      <p className="text-sm text-slate-500 italic bg-slate-50 rounded-lg px-3 py-2 mb-2">
                        "{b.diger_not}"
                      </p>
                    )}

                    {/* Alt satır */}
                    <div className="flex items-center gap-4 flex-wrap">
                      <span className="text-xs text-slate-400 flex items-center gap-1">
                        <Phone className="w-3 h-3" /> {b.telefon}
                      </span>
                      <span className="text-xs text-slate-300">
                        {format(new Date(b.olusturulma), 'dd MMM HH:mm', { locale: tr })}
                      </span>
                    </div>
                  </div>

                  {/* Sağ — aksiyon */}
                  <div className="shrink-0">
                    <button onClick={() => changeDurum(b)} disabled={updating === b.id}
                      className="text-xs font-semibold px-3 py-2 rounded-lg border transition-all disabled:opacity-50 whitespace-nowrap"
                      style={{
                        background: cfg.bg,
                        color: cfg.text,
                        borderColor: cfg.border,
                      }}>
                      {updating === b.id
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : nextLabel[b.durum]
                      }
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
