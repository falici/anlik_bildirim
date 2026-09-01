import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from './supabase'
import { getWhatsAppMedia } from './whatsapp'
import { generateKayitNo } from './kayit-no'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const MODEL = 'claude-haiku-4-5-20251001'
const BUCKET = 'operasyon-medya'

// ── MEDYA ──────────────────────────────────────────────────────────────────

async function uploadOperasyonMedia(buffer: Buffer, mimeType: string, kurumId: string): Promise<string | null> {
  const ext = mimeType.split('/')[1]?.split(';')[0] || 'bin'
  const path = `${kurumId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

  const { error } = await supabaseAdmin.storage.from(BUCKET).upload(path, buffer, {
    contentType: mimeType,
    upsert: false
  })
  if (error) {
    console.error('Operasyon medya upload hatası:', error)
    return null
  }

  const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path)
  return data.publicUrl
}

// ── TOOLS ──────────────────────────────────────────────────────────────────

const operasyonTools: Anthropic.Tool[] = [
  {
    name: 'save_operasyon_request',
    description: 'Bakım/onarım/temizlik talebini kayıt altına alır ve kayıt numarası döner. Mesajda birden fazla ayrı sorun varsa HER biri için AYRI çağır.',
    input_schema: {
      type: 'object' as const,
      properties: {
        kategori: { type: 'string', enum: ['Elektrik', 'Temizlik', 'Teknik', 'Diğer'], description: 'Sorunun kategorisi' },
        konum: { type: 'string', description: 'Sorunun yeri (örn: Salon B, 3 nolu tuvalet, mutfak)' },
        aciklama: { type: 'string', description: 'Sorunun kısa açıklaması' }
      },
      required: ['kategori', 'aciklama']
    }
  }
]

async function executeTool(
  toolName: string,
  input: any,
  kurum: any,
  personel: any,
  medyaUrl: string | null,
  medyaTip: string | null
): Promise<string> {
  if (toolName !== 'save_operasyon_request') {
    return JSON.stringify({ hata: `Bilinmeyen tool: ${toolName}` })
  }

  try {
    const kayitNo = await generateKayitNo(kurum.id)
    const digerNot = [
      input.konum ? `Konum: ${input.konum}` : '',
      input.aciklama || '',
      `Personel: ${personel.ad}${personel.rol ? ` (${personel.rol})` : ''}`
    ].filter(Boolean).join(' | ')

    const { error } = await supabaseAdmin.from('form_gonderimleri').insert({
      kurum_id: kurum.id,
      tip: 'operasyon',
      telefon: personel.telefon,
      whatsapp_id: personel.telefon,
      kategoriler: [input.kategori],
      diger_not: digerNot,
      medya_url: medyaUrl,
      medya_tip: medyaTip,
      durum: 'acik',
      kayit_no: kayitNo
    })

    if (error) return JSON.stringify({ hata: error.message })
    return JSON.stringify({ basarili: true, kayit_no: kayitNo, kategori: input.kategori, konum: input.konum || '' })
  } catch (e: any) {
    return JSON.stringify({ hata: e.message })
  }
}

// ── MEMORY ─────────────────────────────────────────────────────────────────

async function getHistory(waId: string, kurumId: string) {
  const { data } = await supabaseAdmin
    .from('wa_conversations')
    .select('role, content')
    .eq('wa_id', waId).eq('kurum_id', kurumId)
    .order('created_at', { ascending: false })
    .limit(6)
  return (data || []).reverse() as { role: 'user' | 'assistant'; content: string }[]
}

async function saveMsg(waId: string, kurumId: string, role: 'user' | 'assistant', content: string) {
  await supabaseAdmin.from('wa_conversations').insert({ wa_id: waId, kurum_id: kurumId, role, content })
}

// ── PROMPT ─────────────────────────────────────────────────────────────────

function getSystemPrompt(personel: any) {
  return `Sen bir tesis/etkinlik mekanının operasyon (bakım-onarım) asistanısın. Şu anda iç personel ${personel.ad}${personel.rol ? ` (${personel.rol})` : ''} ile konuşuyorsun. Bu bir misafir değil, personel — kısa, net ve iş odaklı yaz. Emoji kullanma.

GÖREV:
- Personelin bildirdiği arıza/bakım/temizlik sorununu analiz et
- Fotoğraf gönderildiyse görüntüyü de dikkate al, gördüklerini açıklamaya kat
- Mesajda BİRDEN FAZLA ayrı sorun varsa (örn: "lamba patladı ve tuvalet tıkandı") HER biri için AYRI save_operasyon_request çağır
- Kategori seç: Elektrik, Temizlik, Teknik, Diğer
- Konum belirtilmişse (salon, oda, tuvalet no vb.) konum alanına yaz

KESİN KURALLAR:
- Her sorun için MUTLAKA save_operasyon_request çağır — tool çağırmadan "kaydettim" deme
- Tüm kayıtlar oluşunca dönen kayıt numaralarıyla kısa bir onay mesajı yaz, örn:
  "Kaydedildi: [kayit_no] — [kategori] — [konum]" (birden fazlaysa alt alta)
- Netleştirme gerekmedikçe soru sorma, elindeki bilgiyle direkt kaydet`
}

// ── MAIN ───────────────────────────────────────────────────────────────────

export async function runOperasyonAgent(params: {
  waId: string
  message: string
  kurum: any
  personel: any
  mediaId?: string
  mediaType?: string
}) {
  const { waId, message, kurum, personel, mediaId, mediaType } = params

  let medyaUrl: string | null = null
  let medyaTip: string | null = null
  let imageBlock: any = null

  if (mediaId) {
    const media = await getWhatsAppMedia(mediaId, kurum.wa_phone_number_id, kurum.wa_access_token)
    if (media) {
      medyaTip = media.mimeType
      medyaUrl = await uploadOperasyonMedia(media.buffer, media.mimeType, kurum.id)
      if (mediaType === 'image' && media.mimeType.startsWith('image/')) {
        imageBlock = {
          type: 'image',
          source: { type: 'base64', media_type: media.mimeType, data: media.buffer.toString('base64') }
        }
      }
    }
  }

  const history = await getHistory(waId, kurum.id)
  const systemPrompt = getSystemPrompt(personel)

  const userContent = imageBlock
    ? [imageBlock, { type: 'text', text: message || '[Fotoğraf gönderildi]' }]
    : message

  const messages: Anthropic.MessageParam[] = [
    ...history.map(h => ({ role: h.role as 'user' | 'assistant', content: h.content })),
    { role: 'user', content: userContent }
  ]

  await saveMsg(waId, kurum.id, 'user', message || '[Medya gönderildi]')

  let response = await anthropic.messages.create({
    model: MODEL, max_tokens: 512,
    system: [{
      type: 'text',
      text: systemPrompt,
      cache_control: { type: 'ephemeral' }
    }] as any,
    tools: operasyonTools.map((t, i) =>
      i === operasyonTools.length - 1
        ? { ...t, cache_control: { type: 'ephemeral' } }
        : t
    ) as any,
    tool_choice: { type: 'auto' }, messages
  })

  while (response.stop_reason === 'tool_use') {
    const toolBlocks = response.content.filter(b => b.type === 'tool_use')
    const results: Anthropic.ToolResultBlockParam[] = await Promise.all(
      toolBlocks.map(async (b: any) => ({
        type: 'tool_result' as const,
        tool_use_id: b.id,
        content: await executeTool(b.name, b.input, kurum, personel, medyaUrl, medyaTip)
      }))
    )
    messages.push({ role: 'assistant', content: response.content })
    messages.push({ role: 'user', content: results })

    response = await anthropic.messages.create({
      model: MODEL, max_tokens: 512,
      system: [{
        type: 'text',
        text: systemPrompt,
        cache_control: { type: 'ephemeral' }
      }] as any,
      tools: operasyonTools.map((t, i) =>
        i === operasyonTools.length - 1
          ? { ...t, cache_control: { type: 'ephemeral' } }
          : t
      ) as any,
      tool_choice: { type: 'auto' }, messages
    })
  }

  const finalText = response.content.filter(b => b.type === 'text').map((b: any) => b.text).join('')
  await saveMsg(waId, kurum.id, 'assistant', finalText)
  return finalText
}
