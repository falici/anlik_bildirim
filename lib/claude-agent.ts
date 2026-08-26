import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from './supabase'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// ── TOOLS ──────────────────────────────────────────────────────────────────

const weddingAssistantTools: Anthropic.Tool[] = [
  {
    name: 'read_active_event',
    description: 'Şu an aktif olan düğün/etkinlik bilgisini getirir',
    input_schema: {
      type: 'object' as const,
      properties: {
        kurum_id: { type: 'string', description: 'Kurum ID' }
      },
      required: ['kurum_id']
    }
  },
  {
    name: 'read_guest_history',
    description: 'Misafirin geçmiş taleplerini getirir (telefon numarasına göre)',
    input_schema: {
      type: 'object' as const,
      properties: {
        wa_id: { type: 'string', description: 'WhatsApp ID (telefon numarası)' },
        kurum_id: { type: 'string', description: 'Kurum ID' }
      },
      required: ['wa_id', 'kurum_id']
    }
  },
  {
    name: 'save_request',
    description: 'Misafirin talebini kayıt altına alır',
    input_schema: {
      type: 'object' as const,
      properties: {
        kurum_id: { type: 'string' },
        wa_id: { type: 'string' },
        ad_soyad: { type: 'string' },
        masa_no: { type: 'string' },
        talep: { type: 'string' },
        event_id: { type: 'string' }
      },
      required: ['kurum_id', 'wa_id', 'talep']
    }
  }
]

const managerAssistantTools: Anthropic.Tool[] = [
  {
    name: 'read_pending',
    description: 'Bekleyen (Bekliyor durumundaki) talepleri listeler',
    input_schema: {
      type: 'object' as const,
      properties: {
        kurum_id: { type: 'string' }
      },
      required: ['kurum_id']
    }
  },
  {
    name: 'update_status',
    description: 'Bir talebin durumunu günceller',
    input_schema: {
      type: 'object' as const,
      properties: {
        request_id: { type: 'string', description: 'Talep ID' },
        durum: { type: 'string', enum: ['tamamlandi', 'isleniyor', 'beklemede'] }
      },
      required: ['request_id', 'durum']
    }
  },
  {
    name: 'notify_customer',
    description: 'Müşteriye WhatsApp mesajı gönderir',
    input_schema: {
      type: 'object' as const,
      properties: {
        wa_id: { type: 'string' },
        message: { type: 'string' }
      },
      required: ['wa_id', 'message']
    }
  },
  {
    name: 'read_pending',
    description: 'Bekleyen talepleri listeler',
    input_schema: {
      type: 'object' as const,
      properties: { kurum_id: { type: 'string' } },
      required: ['kurum_id']
    }
  }
]

// ── TOOL EXECUTOR ──────────────────────────────────────────────────────────

async function executeTool(toolName: string, input: any, kurum: any): Promise<string> {
  try {
    switch (toolName) {
      case 'read_active_event': {
        const now = new Date().toISOString()
        const { data } = await supabaseAdmin
          .from('events')
          .select('*')
          .eq('kurum_id', input.kurum_id || kurum.id)
          .eq('aktif', true)
          .lte('baslangic', now)
          .gte('bitis', now)
          .order('baslangic')
          .limit(1)
        if (!data || data.length === 0) return JSON.stringify({ error: 'Aktif etkinlik bulunamadı' })
        return JSON.stringify(data[0])
      }

      case 'read_guest_history': {
        const { data } = await supabaseAdmin
          .from('form_gonderimleri')
          .select('*')
          .eq('kurum_id', input.kurum_id || kurum.id)
          .or(`telefon.eq.${input.wa_id},whatsapp_id.eq.${input.wa_id}`)
          .order('olusturulma', { ascending: false })
          .limit(5)
        return JSON.stringify(data || [])
      }

      case 'save_request': {
        // Aktif event bul
        const now = new Date().toISOString()
        const { data: events } = await supabaseAdmin
          .from('events')
          .select('id')
          .eq('kurum_id', input.kurum_id || kurum.id)
          .eq('aktif', true)
          .lte('baslangic', now)
          .gte('bitis', now)
          .limit(1)

        const eventId = input.event_id || events?.[0]?.id

        const { data, error } = await supabaseAdmin
          .from('form_gonderimleri')
          .insert({
            kurum_id: input.kurum_id || kurum.id,
            event_id: eventId,
            telefon: input.wa_id,
            whatsapp_id: input.wa_id,
            kategoriler: [input.talep],
            diger_not: input.masa_no ? `Masa: ${input.masa_no} | ${input.ad_soyad || ''}` : input.ad_soyad || '',
            durum: 'beklemede'
          })
          .select()
          .single()

        if (error) return JSON.stringify({ error: error.message })
        return JSON.stringify({ success: true, id: data.id })
      }

      case 'read_pending': {
        const { data } = await supabaseAdmin
          .from('form_gonderimleri')
          .select('*, event:events(ad)')
          .eq('kurum_id', input.kurum_id || kurum.id)
          .eq('durum', 'beklemede')
          .order('olusturulma', { ascending: false })
        return JSON.stringify(data || [])
      }

      case 'update_status': {
        const durumMap: Record<string, string> = {
          tamamlandi: 'tamamlandi',
          isleniyor: 'isleniyor',
          beklemede: 'beklemede'
        }
        const { data, error } = await supabaseAdmin
          .from('form_gonderimleri')
          .update({ durum: durumMap[input.durum] || 'tamamlandi', guncelleme: new Date().toISOString() })
          .eq('id', input.request_id)
          .select('*, event:events(ad)')
          .single()
        if (error) return JSON.stringify({ error: error.message })
        return JSON.stringify({ success: true, updated: data })
      }

      case 'notify_customer': {
        const { sendWhatsAppMessage } = await import('./whatsapp')
        await sendWhatsAppMessage(
          input.wa_id,
          input.message,
          kurum.wa_phone_number_id,
          kurum.wa_access_token
        )
        return JSON.stringify({ success: true })
      }

      default:
        return JSON.stringify({ error: `Bilinmeyen tool: ${toolName}` })
    }
  } catch (e: any) {
    return JSON.stringify({ error: e.message })
  }
}

