import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from './supabase'
import { normalizePhone, sendWhatsAppMessage } from './whatsapp'
import { generateKayitNo } from './kayit-no'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const MODEL = 'claude-haiku-4-5-20251001'

// ── KAYIT NO ───────────────────────────────────────────────────────────────



// ── PENDING SESSION ────────────────────────────────────────────────────────

async function savePendingSession(kurumId: string, bossWaId: string, mapping: Record<string, string>) {
  await supabaseAdmin.from('wa_conversations').insert({
    wa_id: `pending_session_${bossWaId}`,
    kurum_id: kurumId,
    role: 'assistant',
    content: JSON.stringify({ type: 'pending_map', mapping })
  })
}

async function getPendingSession(kurumId: string, bossWaId: string): Promise<Record<string, string>> {
  const { data } = await supabaseAdmin
    .from('wa_conversations')
    .select('content')
    .eq('wa_id', `pending_session_${bossWaId}`)
    .eq('kurum_id', kurumId)
    .order('created_at', { ascending: false })
    .limit(1)

  if (!data?.length) return {}
  try {
    const parsed = JSON.parse(data[0].content)
    if (parsed.type === 'pending_map') return parsed.mapping
  } catch {}
  return {}
}

// ── TOOLS ──────────────────────────────────────────────────────────────────

const weddingTools: Anthropic.Tool[] = [
  {
    name: 'read_active_event',
    description: 'Şu an aktif olan etkinlik bilgisini getirir',
    input_schema: { type: 'object' as const, properties: {}, required: [] }
  },
  {
    name: 'read_guest_history',
    description: 'Misafirin geçmiş taleplerini getirir',
    input_schema: { type: 'object' as const, properties: {}, required: [] }
  },
  {
    name: 'save_request',
    description: 'Misafirin talebini/isteğini/şikayetini kayıt altına alır. Kayıt numarası döner.',
    input_schema: {
      type: 'object' as const,
      properties: {
        ad_soyad: { type: 'string', description: 'Misafirin adı soyadı' },
        masa_no: { type: 'string', description: 'Masa numarası' },
        talep: { type: 'string', description: 'Talep, istek veya şikayet konusu' }
      },
      required: ['talep']
    }
  },
  {
    name: 'update_request_info',
    description: 'Mevcut kayda eksik bilgi ekler (masa no, ad soyad, not)',
    input_schema: {
      type: 'object' as const,
      properties: {
        kayit_no: { type: 'string', description: 'Kayıt numarası (örn: FLM-0001)' },
        masa_no: { type: 'string' },
        ad_soyad: { type: 'string' },
        not: { type: 'string' }
      },
      required: ['kayit_no']
    }
  }
]

const managerTools: Anthropic.Tool[] = [
  {
    name: 'read_pending',
    description: 'Bekleyen tüm talepleri kayıt numarasıyla listeler. Parametre gerekmez.',
    input_schema: { type: 'object' as const, properties: {}, required: [] }
  },
  {
    name: 'update_status',
    description: 'Kayıt numarasına göre talep durumunu günceller',
    input_schema: {
      type: 'object' as const,
      properties: {
        kayit_nolar: {
          type: 'array',
          items: { type: 'string' },
          description: 'Güncellenecek kayıt numaraları: ["FLM-0001"] veya ["FLM-0001","FLM-0002"]'
        },
        durum: {
          type: 'string',
          enum: ['tamamlandi', 'isleniyor', 'beklemede']
        }
      },
      required: ['kayit_nolar', 'durum']
    }
  },
  {
    name: 'update_request_info',
    description: 'Kayıt numarasıyla talebe eksik bilgi ekler',
    input_schema: {
      type: 'object' as const,
      properties: {
        kayit_no: { type: 'string' },
        masa_no: { type: 'string' },
        ad_soyad: { type: 'string' },
        not: { type: 'string' }
      },
      required: ['kayit_no']
    }
  },
  {
    name: 'send_message',
    description: 'Müşteriye WhatsApp mesajı gönderir',
    input_schema: {
      type: 'object' as const,
      properties: {
        telefon: { type: 'string', description: 'whatsapp_id varsa onu, yoksa telefon alanını kullan' },
        mesaj: { type: 'string' }
      },
      required: ['telefon', 'mesaj']
    }
  }
]

