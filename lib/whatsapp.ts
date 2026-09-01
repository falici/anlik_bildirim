const WA_API_URL = 'https://graph.facebook.com/v19.0'

export async function sendWhatsAppMessage(
  to: string,
  message: string,
  phoneNumberId?: string,
  accessToken?: string
) {
  const phone = phoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID
  const token = accessToken || process.env.WHATSAPP_ACCESS_TOKEN

  const res = await fetch(`${WA_API_URL}/${phone}/messages`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: normalizePhone(to),
      type: 'text',
      text: { body: message }
    })
  })

  if (!res.ok) {
    const err = await res.json()
    throw new Error(`WA API Error: ${JSON.stringify(err)}`)
  }
  return res.json()
}

export function normalizePhone(phone: string): string {
  let p = phone.replace(/\D/g, '')
  if (p.startsWith('0')) p = '9' + p
  if (!p.startsWith('90')) p = '90' + p
  return p
}

// Mesaj içinden Türkiye telefon numarası yakala
// Form mesajındaki "📞 Numara: 5512342439" formatını ve serbest yazılan numaraları destekler
export function extractPhoneFromText(text: string): string | null {
  if (!text) return null

  // Önce "📞 Numara:" veya "Numara:" satırını ara — form mesajı formatı
  const numaraLine = text.match(/(?:📞\s*)?[Nn]umara\s*[:：]\s*([0-9\s\-\+]+)/i)
  if (numaraLine) {
    const cleaned = normalizePhone(numaraLine[1].replace(/\s/g, ''))
    if (cleaned.length >= 12) return cleaned
  }

  // Sonra serbest formatta Türkiye numarası ara
  const patterns = [
    /(?:\+90|90)\s?5\d{2}\s?\d{3}\s?\d{2}\s?\d{2}/,  // +905XX veya 905XX
    /0\s?5\d{2}\s?\d{3}\s?\d{2}\s?\d{2}/,              // 05XX
    /5\d{2}\s?\d{3}\s?\d{2}\s?\d{2}/,                  // 5XX (10 hane)
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) {
      const cleaned = normalizePhone(match[0])
      if (cleaned.length >= 12) return cleaned
    }
  }

  return null
}

// wa_id öncelik sırası:
// 1. WA'dan gelen from alanı
// 2. Mesaj body'sinden yakalanan numara
// 3. null (yanıt verilemez)
export function resolveWaId(from: string | null | undefined, messageText: string): string | null {
  // 1. from varsa ve geçerliyse kullan
  if (from && from.replace(/\D/g, '').length >= 10) {
    return normalizePhone(from)
  }

  // 2. Mesaj body'sinden numara yakala
  const fromBody = extractPhoneFromText(messageText)
  if (fromBody) return fromBody

  // 3. Yanıt verilemez
  return null
}

export function parseWebhookMessage(body: any) {
  try {
    const entry = body?.entry?.[0]
    const changes = entry?.changes?.[0]
    const value = changes?.value
    const message = value?.messages?.[0]
    const contact = value?.contacts?.[0]

    if (!message) return null

    const rawFrom = message.from || ''
    const text = message.text?.body || ''
    const media = message.image || message.video || message.document

    return {
      messageId: message.id,
      from: rawFrom || null,
      text,
      type: message.type,
      timestamp: message.timestamp,
      name: contact?.profile?.name || '',
      phoneNumberId: value?.metadata?.phone_number_id,
      mediaId: media?.id,
      mediaMimeType: media?.mime_type,
    }
  } catch {
    return null
  }
}

// WhatsApp Media API — mediaId'den dosyayı indirir (iki adımlı: URL çöz, sonra indir)
export async function getWhatsAppMedia(
  mediaId: string,
  phoneNumberId?: string,
  accessToken?: string
): Promise<{ buffer: Buffer; mimeType: string } | null> {
  const token = accessToken || process.env.WHATSAPP_ACCESS_TOKEN

  try {
    const metaRes = await fetch(`${WA_API_URL}/${mediaId}`, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!metaRes.ok) {
      console.error('WA medya meta alınamadı:', metaRes.status, await metaRes.text())
      return null
    }
    const meta = await metaRes.json()

    const fileRes = await fetch(meta.url, {
      headers: { Authorization: `Bearer ${token}` }
    })
    if (!fileRes.ok) {
      console.error('WA medya dosyası indirilemedi:', fileRes.status, await fileRes.text())
      return null
    }

    const arrayBuffer = await fileRes.arrayBuffer()
    return { buffer: Buffer.from(arrayBuffer), mimeType: meta.mime_type || 'application/octet-stream' }
  } catch (e) {
    console.error('WA medya indirme hatası:', e)
    return null
  }
}
