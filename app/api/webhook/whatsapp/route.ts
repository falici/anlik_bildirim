import { NextRequest, NextResponse } from 'next/server'
import { parseWebhookMessage, sendWhatsAppMessage, normalizePhone } from '@/lib/whatsapp'
import { runWeddingAgent } from '@/lib/claude-agent'
import { supabaseAdmin } from '@/lib/supabase'

// Webhook doğrulama (Meta'nın GET isteği)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 })
  }
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

// Gelen WA mesajları
export async function POST(req: NextRequest) {
  const body = await req.json()

  // Sadece mesaj eventlerini işle
  if (body.object !== 'whatsapp_business_account') {
    return NextResponse.json({ status: 'ok' })
  }

  const msg = parseWebhookMessage(body)
  if (!msg || msg.type !== 'text' || !msg.text.trim()) {
    return NextResponse.json({ status: 'ok' })
  }

  // Hangi kuruma ait bu phone number?
  const phoneNumberId = msg.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID
  
  // Kurumu bul (phone_number_id veya tek kurum)
  let kurum: any = null
  const { data: kurumlar } = await supabaseAdmin
    .from('kurumlar')
    .select('*')
    .eq('aktif', true)

  if (kurumlar && kurumlar.length > 0) {
    // Phone number ID'ye göre eşleştir, yoksa ilkini al
    kurum = kurumlar.find(k => k.wa_phone_number_id === phoneNumberId) || kurumlar[0]
  }

  if (!kurum) {
    return NextResponse.json({ status: 'no active venue' })
  }

  // Boss kontrolü
  const normalizedFrom = normalizePhone(msg.from || "")
  const bossNumbers: string[] = (kurum.boss_wa_numbers || []).map((n: string) => normalizePhone(n))
  const isBoss = bossNumbers.includes(normalizedFrom)

  try {
    // Claude agent'ı çalıştır
    const reply = await runWeddingAgent({
      waId: msg.from || "",
      message: msg.text,
      kurum,
      isBoss
    })

    // Yanıtı gönder
    await sendWhatsAppMessage(
      msg.from || "",
      reply,
      kurum.wa_phone_number_id || phoneNumberId,
      kurum.wa_access_token
    )
  } catch (err: any) {
    console.error('Agent error:', err)
    // Hata durumunda misafire bilgi ver
    try {
      await sendWhatsAppMessage(
        msg.from || "",
        'Üzgünüz, şu an teknik bir sorun yaşıyoruz. Lütfen birkaç dakika sonra tekrar deneyin.',
        kurum.wa_phone_number_id || phoneNumberId,
        kurum.wa_access_token
      )
    } catch {}
  }

  return NextResponse.json({ status: 'ok' })
}