// ── CONVERSATION MEMORY ────────────────────────────────────────────────────

async function getConversationHistory(waId: string, kurumId: string, limit = 10) {
  const { data } = await supabaseAdmin
    .from('wa_conversations')
    .select('role, content')
    .eq('wa_id', waId)
    .eq('kurum_id', kurumId)
    .order('created_at', { ascending: false })
    .limit(limit)

  return (data || []).reverse() as { role: 'user' | 'assistant'; content: string }[]
}

async function saveConversation(waId: string, kurumId: string, role: 'user' | 'assistant', content: string) {
  await supabaseAdmin.from('wa_conversations').insert({ wa_id: waId, kurum_id: kurumId, role, content })
}

// ── MAIN AGENT ─────────────────────────────────────────────────────────────

export async function runWeddingAgent(params: {
  waId: string
  message: string
  kurum: any
  isBoss: boolean
}) {
  const { waId, message, kurum, isBoss } = params

  // Konuşma geçmişini al
  const history = await getConversationHistory(waId, kurum.id)

  // Sistem promptunu belirle
  const systemPrompt = isBoss
    ? (kurum.ai_boss_prompt || getDefaultBossPrompt(kurum))
    : (kurum.ai_system_prompt || getDefaultGuestPrompt(kurum))

  // Araçları belirle
  const tools = isBoss ? managerAssistantTools : weddingAssistantTools

  // Mesajları hazırla
  const messages: Anthropic.MessageParam[] = [
    ...history.map(h => ({ role: h.role, content: h.content })),
    { role: 'user', content: message }
  ]

  // Kullanıcı mesajını kaydet
  await saveConversation(waId, kurum.id, 'user', message)

  // Claude'u çalıştır (tool loop)
  let response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: systemPrompt,
    tools: tools as any,
    messages
  })

  // Tool loop
  while (response.stop_reason === 'tool_use') {
    const toolUseBlocks = response.content.filter(b => b.type === 'tool_use')
    const toolResults: Anthropic.MessageParam = {
      role: 'user',
      content: await Promise.all(
        toolUseBlocks.map(async (block: any) => ({
          type: 'tool_result' as const,
          tool_use_id: block.id,
          content: await executeTool(block.name, block.input, kurum)
        }))
      )
    }

    messages.push({ role: 'assistant', content: response.content })
    messages.push(toolResults)

    response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system: systemPrompt,
      tools: tools as any,
      messages
    })
  }

  // Son yanıtı al
  const finalText = response.content
    .filter(b => b.type === 'text')
    .map((b: any) => b.text)
    .join('')

  // Asistan yanıtını kaydet
  await saveConversation(waId, kurum.id, 'assistant', finalText)

  return finalText
}

// ── DEFAULT PROMPTS ────────────────────────────────────────────────────────

function getDefaultGuestPrompt(kurum: any) {
  return `Sen ${kurum.ad} için görev yapan dijital misafir ilişkileri asistanısın.
Düğün esnasında WhatsApp üzerinden gelen misafir mesajlarını kibar, profesyonel ve çözüm odaklı şekilde yönet.
Asla yapay zeka olduğunu belirtme. Salonun doğal bir ekip üyesi gibi davran.
İletişim dili: Kurumsal ama sıcak, premium hizmet hissi veren, kısa ve zarif.
Her mesajda yalnızca tek adım ilerle.`
}

function getDefaultBossPrompt(kurum: any) {
  return `Sen ${kurum.ad} yöneticisine yardımcı olan asistansın.
Bekleyen talepleri listele, çözümlenen kayıtları güncelle, müşterileri bilgilendir.
Kısa, net ve profesyonel bir dille yardımcı ol.`
}
