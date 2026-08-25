'use client'
import { useState, useEffect, use } from 'react'
import { CheckCircle2, Clock, Loader2, ChevronRight, Phone, ArrowLeft, AlertCircle } from 'lucide-react'
import { ActiveEventResponse } from '@/types'
import { format } from 'date-fns'
import { tr } from 'date-fns/locale'

type Step = 'loading' | 'no-event' | 'form' | 'phone' | 'success' | 'error'

export default function FormPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [step, setStep] = useState<Step>('loading')
  const [data, setData] = useState<ActiveEventResponse | null>(null)
  const [errorMsg, setErrorMsg] = useState('')
  const [seciliKategoriler, setSeciliKategoriler] = useState<string[]>([])
  const [digerNot, setDigerNot] = useState('')
  const [telefon, setTelefon] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    fetch(`/api/form?token=${token}`)
      .then(async res => {
        if (res.ok) { setData(await res.json()); setStep('form') }
        else { const d = await res.json(); setErrorMsg(d.error); setStep('no-event') }
      })
      .catch(() => { setErrorMsg('Bağlantı hatası'); setStep('error') })
  }, [token])

  const toggleKategori = (ad: string) => {
    setSeciliKategoriler(prev =>
      prev.includes(ad) ? prev.filter(k => k !== ad) : [...prev, ad]
    )
  }

  const nextToPhone = () => {
    if (seciliKategoriler.length === 0) { setFormError('En az bir konu seçin'); return }
    setFormError(''); setStep('phone')
  }

  const submit = async () => {
    const temiz = telefon.replace(/\D/g, '')
    if (temiz.length < 10) { setFormError('Geçerli bir telefon numarası girin'); return }
    setSubmitting(true); setFormError('')
    const res = await fetch('/api/form', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, telefon: temiz, kategoriler: seciliKategoriler, diger_not: digerNot || null })
    })
    setSubmitting(false)
    if (res.ok) { openWhatsApp(temiz); setStep('success') }
    else { const d = await res.json(); setFormError(d.error) }
  }

  const openWhatsApp = (tel: string) => {
    if (!data) return
    const kategorilerText = seciliKategoriler.join(', ')
    const digerText = digerNot ? `\n\nNot: ${digerNot}` : ''
    const ref = Date.now().toString(36).toUpperCase()
    const msg = `Merhaba, *${data.kurum.ad}* etkinliği için bildirimim:\n\n📋 ${kategorilerText}${digerText}\n\n📞 ${tel}\n🔖 #${ref}`
    const hedef = (data.kurum as any).whatsapp_no
      ? (data.kurum as any).whatsapp_no.replace(/\D/g, '')
      : ''
    const waUrl = hedef
      ? `https://wa.me/${hedef}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`
    window.open(waUrl, '_blank')
  }

  // LOADING
  if (step === 'loading') return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 to-indigo-50">
      <div className="text-center">
        <div className="w-14 h-14 rounded-2xl bg-white shadow-lg flex items-center justify-center mx-auto mb-4">
          <Loader2 className="w-6 h-6 text-violet-500 animate-spin" />
        </div>
        <p className="text-slate-400 text-sm">Yükleniyor...</p>
      </div>
    </div>
  )

  // NO EVENT
  if (step === 'no-event' || step === 'error') return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-violet-50 to-indigo-50 p-6">
      <div className="text-center max-w-xs">
        <div className="w-20 h-20 rounded-3xl bg-white shadow-lg flex items-center justify-center mx-auto mb-6">
          <Clock className="w-9 h-9 text-slate-300" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">Aktif etkinlik yok</h2>
        <p className="text-slate-400 text-sm leading-relaxed">{errorMsg || 'Şu an için aktif bir etkinlik bulunamadı.'}</p>
      </div>
    </div>
  )

  // SUCCESS
  if (step === 'success') return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-50 p-6">
      <div className="text-center max-w-xs">
        <div className="w-20 h-20 rounded-3xl bg-white shadow-lg flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="w-10 h-10 text-green-500" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 mb-2">Teşekkürler! 🎉</h2>
        <p className="text-slate-500 text-sm leading-relaxed">Geri bildiriminiz alındı. En kısa sürede dönüş yapılacak.</p>
        <div className="mt-6 bg-white rounded-2xl p-4 shadow-sm">
          <p className="text-xs text-slate-400">WhatsApp açıldıysa mesajı göndererek takip edebilirsiniz.</p>
        </div>
      </div>
    </div>
  )

  if (!data) return null

  // PHONE STEP
  if (step === 'phone') return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 to-indigo-50 flex flex-col">
      <div className="bg-white/80 backdrop-blur border-b border-white/50 px-5 py-4">
        <button onClick={() => { setStep('form'); setFormError('') }}
          className="flex items-center gap-2 text-slate-400 hover:text-slate-600 text-sm mb-3 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Geri
        </button>
        <p className="text-xs text-violet-400 font-semibold uppercase tracking-widest">{data.kurum.ad}</p>
        <h1 className="font-bold text-slate-800 text-lg mt-0.5">{data.event.ad}</h1>
      </div>

      <div className="flex-1 flex flex-col justify-center p-6 max-w-sm mx-auto w-full">
        <div className="bg-white rounded-3xl shadow-sm border border-white p-5 mb-5">
          <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-3">Seçimleriniz</p>
          <div className="flex flex-wrap gap-2">
            {seciliKategoriler.map(k => (
              <span key={k} className="bg-violet-100 text-violet-700 text-xs px-3 py-1.5 rounded-full font-medium">{k}</span>
            ))}
          </div>
          {digerNot && <p className="text-xs text-slate-400 mt-3 italic border-t border-slate-50 pt-3">"{digerNot}"</p>}
        </div>

        <div className="bg-white rounded-3xl shadow-sm border border-white p-5 mb-4">
          <label className="block text-sm font-semibold text-slate-700 mb-3">
            📞 Telefon Numaranız
          </label>
          <input
            type="tel"
            value={telefon}
            onChange={e => setTelefon(e.target.value)}
            className="w-full border-2 border-slate-100 focus:border-violet-300 rounded-2xl px-4 py-3.5 text-lg font-medium focus:outline-none transition-colors bg-slate-50 focus:bg-white"
            placeholder="05XX XXX XX XX"
            autoFocus
          />
          <p className="text-xs text-slate-400 mt-2">Size WhatsApp üzerinden dönüş yapılacak.</p>
        </div>

        {formError && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-600 text-sm rounded-2xl px-4 py-3 mb-4">
            <AlertCircle className="w-4 h-4 shrink-0" /> {formError}
          </div>
        )}

        <button onClick={submit} disabled={submitting}
          className="w-full bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 disabled:opacity-50 text-white py-4 rounded-2xl text-base font-bold shadow-lg shadow-green-200 transition-all flex items-center justify-center gap-2">
          {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : '💬'}
          {submitting ? 'Gönderiliyor...' : 'Gönder & WhatsApp\'ı Aç'}
        </button>
      </div>
    </div>
  )

  // MAIN FORM
  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-purple-50 to-indigo-50 flex flex-col">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-white/50 px-5 py-5 sticky top-0 z-10">
        <div className="flex items-center gap-3 max-w-sm mx-auto">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shrink-0 shadow-md">
            <span className="text-white text-lg">🎊</span>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-violet-400 font-semibold uppercase tracking-widest truncate">{data.kurum.ad}</p>
            <h1 className="font-bold text-slate-800 text-base leading-tight truncate">{data.event.ad}</h1>
            <p className="text-xs text-slate-400 mt-0.5">
              {format(new Date(data.event.baslangic), 'dd MMM, HH:mm', { locale: tr })} –{' '}
              {format(new Date(data.event.bitis), 'HH:mm', { locale: tr })}
              {data.event.konum && ` · ${data.event.konum}`}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 p-5 max-w-sm mx-auto w-full">
        {/* Başlık */}
        <div className="mb-6 mt-2">
          <h2 className="text-xl font-bold text-slate-800">Nasıl yardımcı olalım?</h2>
          <p className="text-slate-400 text-sm mt-1">Birden fazla seçebilirsiniz.</p>
        </div>

        {/* Kategoriler Grid */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          {data.kategoriler.filter(k => k.ad !== 'Diğer').map(k => {
            const selected = seciliKategoriler.includes(k.ad)
            return (
              <button key={k.id} onClick={() => toggleKategori(k.ad)}
                className={`relative flex flex-col items-center justify-center gap-2.5 p-5 rounded-3xl border-2 transition-all duration-200 text-center
                  ${selected
                    ? 'border-violet-400 bg-white shadow-lg shadow-violet-100 scale-[0.98]'
                    : 'border-transparent bg-white/70 hover:bg-white hover:shadow-md'}`}>
                {selected && (
                  <div className="absolute top-3 right-3 w-5 h-5 bg-violet-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs font-bold">✓</span>
                  </div>
                )}
                <span className="text-3xl">{k.ikon}</span>
                <span className={`text-xs font-semibold leading-tight ${selected ? 'text-violet-700' : 'text-slate-600'}`}>
                  {k.ad}
                </span>
              </button>
            )
          })}
        </div>

        {/* Diğer butonu */}
        <button onClick={() => toggleKategori('Diğer')}
          className={`w-full flex items-center gap-3 p-4 rounded-2xl border-2 transition-all mb-3
            ${seciliKategoriler.includes('Diğer')
              ? 'border-violet-400 bg-white shadow-md'
              : 'border-dashed border-slate-200 bg-white/50 hover:bg-white'}`}>
          <span className="text-2xl">💬</span>
          <span className={`text-sm font-semibold ${seciliKategoriler.includes('Diğer') ? 'text-violet-700' : 'text-slate-500'}`}>
            Diğer — açıklama yazmak istiyorum
          </span>
          {seciliKategoriler.includes('Diğer') && (
            <div className="ml-auto w-5 h-5 bg-violet-500 rounded-full flex items-center justify-center shrink-0">
              <span className="text-white text-xs font-bold">✓</span>
            </div>
          )}
        </button>

        {/* Diğer text alanı */}
        {seciliKategoriler.includes('Diğer') && (
          <div className="mb-4">
            <textarea value={digerNot} onChange={e => setDigerNot(e.target.value)}
              rows={3} placeholder="Lütfen detaylı açıklayın..."
              className="w-full border-2 border-violet-100 focus:border-violet-300 rounded-2xl px-4 py-3 text-sm focus:outline-none resize-none bg-white transition-colors"
              autoFocus />
          </div>
        )}

        {formError && (
          <div className="flex items-center gap-2 bg-red-50 border border-red-100 text-red-500 text-sm rounded-2xl px-4 py-3 mb-4">
            <AlertCircle className="w-4 h-4 shrink-0" /> {formError}
          </div>
        )}

        {/* Devam butonu */}
        <button onClick={nextToPhone} disabled={seciliKategoriler.length === 0}
          className="w-full bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 disabled:opacity-30 disabled:cursor-not-allowed text-white py-4 rounded-2xl text-base font-bold shadow-lg shadow-violet-200 transition-all flex items-center justify-center gap-2">
          Devam Et
          <ChevronRight className="w-5 h-5" />
        </button>

        {seciliKategoriler.length > 0 && (
          <p className="text-center text-xs text-slate-400 mt-3">
            {seciliKategoriler.length} konu seçildi
          </p>
        )}

        <p className="text-center text-xs text-slate-300 mt-8 pb-4">
          {data.kurum.ad} · Anlık Bildirim Sistemi
        </p>
      </div>
    </div>
  )
}
