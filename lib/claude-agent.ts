import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from './supabase'
import { normalizePhone, extractPhoneFromText } from './whatsapp'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const FAST_MODEL = 'claude-haiku-4-5-20251001'

// wa_id öncelik sırası: 1) WA'dan gelen from 2) mesaj body'sinden yakalanan 3) form telefonu
function resolveWaId(waId: string, message: string): string {
  if (waId && waId.length > 4) return normalizePhone(waId)
  const fromBody = extractPhoneFromText(message)
  if (fromBody) return fromBody
  return waId
}

const weddingTools: Anthropic.Tool[] = [
  {
    name: 'read_active_event',
    description: 'Şu an aktif olan etkinlik bilgisini getirir',
    input_schema: { type: 'object' as const, properties: {}, required: [] }
  },
  {
    name: 'read_guest_history',
    description: 'Misafirin geçmiş taleplerini getirir',
    input_schema: {
      type: 'object' as const,
      properties: { wa_id: { type: 'string' } },
      required: ['wa_id']
    }
  },
  {
    name: 'save_request',
    description: 'Misafirin talebini kayıt altına alır',
    input_schema: {
      type: 'object' as const,
      properties: {
        wa_id: { type: 'string' },
        ad_soyad: { type: 'string' },
        masa_no: { type: 'string' },
        talep: { type: 'string' }
      },
      required: ['wa_id', 'talep']
    }
  }
]

const managerTools: Anthropic.Tool[] = [
  {
    name: 'read_pending',
    description: 'Bekleyen tüm talepleri listeler. Parametre gerekmez.',
    input_schema: { type: 'object' as const, properties: {}, required: [] }
  },
  {
    name: 'update_status',
    description: 'Bir talebin durumunu günceller',
    input_schema: {
      type: 'object' as const,
      properties: {
        request_id: { type: 'string' },
        durum: { type: 'string', enum: ['tamamlandi', 'isleniyor', 'beklemede'] }
      },
      required: ['request_id', 'durum']
    }
  },
  {
    name: 'notify_customer',
    description: 'Müşteriye WhatsApp mesajı gönderir. wa_id olarak telefon alanındaki değeri kullan.',
    input_schema: {
      type: 'object' as const,
      properties: {
        wa_id: { type: 'string' },
        message: { type: 'string' }
      },
      required: ['wa_id', 'message']
    }
  }
]

async function executeTool(toolName: string, input: any, kurum: any, waId: string): Promise<string> {
  try {
    switch (toolName) {

      case 'read_active_event': {
        const now = new Date().toISOString()
        const { data } = await supabaseAdmin
          .from('events').select('*')
          .eq('kurum_id', kurum.id).eq('aktif', true)
          .lte('baslangic', now).gte('bitis', now).limit(1)
        if (!data?.length) return JSON.stringify({ sonuc: 'Aktif etkinlik yok' })
        return JSON.stringify(data[0])
      }

      case 'read_guest_history': {
        const wa = normalizePhone(input.wa_id || waId)
        const waShort = wa.replace(/^90/, '')

        const { data } = await supabaseAdmin
          .from('form_gonderimleri').select('*')
          .eq('kurum_id', kurum.id)
          .or(`telefon.eq.${wa},telefon.eq.${waShort},telefon.eq.0${waShort},whatsapp_id.eq.${wa},whatsapp_id.eq.${waShort}`)
          .order('olusturulma', { ascending: false }).limit(5)

        // whatsapp_id boşsa güncelle
        if (data?.length && waId) {
          for (const row of data) {
            if (!row.whatsapp_id) {
              await supabaseAdmin.from('form_gonderimleri')
                .update({ whatsapp_id: wa })
                .eq('id', row.id)
            }
          }
        }

        return JSON.stringify(data?.length ? data : { sonuc: 'Geçmiş kayıt yok' })
      }

      case 'save_request': {
        const now = new Date().toISOString()
        const { data: events } = await supabaseAdmin
          .from('events').select('id')
          .eq('kurum_id', kurum.id).eq('aktif', true)
          .lte('baslangic', now).gte('bitis', now).limit(1)

        const wa = normalizePhone(input.wa_id || waId)
        const { data, error } = await supabaseAdmin.from('form_gonderimleri').insert({
          kurum_id: kurum.id,
          event_id: events?.[0]?.id,
          telefon: wa,
          whatsapp_id: wa,
          kategoriler: [input.talep],
          diger_not: [
            input.masa_no ? `Masa: ${input.masa_no}` : '',
            input.ad_soyad || ''
          ].filter(Boolean).join(' | '),
          durum: 'beklemede'
        }).select().single()

        if (error) return JSON.stringify({ hata: error.message })
        return JSON.stringify({ basarili: true, id: data.id })
      }

      case 'read_pending': {
        const { data } = await supabaseAdmin
          .from('form_gonderimleri')
          .select('id, telefon, whatsapp_id, kategoriler, diger_not, durum, olusturulma, event:events(ad)')
          .eq('kurum_id', kurum.id)
          .eq('durum', 'beklemede')
          .order('olusturulma', { ascending: false })

        if (!data?.length) return JSON.stringify({ sonuc: 'Bekleyen talep yok' })
        return JSON.stringify(data)
      }

      case 'update_status': {
        const { data, error } = await supabaseAdmin
          .from('form_gonderimleri')
          .update({ durum: input.durum, guncelleme: new Date().toISOString() })
          .eq('id', input.request_id)
          .eq('kurum_id', kurum.id)
          .select('id, telefon, whatsapp_id, kategoriler, durum')
          .single()

        if (error) return JSON.stringify({ hata: error.message })
        return JSON.stringify({ basarili: true, guncellenen: data })
      }

      case 'notify_customer': {
        const { sendWhatsAppMessage } = await import('./whatsapp')
        // wa_id öncelik: input → form telefonu → mevcut waId
        const wa = normalizePhone(input.wa_id || waId)
        if (!wa || wa.length < 10) return JSON.stringify({ hata: 'Geçerli numara bulunamadı' })
        await sendWhatsAppMessage(wa, input.message, kurum.wa_phone_number_id, kurum.wa_access_token)
        return JSON.stringify({ basarili: true, gonderildi: wa })
      }

      default:
        return JSON.stringify({ hata: `Bilinmeyen tool: ${toolName}` })
    }
  } catch (e: any) {
    return JSON.stringify({ hata: e.message })
  }
}

