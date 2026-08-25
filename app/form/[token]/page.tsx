'use client'
import { useState, useEffect, use } from 'react'
import { CheckCircle2, Clock, AlertCircle, Loader2, ChevronRight, Phone } from 'lucide-react'
import { ActiveEventResponse } from '@/types'
import { format } from 'date-fns'
import { tr } from 'date-fns/locale'

type Step = 'loading' | 'no-event' | 'form' | 'phone' | 'success' | 'error'

export default function FormPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params)
  const [step, setStep] = useState<Step>('loading')
  const [data, setData] = useState<ActiveEventResponse | null>(null)
  const [errorMsg, setErrorMsg] = useState('')

  // Form state
  const [seciliKategoriler, setSeciliKategoriler] = useState<string[]>([])
  const [digerNot, setDigerNot] = useState('')
  const [telefon, setTelefon] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')

  useEffect(() => {
    fetch(`/api/form?token=${token}`)
      .then(async res => {
        if (res.ok) {
          setData(await res.json())
          setStep('form')
        } else {
          const d = await res.json()
          setErrorMsg(d.error)
          setStep('no-event')
        }
      })
      .catch(() => { setErrorMsg('Bağlantı hatası'); setStep('error') })
  }, [token])

  const toggleKategori = (ad: string) => {
    setSeciliKategoriler(prev =>
      prev.includes(ad) ? prev.filter(k => k !== ad) : [...prev, ad]
    )
  }

  const nextToPhone = () => {
    if (seciliKategoriler.length === 0) { setFormError('En az bir kategori seçin'); return }
    setFormError('')
    setStep('phone')
  }

  const submit = async () => {
    const temiz = telefon.replace(/\D/g, '')
    if (temiz.length < 10) { setFormError('Geçerli bir telefon numarası girin'); return }
    setSubmitting(true)
    setFormError('')

    const res = await fetch('/api/form', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token,
        telefon: temiz,
        kategoriler: seciliKategoriler,
        diger_not: digerNot || null
      })
    })

    setSubmitting(false)
    if (res.ok) {
      // WhatsApp mesajı aç
      openWhatsApp(temiz)
      setStep('success')
    } else {
      const d = await res.json()
      setFormError(d.error)
    }
  }

  const openWhatsApp = (tel: string) => {
    if (!data) return
    const kategorilerText = seciliKategoriler.join(', ')
    const digerText = digerNot ? `\n\nEk not: ${digerNot}` : ''
    const msg = `Merhaba, *${data.kurum.ad}* - *${data.event.ad}* etkinliği için geri bildirimim:

📋 Konular: ${kategorilerText}${digerText}

📞 Numaram: ${tel}
🔖 Referans: #${Date.now().toString(36).toUpperCase()}`

    const waUrl = `https://wa.me/?text=${encodeURIComponent(msg)}`
    window.open(waUrl, '_blank')
  }

  // ── LOADING ──
  if (step === 'loading') return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin mx-auto mb-3" />
        <p className="text-slate-500 text-sm">Etkinlik bilgisi alınıyor...</p>
      </div>
    </div>
  )

  // ── NO EVENT ──
  if (step === 'no-event' || step === 'error') return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Clock className="w-8 h-8 text-amber-500" />
        </div>
        <h2 className="text-lg font-semibold text-slate-900 mb-2">Şu an aktif etkinlik yok</h2>
        <p className="text-slate-500 text-sm">{errorMsg || 'Bu QR kod için şu anda aktif bir etkinlik bulunamadı.'}</p>
      </div>
    </div>
  )

  // ── SUCCESS ──
  if (step === 'success') return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="text-center max-w-sm">
        <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="w-8 h-8 text-green-500" />
        </div>
        <h2 className="text-lg font-semibold text-slate-900 mb-2">Teşekkürler!</h2>
        <p className="text-slate-500 text-sm mb-4">Geri bildiriminiz alındı. En kısa sürede size dönüş yapılacak.</p>
        <p className="text-xs text-slate-400">WhatsApp açıldıysa mesajı göndererek takip edebilirsiniz.</p>
      </div>
    </div>
  )

  if (!data) return null

  // ── PHONE STEP ──
  if (step === 'phone') return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <div className="bg-white border-b border-slate-100 px-5 py-4">
        <p className="text-xs text-slate-400 uppercase tracking-wide font-medium">{data.kurum.ad}</p>
        <h1 className="font-semibold text-slate-900 text-base mt-0.5">{data.event.ad}</h1>
      </div>

      <div className="flex-1 flex flex-col justify-center p-5 max-w-md mx-auto w-full">
        <div className="mb-6">
          <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mb-4">
            <Phone className="w-6 h-6 text-green-600" />
          </div>
          <h2 className="text-lg font-semibold text-slate-900 mb-1">Telefon numaranız</h2>
          <p className="text-sm text-slate-500">Size hızlıca dönüş yapabilmemiz için telefon numaranızı girin.</p>
        </div>

        {/* Seçimler özeti */}
        <div className="bg-slate-50 rounded-xl p-3 mb-5">
          <p className="text-xs text-slate-400 mb-2 font-medium uppercase tracking-wide">Seçimleriniz</p>
          <div className="flex flex-wrap gap-1.5">
            {seciliKategoriler.map(k => (
              <span key={k} className="bg-indigo-100 text-indigo-700 text-xs px-2.5 py-1 rounded-full font-medium">{k}</span>
            ))}
          </div>
          {digerNot && <p className="text-xs text-slate-500 mt-2 italic">"{digerNot}"</p>}
        </div>

        <div className="mb-5">
          <label className="block text-sm font-medium text-slate-700 mb-2">Telefon Numarası</label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="tel"
              value={telefon}
              onChange={e => setTelefon(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-xl text-base focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="05XX XXX XX XX"
              autoFocus
            />
          </div>
        </div>

        {formError && (
          <div className="bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg px-3 py-2 mb-4 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" /> {formError}
          </div>
        )}

        <div className="flex gap-3">
          <button onClick={() => { setStep('form'); setFormError('') }}
            className="flex-1 border border-slate-200 text-slate-700 py-3 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors">
            Geri
          </button>
          <button onClick={submit} disabled={submitting}
            className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white py-3 rounded-xl text-sm font-semibold transition-colors flex items-center justify-center gap-2">
            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {submitting ? 'Gönderiliyor...' : 'Gönder & WhatsApp'}
          </button>
        </div>
      </div>
    </div>
  )

  // ── MAIN FORM ──
  const digerKategori = data.kategoriler.find(k => k.ad === 'Diğer')

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-5 py-4 sticky top-0 z-10">
        <p className="text-xs text-slate-400 uppercase tracking-wide font-medium">{data.kurum.ad}</p>
        <h1 className="font-semibold text-slate-900 text-base mt-0.5">{data.event.ad}</h1>
        <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          {format(new Date(data.event.baslangic), 'dd MMMM, HH:mm', { locale: tr })} –{' '}
          {format(new Date(data.event.bitis), 'HH:mm', { locale: tr })}
          {data.event.konum && ` · ${data.event.konum}`}
        </p>
      </div>

      <div className="flex-1 p-5 max-w-md mx-auto w-full">
        <div className="mb-5">
          <h2 className="text-base font-semibold text-slate-900 mb-1">İstek veya şikayetiniz nedir?</h2>
          <p className="text-sm text-slate-500">Birden fazla seçebilirsiniz.</p>
        </div>

        {/* Kategoriler */}
        <div className="grid grid-cols-2 gap-2.5 mb-5">
          {data.kategoriler.filter(k => k.ad !== 'Diğer').map(k => {
            const selected = seciliKategoriler.includes(k.ad)
            return (
              <button
                key={k.id}
                onClick={() => toggleKategori(k.ad)}
                className={`flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border-2 transition-all text-center
                  ${selected
                    ? 'border-indigo-500 bg-indigo-50 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-slate-300'}`}
              >
                <span className="text-2xl">{k.ikon}</span>
                <span className={`text-xs font-medium leading-tight ${selected ? 'text-indigo-700' : 'text-slate-700'}`}>
                  {k.ad}
                </span>
              </button>
            )
          })}
        </div>

        {/* Diğer text alanı */}
        <div className={`mb-6 transition-all ${seciliKategoriler.includes('Diğer') ? 'block' : 'hidden'}`}>
          <textarea
            value={digerNot}
            onChange={e => setDigerNot(e.target.value)}
            rows={3}
            placeholder="Lütfen detaylı açıklayın..."
            className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
          />
        </div>

        {/* Diğer toggle */}
        <button
          onClick={() => toggleKategori('Diğer')}
          className={`w-full mb-6 flex items-center gap-3 p-4 rounded-2xl border-2 transition-all
            ${seciliKategoriler.includes('Diğer')
              ? 'border-indigo-500 bg-indigo-50'
              : 'border-dashed border-slate-200 bg-white hover:border-slate-300'}`}
        >
          <span className="text-xl">💬</span>
          <span className={`text-sm font-medium ${seciliKategoriler.includes('Diğer') ? 'text-indigo-700' : 'text-slate-600'}`}>
            Diğer (açıklama yazacağım)
          </span>
        </button>

        {formError && (
          <div className="bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg px-3 py-2 mb-4 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" /> {formError}
          </div>
        )}

        <button onClick={nextToPhone}
          disabled={seciliKategoriler.length === 0}
          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white py-3.5 rounded-2xl text-sm font-semibold transition-colors flex items-center justify-center gap-2">
          Devam Et
          <ChevronRight className="w-4 h-4" />
        </button>

        {seciliKategoriler.length > 0 && (
          <p className="text-center text-xs text-slate-400 mt-3">
            {seciliKategoriler.length} konu seçildi
          </p>
        )}
      </div>
    </div>
  )
}