// ── TOOL EXECUTOR ──────────────────────────────────────────────────────────

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
        const waShort = waId.replace(/^90/, '')
        const { data } = await supabaseAdmin
          .from('form_gonderimleri').select('*')
          .eq('kurum_id', kurum.id)
          .or(`telefon.eq.${waId},telefon.eq.${waShort},telefon.eq.0${waShort},whatsapp_id.eq.${waId},whatsapp_id.eq.${waShort}`)
          .order('olusturulma', { ascending: false }).limit(5)

        if (data?.length) {
          for (const row of data) {
            if (!row.whatsapp_id) {
              await supabaseAdmin.from('form_gonderimleri').update({ whatsapp_id: waId }).eq('id', row.id)
            }
          }
        }
        return JSON.stringify(data?.length ? data : { sonuc: 'Geçmiş kayıt yok' })
      }

      case 'save_request': {
        if (!waId || waId.length < 10) {
          return JSON.stringify({ hata: 'Müşteri numarası bilinmiyor' })
        }
        const now = new Date().toISOString()
        const { data: events } = await supabaseAdmin
          .from('events').select('id')
          .eq('kurum_id', kurum.id).eq('aktif', true)
          .lte('baslangic', now).gte('bitis', now).limit(1)

        const kayitNo = await generateKayitNo(kurum.id)

        const { data, error } = await supabaseAdmin.from('form_gonderimleri').insert({
          kurum_id: kurum.id,
          event_id: events?.[0]?.id,
          telefon: waId,
          whatsapp_id: waId,
          kategoriler: [input.talep],
          diger_not: [input.masa_no ? `Masa: ${input.masa_no}` : '', input.ad_soyad || ''].filter(Boolean).join(' | '),
          durum: 'beklemede',
          kayit_no: kayitNo
        }).select().single()

        if (error) return JSON.stringify({ hata: error.message })
        return JSON.stringify({ basarili: true, kayit_no: kayitNo })
      }

      case 'read_pending': {
        const { data } = await supabaseAdmin
          .from('form_gonderimleri')
          .select('id, kayit_no, telefon, whatsapp_id, kategoriler, diger_not, durum, olusturulma, event:events(ad)')
          .eq('kurum_id', kurum.id)
          .eq('durum', 'beklemede')
          .order('olusturulma', { ascending: false })

        if (!data?.length) return JSON.stringify({ sonuc: 'Bekleyen talep yok' })

        // kayit_no → id mapping DB'ye kaydet
        const mapping: Record<string, string> = {}
        data.forEach((row: any) => {
          if (row.kayit_no) mapping[row.kayit_no] = row.id
        })
        await savePendingSession(kurum.id, waId, mapping)

        const liste = data.map((row: any) => ({
          kayit_no: row.kayit_no || 'N/A',
          telefon: row.whatsapp_id || row.telefon,
          konu: (row.kategoriler || []).join(', '),
          not: row.diger_not || '',
          saat: new Date(row.olusturulma).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
          etkinlik: (row as any).event?.ad || ''
        }))

        return JSON.stringify({ toplam: liste.length, talepler: liste })
      }

      case 'update_status': {
        const mapping = await getPendingSession(kurum.id, waId)
        const kayitNolar: string[] = Array.isArray(input.kayit_nolar)
          ? input.kayit_nolar
          : [input.kayit_nolar]

        const results = []
        for (const kayitNo of kayitNolar) {
          // Önce mapping'den bak, sonra direkt DB'den ara
          let uuid = mapping[kayitNo]
          if (!uuid) {
            const { data: found } = await supabaseAdmin
              .from('form_gonderimleri')
              .select('id, telefon, whatsapp_id, kategoriler')
              .eq('kayit_no', kayitNo)
              .eq('kurum_id', kurum.id)
              .single()
            if (found) uuid = found.id
          }

          if (!uuid) {
            results.push({ hata: `${kayitNo} bulunamadı`, kayit_no: kayitNo })
            continue
          }

          const { data, error } = await supabaseAdmin
            .from('form_gonderimleri')
            .update({ durum: input.durum, guncelleme: new Date().toISOString() })
            .eq('id', uuid)
            .eq('kurum_id', kurum.id)
            .select('id, kayit_no, telefon, whatsapp_id, kategoriler, durum')
            .single()

          if (!error && data) {
            results.push({
              basarili: true,
              kayit_no: kayitNo,
              telefon: data.whatsapp_id || data.telefon,
              konu: (data.kategoriler || []).join(', ')
            })
          } else {
            results.push({ hata: error?.message, kayit_no: kayitNo })
          }
        }
        return JSON.stringify(results)
      }

      case 'update_request_info': {
        const { data: found } = await supabaseAdmin
          .from('form_gonderimleri')
          .select('id, diger_not')
          .eq('kayit_no', input.kayit_no)
          .eq('kurum_id', kurum.id)
          .single()

        if (!found) return JSON.stringify({ hata: `${input.kayit_no} bulunamadı` })

        const notParts = [
          input.masa_no ? `Masa: ${input.masa_no}` : '',
          input.ad_soyad || '',
          input.not || ''
        ].filter(Boolean)

        const { data, error } = await supabaseAdmin
          .from('form_gonderimleri')
          .update({ diger_not: notParts.join(' | '), guncelleme: new Date().toISOString() })
          .eq('id', found.id)
          .select().single()

        if (error) return JSON.stringify({ hata: error.message })
        return JSON.stringify({ basarili: true, kayit_no: input.kayit_no })
      }

      case 'send_message': {
        const tel = normalizePhone(input.telefon)
        if (!tel || tel.length < 12) return JSON.stringify({ hata: 'Geçersiz numara' })
        await sendWhatsAppMessage(tel, input.mesaj, kurum.wa_phone_number_id, kurum.wa_access_token)
        return JSON.stringify({ basarili: true, gonderildi: tel })
      }

      default:
        return JSON.stringify({ hata: `Bilinmeyen tool: ${toolName}` })
    }
  } catch (e: any) {
    return JSON.stringify({ hata: e.message })
  }
}

