import { NextRequest, NextResponse } from 'next/server'
import { parseWebhookMessage, sendWhatsAppMessage, resolveWaId, normalizePhone, extractPhoneFromText } from '@/lib/whatsapp'
import { runWeddingAgent } from '@/lib/claude-agent'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')
  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge || '', { status: 200 })
  }
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

// Rate limit kontrolü — 60 saniyede max 3 mesaj
async function checkRateLimit(waId: string, kurumId: string): Promise<boolean> {
  const now = new Date()
  const sixtySecondsAgo = new Date(now.getTime() - 60 * 1000)

  const { data } = await supabaseAdmin
    .from('wa_rate_limit')
    .select('mesaj_zamanlari')
    .eq('wa_id', waId)
    .eq('kurum_id', kurumId)
    .single()

  const zamanlari: string[] = data?.mesaj_zamanlari || []
  const sonDakika = zamanlari.filter(z => new Date(z) > sixtySecondsAgo)

  if (sonDakika.length >= 3) return false // limit aşıldı

  // Güncelle
  sonDakika.push(now.toISOString())
  await supabaseAdmin.from('wa_rate_limit').upsert({
    wa_id: waId,
    kurum_id: kurumId,
    mesaj_zamanlari: sonDakika
  })
  return true
}

// Kara liste kontrolü
async function isBlocked(waId: string, kurumId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('blocked_numbers')
    .select('id')
    .eq('kurum_id', kurumId)
    .eq('telefon', waId)
    .single()
  return !!data
}

// Aktif event bul
async function getActiveEvent(kurumId: string) {
  const now = new Date().toISOString()
  const { data } = await supabaseAdmin
    .from('events')
    .select('id, ad')
    .eq('kurum_id', kurumId)
    .eq('aktif', true)
    .lte('baslangic', now)
    .gte('bitis', now)
    .limit(1)
  return data?.[0] || null
}

