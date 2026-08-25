'use client'
import { useState, useEffect, use } from 'react'
import { CheckCircle2, Clock, Loader2, ChevronRight, ArrowLeft, AlertCircle, ChevronDown } from 'lucide-react'
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
  const [digerAcik, setDigerAcik] = useState(false)
  const [digerNot, setDigerNot] = useState('')
  const [masaNo, setMasaNo] = useState('')
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

  const allSelected = () => {
    const cats = [...seciliKategoriler]
    if (digerAcik && digerNot.trim()) cats.push('Diğer')
    return cats
  }

  const nextToPhone = () => {
    const all = allSelected()
    if (all.length === 0) { setFormError('En az bir konu seçin'); return }
    setFormError(''); setStep('phone')
  }

  const submit = async () => {
    const temiz = telefon.replace(/\D/g, '')
    if (temiz.length < 10) { setFormError('Geçerli bir telefon numarası girin'); return }
    setSubmitting(true); setFormError('')
    const kategorilerGonder = [...seciliKategoriler, ...(digerAcik && digerNot.trim() ? ['Diğer'] : [])]
    const notGonder = [masaNo ? `Masa: ${masaNo}` : '', digerNot].filter(Boolean).join(' | ')
    const res = await fetch('/api/form', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, telefon: temiz, kategoriler: kategorilerGonder, diger_not: notGonder || null })
    })
    setSubmitting(false)
    if (res.ok) { openWhatsApp(temiz, kategorilerGonder, notGonder); setStep('success') }
    else { const d = await res.json(); setFormError(d.error) }
  }

  const openWhatsApp = (tel: string, kategoriler: string[], not: string) => {
    if (!data) return
    const kategorilerText = kategoriler.join(', ')
    const notText = not ? `\n\nNot: ${not}` : ''
    const masaText = masaNo ? `\n🪑 Masa No: ${masaNo}` : ''
    const ref = Date.now().toString(36).toUpperCase()
    const msg = `Merhaba, *${data.kurum.ad}* - *${data.event.ad}* etkinliği için bildirim:\n\n📋 Konu: ${kategorilerText}${masaText}${notText}\n\n📞 Numara: ${tel}\n🔖 Ref: #${ref}`
    const hedef = '908502550939'
    const waLink = document.createElement('a')
    waLink.href = `https://wa.me/${hedef}?text=${encodeURIComponent(msg)}`
    waLink.target = '_blank'
    waLink.rel = 'noopener'
    document.body.appendChild(waLink)
    waLink.click()
    document.body.removeChild(waLink)
  }

  if (step === 'loading') return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#f8f7ff' }}>
      <div style={{ textAlign:'center' }}>
        <Loader2 style={{ width:28, height:28, color:'#8b5cf6', animation:'spin 1s linear infinite', margin:'0 auto 12px' }} />
        <p style={{ fontSize:13, color:'#9e94b8' }}>Yükleniyor...</p>
      </div>
    </div>
  )

  if (step === 'no-event' || step === 'error') return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#f8f7ff', padding:24 }}>
      <div style={{ textAlign:'center', maxWidth:280 }}>
        <div style={{ width:72, height:72, background:'#fff', borderRadius:24, border:'1.5px solid #ede9f8', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px' }}>
          <Clock style={{ width:32, height:32, color:'#c4bdd8' }} />
        </div>
        <h2 style={{ fontSize:20, fontWeight:600, color:'#1a1523', marginBottom:8 }}>Aktif etkinlik yok</h2>
        <p style={{ fontSize:13, color:'#9e94b8', lineHeight:1.6 }}>{errorMsg || 'Şu an için aktif bir etkinlik bulunamadı.'}</p>
      </div>
    </div>
  )

  if (step === 'success') return (
    <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', background:'#f0fdf4', padding:24 }}>
      <div style={{ textAlign:'center', maxWidth:280 }}>
        <div style={{ width:72, height:72, background:'#fff', borderRadius:24, border:'1.5px solid #bbf7d0', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 20px' }}>
          <CheckCircle2 style={{ width:32, height:32, color:'#22c55e' }} />
        </div>
        <h2 style={{ fontSize:20, fontWeight:600, color:'#1a1523', marginBottom:8 }}>Teşekkürler!</h2>
        <p style={{ fontSize:13, color:'#6b7280', lineHeight:1.6 }}>Geri bildiriminiz alındı. WhatsApp açıldıysa mesajı göndererek takip edebilirsiniz.</p>
      </div>
    </div>
  )

  if (!data) return null

  // PHONE STEP
  if (step === 'phone') return (
    <div style={{ minHeight:'100vh', background:'#f8f7ff', display:'flex', flexDirection:'column' }}>
      <div style={{ background:'#fff', borderBottom:'0.5px solid #ede9f8', padding:'24px 20px 20px' }}>
        <button onClick={() => { setStep('form'); setFormError('') }}
          style={{ display:'flex', alignItems:'center', gap:6, color:'#9e94b8', fontSize:13, background:'none', border:'none', cursor:'pointer', marginBottom:14, padding:0 }}>
          <ArrowLeft style={{ width:16, height:16 }} /> Geri
        </button>
        <div style={{ display:'inline-flex', alignItems:'center', gap:6, background:'#f0eeff', borderRadius:20, padding:'4px 12px', marginBottom:12 }}>
          <div style={{ width:7, height:7, background:'#22c55e', borderRadius:'50%' }} />
          <span style={{ fontSize:11, fontWeight:600, color:'#7c5cbf', letterSpacing:'0.07em', textTransform:'uppercase' }}>{data.kurum.ad}</span>
        </div>
        <h1 style={{ fontSize:20, fontWeight:600, color:'#1a1523', lineHeight:1.25 }}>{data.event.ad}</h1>
      </div>

      <div style={{ flex:1, padding:'24px 20px', maxWidth:420, margin:'0 auto', width:'100%' }}>
        {/* Özet */}
        <div style={{ background:'#fff', borderRadius:16, border:'1.5px solid #ede9f8', padding:16, marginBottom:16 }}>
          <p style={{ fontSize:11, fontWeight:600, color:'#9e94b8', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:10 }}>Seçimleriniz</p>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
            {allSelected().map(k => (
              <span key={k} style={{ background:'#f0eeff', color:'#6d28d9', fontSize:12, fontWeight:600, padding:'5px 12px', borderRadius:20 }}>{k}</span>
            ))}
          </div>
          {masaNo && <p style={{ fontSize:12, color:'#9e94b8', marginTop:8 }}>🪑 Masa No: {masaNo}</p>}
          {digerNot && <p style={{ fontSize:12, color:'#9e94b8', marginTop:6, fontStyle:'italic' }}>"{digerNot}"</p>}
        </div>

        {/* Telefon */}
        <div style={{ background:'#fff', borderRadius:16, border:'1.5px solid #ede9f8', padding:16, marginBottom:12 }}>
          <label style={{ display:'block', fontSize:13, fontWeight:600, color:'#6b6080', marginBottom:10 }}>Telefon numaranız</label>
          <input
            type="tel"
            value={telefon}
            onChange={e => setTelefon(e.target.value)}
            autoFocus
            placeholder="05XX XXX XX XX"
            style={{ width:'100%', border:'1.5px solid #ede9f8', borderRadius:12, padding:'13px 14px', fontSize:16, fontWeight:500, color:'#1a1523', outline:'none', fontFamily:'inherit', background:'#faf8ff', boxSizing:'border-box' }}
          />
          <p style={{ fontSize:11, color:'#c4bdd8', marginTop:8 }}>WhatsApp üzerinden dönüş yapılacak.</p>
        </div>

        {formError && (
          <div style={{ display:'flex', alignItems:'center', gap:8, background:'#fef2f2', border:'1px solid #fecaca', color:'#dc2626', fontSize:13, borderRadius:12, padding:'10px 14px', marginBottom:12 }}>
            <AlertCircle style={{ width:15, height:15, flexShrink:0 }} /> {formError}
          </div>
        )}

        <div style={{ display:'flex', gap:10 }}>
          <button onClick={() => { setStep('form'); setFormError('') }}
            style={{ flex:1, background:'#fff', border:'1.5px solid #ede9f8', borderRadius:14, padding:15, fontSize:14, fontWeight:600, color:'#6b6080', cursor:'pointer' }}>
            Geri
          </button>
          <button onClick={submit} disabled={submitting}
            style={{ flex:2, background:'#4c1d95', border:'none', borderRadius:14, padding:15, fontSize:15, fontWeight:700, color:'#ffffff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:8, opacity:submitting ? 0.7 : 1 }}>
            {submitting ? <Loader2 style={{ width:16, height:16, animation:'spin 1s linear infinite' }} /> : '💬'}
            {submitting ? 'Gönderiliyor...' : "Gönder & WhatsApp"}
          </button>
        </div>
      </div>
    </div>
  )

  // MAIN FORM
  const kategorilerFiltered = data.kategoriler.filter(k => k.ad !== 'Diğer')
  const secilenSayi = seciliKategoriler.length + (digerAcik && digerNot.trim() ? 1 : 0)

  return (
    <div style={{ minHeight:'100vh', background:'#f8f7ff', fontFamily:'system-ui, -apple-system, sans-serif', paddingBottom:32 }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>

      {/* Header */}
      <div style={{ background:'#fff', borderBottom:'0.5px solid #ede9f8', padding:'28px 22px 22px', position:'sticky', top:0, zIndex:10 }}>
        <div style={{ display:'inline-flex', alignItems:'center', gap:6, background:'#f0eeff', borderRadius:20, padding:'5px 12px', marginBottom:14 }}>
          <div style={{ width:7, height:7, background:'#22c55e', borderRadius:'50%' }} />
          <span style={{ fontSize:11, fontWeight:600, color:'#7c5cbf', letterSpacing:'0.07em', textTransform:'uppercase' }}>{data.kurum.ad}</span>
        </div>
        <h1 style={{ fontSize:21, fontWeight:600, color:'#1a1523', lineHeight:1.25, marginBottom:10, letterSpacing:'-0.02em' }}>{data.event.ad}</h1>
        <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:12, color:'#9e94b8' }}>
          <span>📅</span>
          {format(new Date(data.event.baslangic), 'dd MMM · HH:mm', { locale: tr })} – {format(new Date(data.event.bitis), 'HH:mm', { locale: tr })}
          {data.event.konum && <><span style={{ color:'#d5ceed' }}>·</span><span>📍 {data.event.konum}</span></>}
        </div>
      </div>

      <div style={{ padding:'20px 18px 0', maxWidth:420, margin:'0 auto' }}>

        {/* Masa no */}
        <div style={{ background:'#fff', borderRadius:16, border:'1.5px solid #ede9f8', padding:'14px 16px', marginBottom:16, display:'flex', alignItems:'center', gap:12 }}>
          <span style={{ fontSize:20 }}>🪑</span>
          <div style={{ flex:1 }}>
            <label style={{ display:'block', fontSize:11, fontWeight:600, color:'#9e94b8', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:4 }}>Masa Numarası</label>
            <input
              type="text"
              value={masaNo}
              onChange={e => setMasaNo(e.target.value)}
              placeholder="Örn: 12"
              style={{ width:'100%', border:'none', outline:'none', fontSize:15, fontWeight:500, color:'#1a1523', background:'transparent', fontFamily:'inherit' }}
            />
          </div>
        </div>

        <p style={{ fontSize:12, fontWeight:600, color:'#9e94b8', letterSpacing:'0.06em', textTransform:'uppercase', marginBottom:4 }}>Nasıl yardımcı olalım?</p>
        <p style={{ fontSize:13, color:'#c4bdd8', marginBottom:16 }}>Birden fazla seçebilirsiniz</p>

        {/* Kategoriler Grid */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
          {kategorilerFiltered.map(k => {
            const selected = seciliKategoriler.includes(k.ad)
            return (
              <button key={k.id} onClick={() => toggleKategori(k.ad)}
                style={{
                  background: selected ? '#faf8ff' : '#fff',
                  border: selected ? '1.5px solid #8b5cf6' : '1.5px solid #ede9f8',
                  borderRadius:18, padding:'18px 10px 14px',
                  display:'flex', flexDirection:'column', alignItems:'center', gap:9,
                  cursor:'pointer', position:'relative',
                  boxShadow: selected ? '0 0 0 3px rgba(139,92,246,0.1)' : '0 1px 4px rgba(124,92,191,0.04)',
                  transition:'all 0.15s'
                }}>
                {selected && (
                  <div style={{ position:'absolute', top:10, right:10, width:18, height:18, background:'#8b5cf6', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <span style={{ color:'#fff', fontSize:10, fontWeight:700 }}>✓</span>
                  </div>
                )}
                <span style={{ fontSize:26 }}>{k.ikon}</span>
                <span style={{ fontSize:11, fontWeight:600, color: selected ? '#6d28d9' : '#6b6080', textAlign:'center', lineHeight:1.35 }}>{k.ad}</span>
              </button>
            )
          })}
        </div>

        {/* Diğer */}
        <div style={{ marginBottom:16 }}>
          <button onClick={() => setDigerAcik(!digerAcik)}
            style={{
              width:'100%', background: digerAcik ? '#faf8ff' : '#fff',
              border: digerAcik ? '1.5px solid #8b5cf6' : '1.5px dashed #d5ceed',
              borderRadius:16, padding:'14px 16px',
              display:'flex', alignItems:'center', gap:10, cursor:'pointer', transition:'all 0.15s'
            }}>
            <span style={{ fontSize:20 }}>💬</span>
            <span style={{ fontSize:13, color: digerAcik ? '#6d28d9' : '#9e94b8', fontWeight:500 }}>Diğer — not eklemek istiyorum</span>
            <ChevronDown style={{ width:14, height:14, color:'#c4bdd8', marginLeft:'auto', transform: digerAcik ? 'rotate(180deg)' : 'rotate(0deg)', transition:'transform 0.2s' }} />
          </button>
          {digerAcik && (
            <textarea
              value={digerNot}
              onChange={e => setDigerNot(e.target.value)}
              rows={3}
              autoFocus
              placeholder="Lütfen detaylı açıklayın..."
              style={{ width:'100%', marginTop:8, background:'#fff', border:'1.5px solid #d5ceed', borderRadius:14, padding:'12px 14px', fontSize:13, color:'#1a1523', resize:'none', outline:'none', fontFamily:'inherit', lineHeight:1.5, boxSizing:'border-box', display:'block' }}
            />
          )}
        </div>

        {formError && (
          <div style={{ display:'flex', alignItems:'center', gap:8, background:'#fef2f2', border:'1px solid #fecaca', color:'#dc2626', fontSize:13, borderRadius:12, padding:'10px 14px', marginBottom:12 }}>
            <AlertCircle style={{ width:15, height:15, flexShrink:0 }} /> {formError}
          </div>
        )}

        {/* Devam butonu — her zaman sayfanın akışında, kaymaz */}
        <button onClick={nextToPhone} disabled={secilenSayi === 0}
          style={{
            width:'100%', background:'#4c1d95', border:'none', borderRadius:16,
            padding:17, display:'flex', alignItems:'center', justifyContent:'center', gap:8,
            cursor: secilenSayi === 0 ? 'not-allowed' : 'pointer',
            opacity: secilenSayi === 0 ? 0.35 : 1, transition:'all 0.15s',
            marginBottom:12
          }}>
          <span style={{ fontSize:15, fontWeight:700, color:'#ffffff' }}>Devam et</span>
          <ChevronRight style={{ width:17, height:17, color:'rgba(255,255,255,0.8)' }} />
        </button>

        {secilenSayi > 0 && (
          <p style={{ textAlign:'center', fontSize:11, color:'#8b5cf6', marginBottom:8, fontWeight:500 }}>{secilenSayi} konu seçildi</p>
        )}

        <p style={{ textAlign:'center', fontSize:11, color:'#d5ceed', marginTop:20 }}>{data.kurum.ad} · Anlık Bildirim Sistemi</p>
      </div>
    </div>
  )
}