// ── MEMORY ─────────────────────────────────────────────────────────────────

async function getHistory(waId: string, kurumId: string) {
  const { data } = await supabaseAdmin
    .from('wa_conversations').select('role, content')
    .eq('wa_id', waId).eq('kurum_id', kurumId)
    .not('content', 'like', '%pending_map%')
    .order('created_at', { ascending: false }).limit(8)
  return (data || []).reverse() as { role: 'user' | 'assistant'; content: string }[]
}

async function saveMsg(waId: string, kurumId: string, role: 'user' | 'assistant', content: string) {
  await supabaseAdmin.from('wa_conversations').insert({ wa_id: waId, kurum_id: kurumId, role, content })
}

// ── MAIN ───────────────────────────────────────────────────────────────────

export async function runWeddingAgent(params: {
  waId: string; message: string; kurum: any; isBoss: boolean
}) {
  const { waId, message, kurum, isBoss } = params

  const history = await getHistory(waId, kurum.id)
  const systemPrompt = isBoss ? getBossPrompt(kurum) : getGuestPrompt(kurum)
  const tools = isBoss ? managerTools : weddingTools
  const maxTokens = isBoss ? 1024 : 512

  const messages: Anthropic.MessageParam[] = [
    ...history.map(h => ({ role: h.role as 'user' | 'assistant', content: h.content })),
    { role: 'user', content: message }
  ]

  await saveMsg(waId, kurum.id, 'user', message)

  let response = await anthropic.messages.create({
    model: MODEL, max_tokens: maxTokens, system: systemPrompt,
    tools, tool_choice: { type: 'auto' }, messages
  })

  while (response.stop_reason === 'tool_use') {
    const toolBlocks = response.content.filter(b => b.type === 'tool_use')
    const results: Anthropic.ToolResultBlockParam[] = await Promise.all(
      toolBlocks.map(async (b: any) => ({
        type: 'tool_result' as const,
        tool_use_id: b.id,
        content: await executeTool(b.name, b.input, kurum, waId)
      }))
    )
    messages.push({ role: 'assistant', content: response.content })
    messages.push({ role: 'user', content: results })

    response = await anthropic.messages.create({
      model: MODEL, max_tokens: maxTokens, system: systemPrompt,
      tools, tool_choice: { type: 'auto' }, messages
    })
  }

  const finalText = response.content.filter(b => b.type === 'text').map((b: any) => b.text).join('')
  await saveMsg(waId, kurum.id, 'assistant', finalText)
  return finalText
}

