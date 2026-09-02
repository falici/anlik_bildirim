import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from './supabase'
import { getWhatsAppMedia } from './whatsapp'
import { generateKayitNo } from './kayit-no'
import { createMessage } from './anthropic-client'

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

// Personel "kaydet" demeden önce gönderdiği fotoğraf — kaydetme anına kadar
// hatırlanır ki geç gelen "kaydet" mesajında da doğru medya_url eklensin.
async function savePendingMedia(waId: string, kurumId: string, url: string, mimeType: string) {
  await supabaseAdmin.from('wa_conversations').insert({
    wa_id: `pending_media_${waId}`,
    kurum_id: kurumId,
    role: 'assistant',
    content: JSON.stringify({ type: 'pending_media', url, mimeType })
  })
}

async function getPendingMedia(waId: string, kurumId: string): Promise<{ url: string; mimeType: string } | null> {
  const { data } = await supabaseAdmin
    .from('wa_conversations')
    .select('content')
    .eq('wa_id', `pending_media_${waId}`)
    .eq('kurum_id', kurumId)
    .order('created_at', { ascending: false })
    .limit(1)

  if (!data?.length) return null
  try {
    const parsed = JSON.parse(data[0].content)
    if (parsed.type === 'pending_media') return { url: parsed.url, mimeType: parsed.mimeType }
  } catch {}
  return null
}

async function clearPendingMedia(waId: string, kurumId: string) {
  await supabaseAdmin.from('wa_conversations').delete().eq('wa_id', `pending_media_${waId}`).eq('kurum_id', kurumId)
}

// ── PROMPT ─────────────────────────────────────────────────────────────────

function getSystemPrompt(personel: any) {
  return `Sen bir tesis/etkinlik mekanının deneyimli, çevik operasyon koordinatörüsün. Şu anda iç personel ${personel.ad}${personel.rol ? ` (${personel.rol})` : ''} ile konuşuyorsun. Bu bir misafir değil, personel — kısa, net ve iş odaklı yaz. Emoji kullanma.

NASIL DAVRANMALISIN (çok önemli):
Telefonla arayan bir operasyon çalışanı gibi düşün. Biri "toplantı odasına su servisi yapar mısın" dese, deneyimli bir çalışan sadece işi yapmak için GEREKEN bilgiyi sorar (örn: "kaç kişilik?"), cevabı alır almaz "tamam, hallediyorum" der ve işe koyulur. "Kaydedeyim mi?" diye ayrıca izin istemez, ping-pong yapmaz.

Sen de böyle davran:
- Talep net ve iş için yeterli bilgi varsa (konum + ne istendiği belli) DİREKT save_operasyon_request çağır — "kaydedeyim mi?" diye sorup onay bekleme
- İşi yapmak için gerçekten eksik ve önemli bir bilgi varsa (kaç kişilik, hangi oda/nokta, ne zamana kadar vb.) SADECE o eksik bilgiyi sor — gereksiz yere sormaya devam etme
- Eksik bilgi geldiği anda (örn. kişi sayısı söylenince) HEMEN kaydet, tekrar onay isteme
- Mesajda BİRDEN FAZLA ayrı sorun varsa HER biri için AYRI save_operasyon_request çağır
- Sıradan selamlaşma / net bir ihtiyaç belirtmeyen mesajlarda kayıt AÇMA — sadece gerçek bir talep/arıza olduğunda kaydet

DOLDURMA:
- Kategori seç: Elektrik, Temizlik, Teknik, Diğer
- Konum belirtilmişse (salon, oda, tuvalet no vb.) konum alanına yaz
- aciklama alanına personelin verdiği somut bilgileri (ne, nerede, kaç kişi/adet vb.) özetle; kendi tahminini uydurma, fotoğraf gönderilmiş olsa bile görüntüyü yorumlama — istersen genel iş bilgini sadece kısa bir NOT olarak ekleyebilirsin ama personelin söylediğiyle çelişmesin

- Kayıt oluşunca dönen kayıt numarasıyla kısa bir onay yaz, örn: "Kaydedildi: [kayit_no] — [kategori] — [konum]" (birden fazlaysa alt alta). Çağırmadan "kaydettim" deme.`
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

  // Fotoğraf Storage'a yüklenir ve kayda eklenir ama Claude'a görsel olarak
  // gönderilmez — AI görüntüyü yorumlamaz, token da harcamaz. Kategori/konum/
  // açıklama tamamen personelin yazdığı metinden çıkarılır.
  if (mediaId) {
    const media = await getWhatsAppMedia(mediaId, kurum.wa_phone_number_id, kurum.wa_access_token)
    if (media) {
      medyaTip = media.mimeType
      medyaUrl = await uploadOperasyonMedia(media.buffer, media.mimeType, kurum.id)
      // "kaydet" mesajı daha sonra ayrı bir turda gelebilir — o zamana kadar hatırla
      if (medyaUrl) await savePendingMedia(waId, kurum.id, medyaUrl, medyaTip)
    }
  }

  // Bu turda yeni fotoğraf gelmediyse, daha önce bekleyen bir fotoğraf var mı bak
  if (!medyaUrl) {
    const pending = await getPendingMedia(waId, kurum.id)
    if (pending) {
      medyaUrl = pending.url
      medyaTip = pending.mimeType
    }
  }

  const history = await getHistory(waId, kurum.id)
  const systemPrompt = getSystemPrompt(personel)

  const messages: Anthropic.MessageParam[] = [
    ...history.map(h => ({ role: h.role as 'user' | 'assistant', content: h.content })),
    { role: 'user', content: message || '[Fotoğraf gönderildi]' }
  ]

  await saveMsg(waId, kurum.id, 'user', message || '[Medya gönderildi]')

  let response = await createMessage({
    max_tokens: 512,
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

  let kaydedildi = false

  while (response.stop_reason === 'tool_use') {
    const toolBlocks = response.content.filter(b => b.type === 'tool_use')
    const results: Anthropic.ToolResultBlockParam[] = await Promise.all(
      toolBlocks.map(async (b: any) => {
        const sonuc = await executeTool(b.name, b.input, kurum, personel, medyaUrl, medyaTip)
        if (JSON.parse(sonuc)?.basarili) kaydedildi = true
        return { type: 'tool_result' as const, tool_use_id: b.id, content: sonuc }
      })
    )
    messages.push({ role: 'assistant', content: response.content })
    messages.push({ role: 'user', content: results })

    response = await createMessage({
      max_tokens: 512,
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

  if (kaydedildi) await clearPendingMedia(waId, kurum.id)

  const finalText = response.content.filter(b => b.type === 'text').map((b: any) => b.text).join('')
  await saveMsg(waId, kurum.id, 'assistant', finalText)
  return finalText
}
