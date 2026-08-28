import { NextRequest, NextResponse } from 'next/server'
import { parseWebhookMessage, sendWhatsAppMessage, resolveWaId, normalizePhone } from '@/lib/whatsapp'
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

export async function POST(req: NextRequest) {
  const body = await req.json()

  if (body.object !== 'whatsapp_business_account') {
    return NextResponse.json({ status: 'ok' })
  }

  const msg = parseWebhookMessage(body)
  if (!msg || msg.type !== 'text' || !msg.text.trim()) {
    return NextResponse.json({ status: 'ok' })
  }

  const phoneNumberId: string = msg.phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || ''

  // Kurumu bul
  const { data: kurumlar } = await supabaseAdmin
    .from('kurumlar')
    .select('*')
    .eq('aktif', true)

  if (!kurumlar?.length) {
    return NextResponse.json({ status: 'no active venue' })
  }

  const kurum = kurumlar.find((k: any) => k.wa_phone_number_id === phoneNumberId) || kurumlar[0]

  // wa_id çöz — öncelik: from → body'den numara → null
  const resolvedWaId = resolveWaId(msg.from, msg.text)

  // Boss kontrolü
  const bossNumbers: string[] = (kurum.boss_wa_numbers || []).map((n: string) => normalizePhone(n))
  const isBoss = resolvedWaId ? bossNumbers.includes(resolvedWaId) : false

  // wa_id yoksa — anonim kayıt log'la, yanıt veremeyiz
  if (!resolvedWaId) {
    console.log('wa_id çözülemedi. Mesaj:', msg.text.slice(0, 100))
    // Anonim konuşma kaydı tut
    await supabaseAdmin.from('wa_conversations').insert({
      wa_id: 'unknown',
      kurum_id: kurum.id,
      role: 'user',
      content: msg.text
    })
    return NextResponse.json({ status: 'ok' })
  }

  try {
    const reply = await runWeddingAgent({
      waId: resolvedWaId,
      message: msg.text,
      kurum,
      isBoss
    })

    await sendWhatsAppMessage(
      resolvedWaId,
      reply,
      kurum.wa_phone_number_id || phoneNumberId,
      kurum.wa_access_token
    )
  } catch (err: any) {
    console.error('Agent error:', err)
    try {
      await sendWhatsAppMessage(
        resolvedWaId,
        'Üzgünüz, şu an teknik bir sorun yaşıyoruz. Lütfen birkaç dakika sonra tekrar deneyin.',
        kurum.wa_phone_number_id || phoneNumberId,
        kurum.wa_access_token
      )
    } catch {}
  }

  return NextResponse.json({ status: 'ok' })
}