// ── PROMPTS ────────────────────────────────────────────────────────────────

function getGuestPrompt(kurum: any) {
  return kurum.ai_system_prompt || `Sen ${kurum.ad} için görev yapan dijital misafir ilişkileri asistanısın.
Misafir mesajlarını kibar, sıcak ve çözüm odaklı yönet. Asla yapay zeka olduğunu belirtme.
Her mesajda tek adım ilerle. Kısa ve zarif yaz. Önemli kelimeleri kalın yap (*kelime*). Emoji kullanma.

AKIŞ:
1. İlk mesajda read_guest_history çalıştır — geçmiş kayıt varsa adıyla hitap et
2. Geçmiş yoksa read_active_event ile etkinliği öğren, sıcak karşıla
3. Talep netleşince: masa no ve ad geçmişten biliniyorsa SORMA, direkt save_request çağır
4. save_request başarılı olunca dönen kayit_no ile kapanış mesajı gönder:
   "Talebiniz *[kayit_no]* numarasıyla kayıt altına alınmıştır. Ekibimiz en kısa sürede masanıza gelecektir."

KESİN KURALLAR:
- Her yeni talep/istek/şikayet için MUTLAKA save_request çağır — tool çağırmadan yanıt verme
- save_request çağırmadan "yönlendirdim / ekip gidiyor / hallettim" DEME
- Önceki kayıt olması yeni kayıt açmaya ENGEL DEĞİL — her talep ayrı kayıt
- Masa no ve ad önceki konuşmadan biliniyorsa tekrar SORMA — direkt save_request çağır
- Misafir birden fazla istekte bulunursa (örn: "su ve şemsiye") tek save_request ile birleştir
- Misafir ek bilgi verirse HEMEN update_request_info ile kaydet
- [FORM_MESAJI] etiketi olan mesajlarda save_request ÇAĞIRMA — zaten kayıtlı`
}

function getBossPrompt(kurum: any) {
  return kurum.ai_boss_prompt || `Sen ${kurum.ad} yöneticisinin güvenilir asistanısın.

YETKİLERİN:
- read_pending → bekleyen talepleri KAYIT NUMARASIYLA listeler (FLM-0001 gibi)
- update_status → kayit_nolar: ["FLM-0001"] veya ["FLM-0001","FLM-0002"] ile güncelle
- update_request_info → kayit_no ile talebe bilgi ekle
- send_message → müşteriye mesaj gönder

ÇALIŞMA TARZI:
- "Bekleyen var mı / listele" → read_pending çalıştır
- "FLM-0001 çözüldü" → update_status → send_message ile müşteriye bildir
- "Hepsini çözdüm" → read_pending → tüm kayıt nolarını update_status → hepsine send_message
- "FLM-0002'ye sor" → o kaydın telefon numarasını bul → send_message ile gönder
- Çözümleme sonrası müşteriye: "Merhaba, ilettiğiniz *[konu]* talebiniz çözüme kavuşturulmuştur. Keyifli bir gece dileriz."

KESİN KURALLAR:
- update_status'a kayıt numarasını ver ("FLM-0001") — başka hiçbir şey değil
- Güncelleme başarılı olmadan çözüldü deme
- Kayıt bulunamazsa read_pending çalıştır, güncel listeyi al ve kullanıcıya belirt
- send_message için: whatsapp_id varsa onu, yoksa telefon alanını kullan
- Çözümleme sonrası send_message ZORUNLU — atlamak yasak
- Boss özel mesaj yazmışsa onu ilet, yazmamışsa standart mesajı gönder
- Emoji kullanma
- Kısa, net, profesyonel yaz`
}