// Türkiye saatine göre selamlama
function getGreeting(): string {
  const trHour = new Date(new Date().getTime() + 3 * 60 * 60 * 1000).getUTCHours()
  if (trHour >= 6 && trHour < 12) return 'keyifli bir sabah'
  if (trHour >= 12 && trHour < 18) return 'keyifli bir öğle'
  if (trHour >= 18 && trHour < 24) return 'keyifli bir akşam'
  return 'keyifli bir gece'
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  if (body.object !== 'whatsapp_business_account') return NextResponse.json({ status: 'ok' })

  const msg = parseWebhookMessage(body)
  if (!msg || msg.type !== 'text' || !msg.text.trim()) return NextResponse.json({ status: 'ok' })

  // Mesaj karakter limiti — 500 karakter
  const messageText = msg.text.slice(0, 500)

  const phoneNumberId: string = msg.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || ''

  // Kurumu bul
  const { data: kurumlar } = await supabaseAdmin.from('kurumlar').select('*').eq('aktif', true)
  if (!kurumlar?.length) return NextResponse.json({ status: 'no active venue' })
  const kurum = kurumlar.find((k: any) => k.wa_phone_number_id === phoneNumberId) || kurumlar[0]

  // wa_id çöz
  const resolvedWaId = resolveWaId(msg.from, messageText)
  if (!resolvedWaId) {
    console.log('wa_id çözülemedi')
    await supabaseAdmin.from('wa_conversations').insert({ wa_id: 'unknown', kurum_id: kurum.id, role: 'user', content: messageText })
    return NextResponse.json({ status: 'ok' })
  }

  const waPhone = kurum.wa_phone_number_id || phoneNumberId
  const waToken = kurum.wa_access_token

  // Kara liste kontrolü
  const blocked = await isBlocked(resolvedWaId, kurum.id)
  if (blocked) {
    console.log('Engellenen numara:', resolvedWaId)
    return NextResponse.json({ status: 'ok' }) // sessizce yok say
  }

  // Boss kontrolü
  const bossNumbers: string[] = (kurum.boss_wa_numbers || []).map((n: string) => normalizePhone(n))
  const isBoss = bossNumbers.includes(resolvedWaId)

  // Rate limit — boss'a uygulanmaz
  if (!isBoss) {
    const allowed = await checkRateLimit(resolvedWaId, kurum.id)
    if (!allowed) {
      console.log('Rate limit aşıldı:', resolvedWaId)
      return NextResponse.json({ status: 'ok' }) // sessizce yok say
    }
  }

  // Aktif event kontrolü — boss'a uygulanmaz
  const activeEvent = await getActiveEvent(kurum.id)
  if (!isBoss && !activeEvent) {
    // Event yok — HR mesajı gönder
    const hrMesaj = `Merhaba, şu an aktif bir etkinliğimiz bulunmamaktadır.\n\nBize ulaşmak için Halkla İlişkiler departmanımızla iletişime geçebilirsiniz.\n\n*${kurum.ad}*`
    try {
      await sendWhatsAppMessage(resolvedWaId, hrMesaj, waPhone, waToken)
    } catch (e) { console.error('HR mesaj gönderilemedi:', e) }
    return NextResponse.json({ status: 'ok' })
  }

  // Form mesajı kontrolü
  const isFormMessage = messageText.includes('etkinliği için bildirim') && messageText.includes('Numara:')

  // Form mesajı gelince whatsapp_id güncelle
  if (isFormMessage) {
    const phoneInBody = extractPhoneFromText(messageText)
    if (phoneInBody) {
      const shortPhone = phoneInBody.replace(/^90/, '')
      await supabaseAdmin
        .from('form_gonderimleri')
        .update({ whatsapp_id: resolvedWaId })
        .eq('kurum_id', kurum.id)
        .is('whatsapp_id', null)
        .or(`telefon.eq.${phoneInBody},telefon.eq.${shortPhone},telefon.eq.0${shortPhone}`)
    }
  }

  // Aktif kayıt limiti kontrolü (max 5 açık kayıt) — boss'a uygulanmaz
  if (!isBoss && !isFormMessage) {
    const waShort = resolvedWaId.replace(/^90/, '')
    const { count } = await supabaseAdmin
      .from('form_gonderimleri')
      .select('*', { count: 'exact', head: true })
      .eq('kurum_id', kurum.id)
      .eq('durum', 'acik')
      .or(`telefon.eq.${resolvedWaId},telefon.eq.${waShort},whatsapp_id.eq.${resolvedWaId}`)

    if ((count || 0) >= 5) {
      const limitMesaj = `Merhaba, şu an sistemimizdeki açık talepleriniz maksimum sayıya ulaşmıştır.\n\nMevcut talepleriniz işleme alındıkça yeni bildirim yapabilirsiniz.\n\n*${kurum.ad}*`
      try { await sendWhatsAppMessage(resolvedWaId, limitMesaj, waPhone, waToken) } catch {}
      return NextResponse.json({ status: 'ok' })
    }
  }

  // Agent'a geçerken selamlama ve saat bilgisini ekle
  const greeting = getGreeting()
  const agentMessage = isFormMessage
    ? `[FORM_MESAJI — talep sisteme kaydedildi, save_request ÇAĞIRMA] ${messageText}`
    : messageText

  try {
    const reply = await runWeddingAgent({
      waId: resolvedWaId,
      message: agentMessage,
      kurum: { ...kurum, _greeting: greeting },
      isBoss,
      activeEventId: activeEvent?.id || null
    })

    await sendWhatsAppMessage(resolvedWaId, reply, waPhone, waToken)
  } catch (err: any) {
    console.error('Agent error:', err)
    try {
      await sendWhatsAppMessage(resolvedWaId, 'Üzgünüz, şu an teknik bir sorun yaşıyoruz. Lütfen birkaç dakika sonra tekrar deneyin.', waPhone, waToken)
    } catch {}
  }

  return NextResponse.json({ status: 'ok' })
}
