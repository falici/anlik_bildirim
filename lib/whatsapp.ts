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
  return phone.replace(/\D/g, '').replace(/^0/, '90')
}

export function parseWebhookMessage(body: any) {
  try {
    const entry = body?.entry?.[0]
    const changes = entry?.changes?.[0]
    const value = changes?.value
    const message = value?.messages?.[0]
    const contact = value?.contacts?.[0]

    if (!message) return null

    return {
      messageId: message.id,
      from: message.from, // wa_id (numara)
      text: message.text?.body || '',
      type: message.type,
      timestamp: message.timestamp,
      name: contact?.profile?.name || '',
      phoneNumberId: value?.metadata?.phone_number_id,
    }
  } catch {
    return null
  }
}
