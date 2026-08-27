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

// Tüm numaraları 90XXXXXXXXXX formatına normalize et
export function normalizePhone(phone: string): string {
  let p = phone.replace(/\D/g, '')
  if (p.startsWith('0')) p = '9' + p        // 05XX → 905XX
  if (!p.startsWith('90')) p = '90' + p      // 5XX → 905XX
  return p
}

// İki numaranın aynı kişi olup olmadığını kontrol et
export function isSamePhone(a: string, b: string): boolean {
  return normalizePhone(a) === normalizePhone(b)
}

// Mesaj body'sinden Türkiye numarası yakala
export function extractPhoneFromText(text: string): string | null {
  // +90, 90, 0 ile başlayan 10-11 haneli numaraları yakala
  const patterns = [
    /(?:\+90|90|0)[\s\-]?(?:\d[\s\-]?){10}/g,  // +90 veya 90 veya 0 ile başlayan
    /(?<!\d)5\d{2}[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}(?!\d)/g, // 5XX XXX XX XX
  ]
  
  for (const pattern of patterns) {
    const matches = text.match(pattern)
    if (matches) {
      const num = normalizePhone(matches[0])
      if (num.length === 12) return num // 90 + 10 hane
    }
  }
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

    // wa_id: önce from alanı, yoksa mesaj body'sinden çıkar
    let waId = rawFrom ? normalizePhone(rawFrom) : null
    let phoneFromBody: string | null = null

    if (!waId || waId.length < 10) {
      phoneFromBody = extractPhoneFromText(text)
      waId = phoneFromBody || rawFrom
    }

    return {
      messageId: message.id,
      from: waId,              // normalize edilmiş numara
      rawFrom,                 // ham hali
      phoneFromBody,           // body'den yakalandıysa
      text,
      type: message.type,
      timestamp: message.timestamp,
      name: contact?.profile?.name || '',
      phoneNumberId: value?.metadata?.phone_number_id,
    }
  } catch {
    return null
  }
}
