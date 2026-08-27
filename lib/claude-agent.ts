import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from './supabase'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const weddingTools: Anthropic.Tool[] = [
  {
    name: 'read_active_event',
    description: 'Şu an aktif olan etkinlik bilgisini getirir',
    input_schema: { type: 'object' as const, properties: { kurum_id: { type: 'string' } }, required: ['kurum_id'] }
  },
  {
    name: 'read_guest_history',
    description: 'Misafirin geçmiş taleplerini getirir',
    input_schema: { type: 'object' as const, properties: { wa_id: { type: 'string' }, kurum_id: { type: 'string' } }, required: ['wa_id', 'kurum_id'] }
  },
  {
    name: 'save_request',
    description: 'Misafirin talebini kayıt altına alır',
    input_schema: { type: 'object' as const, properties: { kurum_id: { type: 'string' }, wa_id: { type: 'string' }, ad_soyad: { type: 'string' }, masa_no: { type: 'string' }, talep: { type: 'string' } }, required: ['kurum_id', 'wa_id', 'talep'] }
  }
]

const managerTools: Anthropic.Tool[] = [
  {
    name: 'read_pending',
    description: 'Bekleyen talepleri listeler',
    input_schema: { type: 'object' as const, properties: { kurum_id: { type: 'string' } }, required: ['kurum_id'] }
  },
  {
    name: 'update_status',
    description: 'Bir talebin durumunu günceller',
    input_schema: { type: 'object' as const, properties: { request_id: { type: 'string' }, durum: { type: 'string' } }, required: ['request_id', 'durum'] }
  },
  {
    name: 'notify_customer',
    description: 'Müşteriye WhatsApp mesajı gönderir',
    input_schema: { type: 'object' as const, properties: { wa_id: { type: 'string' }, message: { type: 'string' } }, required: ['wa_id', 'message'] }
  }
]

async function executeTool(toolName: string, input: any, kurum: any): Promise<string> {
  try {
    switch (toolName) {
      case 'read_active_event': {
        const now = new Date().toISOString()
        const { data } = await supabaseAdmin.from('events').select('*').eq('kurum_id', input.kurum_id || kurum.id).eq('aktif', true).lte('baslangic', now).gte('bitis', now).limit(1)
        if (!data?.length) return JSON.stringify({ error: 'Aktif etkinlik yok' })
        return JSON.stringify(data[0])
      }
      case 'read_guest_history': {
        const { data } = await supabaseAdmin.from('form_gonderimleri').select('*').eq('kurum_id', input.kurum_id || kurum.id).or(`telefon.eq.${input.wa_id},whatsapp_id.eq.${input.wa_id}`).order('olusturulma', { ascending: false }).limit(5)
        return JSON.stringify(data || [])
      }
      case 'save_request': {
        const now = new Date().toISOString()
        const { data: events } = await supabaseAdmin.from('events').select('id').eq('kurum_id', input.kurum_id || kurum.id).eq('aktif', true).lte('baslangic', now).gte('bitis', now).limit(1)
        const { data, error } = await supabaseAdmin.from('form_gonderimleri').insert({
          kurum_id: input.kurum_id || kurum.id,
          event_id: events?.[0]?.id,
          telefon: input.wa_id,
          whatsapp_id: input.wa_id,
          kategoriler: [input.talep],
          diger_not: [input.masa_no ? `Masa: ${input.masa_no}` : '', input.ad_soyad || ''].filter(Boolean).join(' | '),
          durum: 'beklemede'
        }).select().single()
        if (error) return JSON.stringify({ error: error.message })
        return JSON.stringify({ success: true, id: data.id })
      }
      case 'read_pending': {
        const { data } = await supabaseAdmin.from('form_gonderimleri').select('*, event:events(ad)').eq('kurum_id', input.kurum_id || kurum.id).eq('durum', 'beklemede').order('olusturulma', { ascending: false })
        return JSON.stringify(data || [])
      }
      case 'update_status': {
        const { data, error } = await supabaseAdmin.from('form_gonderimleri').update({ durum: input.durum, guncelleme: new Date().toISOString() }).eq('id', input.request_id).select().single()
        if (error) return JSON.stringify({ error: error.message })
        return JSON.stringify({ success: true, updated: data })
      }
      case 'notify_customer': {
        const { sendWhatsAppMessage } = await import('./whatsapp')
        await sendWhatsAppMessage(input.wa_id, input.message, kurum.wa_phone_number_id, kurum.wa_access_token)
        return JSON.stringify({ success: true })
      }
      default:
        return JSON.stringify({ error: `Bilinmeyen tool: ${toolName}` })
    }
  } catch (e: any) {
    return JSON.stringify({ error: e.message })
  }
}

async function getHistory(waId: string, kurumId: string) {
  const { data } = await supabaseAdmin.from('wa_conversations').select('role, content').eq('wa_id', waId).eq('kurum_id', kurumId).order('created_at', { ascending: false }).limit(10)
  return (data || []).reverse() as { role: 'user' | 'assistant'; content: string }[]
}

async function saveMsg(waId: string, kurumId: string, role: 'user' | 'assistant', content: string) {
  await supabaseAdmin.from('wa_conversations').insert({ wa_id: waId, kurum_id: kurumId, role, content })
}

export async function runWeddingAgent(params: { waId: string; message: string; kurum: any; isBoss: boolean }) {
  const { waId, message, kurum, isBoss } = params
  const history = await getHistory(waId, kurum.id)
  const systemPrompt = isBoss
    ? (kurum.ai_boss_prompt || `Sen ${kurum.ad} yöneticisine yardımcı olan asistansın. Bekleyen talepleri listele, çözümlenen kayıtları güncelle, müşterileri bilgilendir.`)
    : (kurum.ai_system_prompt || `Sen ${kurum.ad} için görev yapan misafir ilişkileri asistanısın. Kibar, profesyonel ve çözüm odaklı ol.`)
  const tools = isBoss ? managerTools : weddingTools

  const messages: Anthropic.MessageParam[] = [
    ...history.map(h => ({ role: h.role as 'user' | 'assistant', content: h.content })),
    { role: 'user', content: message }
  ]

  await saveMsg(waId, kurum.id, 'user', message)

  let response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: systemPrompt,
    tools,
    messages
  })

  while (response.stop_reason === 'tool_use') {
    const toolBlocks = response.content.filter(b => b.type === 'tool_use')
    const toolResults: Anthropic.MessageParam = {
      role: 'user',
      content: await Promise.all(toolBlocks.map(async (b: any) => ({
        type: 'tool_result' as const,
        tool_use_id: b.id,
        content: await executeTool(b.name, b.input, kurum)
      })))
    }
    messages.push({ role: 'assistant', content: response.content })
    messages.push(toolResults)
    response = await anthropic.messages.create({ model: 'claude-sonnet-4-6', max_tokens: 1024, system: systemPrompt, tools, messages })
  }

  const finalText = response.content.filter(b => b.type === 'text').map((b: any) => b.text).join('')
  await saveMsg(waId, kurum.id, 'assistant', finalText)
  return finalText
}