async function getHistory(waId: string, kurumId: string) {
  const { data } = await supabaseAdmin
    .from('wa_conversations').select('role, content')
    .eq('wa_id', waId).eq('kurum_id', kurumId)
    .order('created_at', { ascending: false }).limit(12)
  return (data || []).reverse() as { role: 'user' | 'assistant'; content: string }[]
}

async function saveMsg(waId: string, kurumId: string, role: 'user' | 'assistant', content: string) {
  await supabaseAdmin.from('wa_conversations')
    .insert({ wa_id: waId, kurum_id: kurumId, role, content })
}

export async function runWeddingAgent(params: {
  waId: string
  message: string
  kurum: any
  isBoss: boolean
}) {
  const { message, kurum, isBoss } = params

  // wa_id öncelik sırası: WA'dan gelen → body'den yakalanan
  const resolvedWaId = resolveWaId(params.waId, message)

  const history = await getHistory(resolvedWaId, kurum.id)
  const systemPrompt = isBoss ? getBossPrompt(kurum) : getGuestPrompt(kurum)
  const tools = isBoss ? managerTools : weddingTools

  const messages: Anthropic.MessageParam[] = [
    ...history.map(h => ({ role: h.role as 'user' | 'assistant', content: h.content })),
    { role: 'user', content: message }
  ]

  await saveMsg(resolvedWaId, kurum.id, 'user', message)

  let response = await anthropic.messages.create({
    model: FAST_MODEL,
    max_tokens: 1024,
    system: systemPrompt,
    tools,
    messages
  })

  while (response.stop_reason === 'tool_use') {
    const toolBlocks = response.content.filter(b => b.type === 'tool_use')
    const results: Anthropic.ToolResultBlockParam[] = await Promise.all(
      toolBlocks.map(async (b: any) => ({
        type: 'tool_result' as const,
        tool_use_id: b.id,
        content: await executeTool(b.name, b.input, kurum, resolvedWaId)
      }))
    )

    messages.push({ role: 'assistant', content: response.content })
    messages.push({ role: 'user', content: results })

    response = await anthropic.messages.create({
      model: FAST_MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      tools,
      messages
    })
  }

  const finalText = response.content
    .filter(b => b.type === 'text')
    .map((b: any) => b.text)
    .join('')

  await saveMsg(resolvedWaId, kurum.id, 'assistant', finalText)
  return finalText
}

function getGuestPrompt(kurum: any) {
  return kurum.ai_system_prompt || `Sen ${kurum.ad} için görev yapan misafir ilişkileri asistanısın. Kibar, profesyonel ve çözüm odaklı ol.`
}

function getBossPrompt(kurum: any) {
  return kurum.ai_boss_prompt || `Sen ${kurum.ad} yöneticisine yardımcı olan asistansın. Bekleyen talepleri listele, çözümlenen kayıtları güncelle, müşterileri bilgilendir.`
}
