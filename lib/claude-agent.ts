import Anthropic from '@anthropic-ai/sdk'
import { supabaseAdmin } from './supabase'
import { normalizePhone, sendWhatsAppMessage } from './whatsapp'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const MODEL = 'claude-haiku-4-5-20251001'

// Sıra numarası → UUID mapping (oturum başına)
const pendingMap = new Map<string, string>()

// ── TOOLS ──────────────────────────────────────────────────────────────────

const weddingTools: Anthropic.Tool[] = [
  {
    name: 'read_active_event',
    description: 'Şu an aktif olan etkinlik bilgisini getirir',
    input_schema: { type: 'object' as const, properties: {}, required: [] }
  },
  {
    name: 'read_guest_history',
    description: 'Misafirin geçmiş taleplerini telefon numarasına göre getirir',
    input_schema: { type: 'object' as const, properties: {}, required: [] }
  },
  {
    name: 'save_request',
    description: 'Misafirin talebini/şikayetini kayıt altına alır',
    input_schema: {
      type: 'object' as const,
      properties: {
        ad_soyad: { type: 'string', description: 'Misafirin adı soyadı' },
        masa_no: { type: 'string', description: 'Masa numarası' },
        talep: { type: 'string', description: 'Talep veya şikayet konusu' }
      },
      required: ['talep']
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
    description: 'Bir veya birden fazla talebin durumunu günceller',
    input_schema: {
      type: 'object' as const,
      properties: {
        request_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Güncellenecek talep ID listesi (tek veya birden fazla)'
        },
        durum: {
          type: 'string',
          enum: ['tamamlandi', 'isleniyor', 'beklemede'],
          description: 'Yeni durum'
        }
      },
      required: ['request_ids', 'durum']
    }
  },
  {
    name: 'update_request_info',
    description: 'Bir talebe eksik bilgi ekler veya günceller (masa no, ad soyad, not)',
    input_schema: {
      type: 'object' as const,
      properties: {
        request_id: { type: 'string', description: 'Talep ID' },
        masa_no: { type: 'string', description: 'Masa numarası' },
        ad_soyad: { type: 'string', description: 'Ad soyad' },
        not: { type: 'string', description: 'Ek not' }
      },
      required: ['request_id']
    }
  },
  {
    name: 'send_message',
    description: 'Bir veya birden fazla müşteriye WhatsApp mesajı gönderir',
    input_schema: {
      type: 'object' as const,
      properties: {
        telefon: { type: 'string', description: 'Müşteri telefon numarası (telefon veya whatsapp_id alanından al)' },
        mesaj: { type: 'string', description: 'Gönderilecek mesaj' }
      },
      required: ['telefon', 'mesaj']
    }
  },
  {
    name: 'read_request_detail',
    description: 'Belirli bir talebin detayını getirir',
    input_schema: {
      type: 'object' as const,
      properties: {
        request_id: { type: 'string', description: 'Talep ID' }
      },
      required: ['request_id']
    }
  }
]

// ── TOOL EXECUTOR ──────────────────────────────────────────────────────────

async function executeTool(
  toolName: string,
  input: any,
  kurum: any,
  waId: string
): Promise<string> {
  try {
    switch (toolName) {

      case 'read_active_event': {
        const now = new Date().toISOString()
        const { data } = await supabaseAdmin
          .from('events').select('*')
          .eq('kurum_id', kurum.id).eq('aktif', true)
          .lte('baslangic', now).gte('bitis', now).limit(1)
        if (!data?.length) return JSON.stringify({ sonuc: 'Aktif etkinlik bulunamadı' })
        return JSON.stringify(data[0])
      }

      case 'read_guest_history': {
        // waId her zaman resolvedWaId — normalize edilmiş gerçek numara
        const waShort = waId.replace(/^90/, '')
        const { data } = await supabaseAdmin
          .from('form_gonderimleri').select('*')
          .eq('kurum_id', kurum.id)
          .or(`telefon.eq.${waId},telefon.eq.${waShort},telefon.eq.0${waShort},whatsapp_id.eq.${waId},whatsapp_id.eq.${waShort}`)
          .order('olusturulma', { ascending: false }).limit(5)

        // whatsapp_id boşsa doldur
        if (data?.length) {
          for (const row of data) {
            if (!row.whatsapp_id) {
              await supabaseAdmin.from('form_gonderimleri')
                .update({ whatsapp_id: waId })
                .eq('id', row.id)
            }
          }
        }
        return JSON.stringify(data?.length ? data : { sonuc: 'Geçmiş kayıt yok' })
      }

      case 'save_request': {
        // wa_id ASLA AI'dan alınmaz — her zaman resolvedWaId kullanılır
        // wa_id yoksa (unknown) kayıt oluşturulmaz
        if (!waId || waId === 'unknown' || waId.length < 10) {
          return JSON.stringify({ hata: 'Müşteri numarası bilinmiyor, kayıt oluşturulamaz' })
        }

        const now = new Date().toISOString()
        const { data: events } = await supabaseAdmin
          .from('events').select('id')
          .eq('kurum_id', kurum.id).eq('aktif', true)
          .lte('baslangic', now).gte('bitis', now).limit(1)

        const { data, error } = await supabaseAdmin.from('form_gonderimleri').insert({
          kurum_id: kurum.id,
          event_id: events?.[0]?.id,
          telefon: waId,       // resolvedWaId — gerçek numara
          whatsapp_id: waId,   // aynı
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

        // Sıra numarasını gerçek UUID'ye bağla — agent sadece sıra numarası kullanır
        // UUID'leri context'e sakla (global map)
        pendingMap.clear()
        data.forEach((row: any, i: number) => pendingMap.set(String(i + 1), row.id))

        const formatted = data.map((row: any, i: number) => ({
          sira: i + 1,         // Agent bu numarayı kullanır
          telefon: row.whatsapp_id || row.telefon,
          konu: row.kategoriler?.join(', '),
          not: row.diger_not,
          zaman: new Date(row.olusturulma).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
          etkinlik: row.event?.ad
        }))
        return JSON.stringify({ toplam: formatted.length, talepler: formatted })
      }

      case 'update_status': {
        const siralar: string[] = Array.isArray(input.request_ids)
          ? input.request_ids.map(String)
          : [String(input.request_ids)]

        const results = []
        for (const sira of siralar) {
          // Sıra numarasından gerçek UUID'yi bul
          const uuid = pendingMap.get(sira)
          if (!uuid) {
            results.push({ hata: `${sira}. sırada kayıt bulunamadı — önce 'read_pending' çalıştır`, sira })
            continue
          }

          const { data, error } = await supabaseAdmin
            .from('form_gonderimleri')
            .update({ durum: input.durum, guncelleme: new Date().toISOString() })
            .eq('id', uuid)
            .eq('kurum_id', kurum.id)
            .select('id, telefon, whatsapp_id, kategoriler, durum')
            .single()

          if (!error && data) results.push({ basarili: true, sira, telefon: data.whatsapp_id || data.telefon, konu: data.kategoriler?.join(', ') })
          else results.push({ hata: error?.message, sira })
        }
        return JSON.stringify(results)
      }

      case 'update_request_info': {
        const updates: Record<string, string> = {}
        if (input.masa_no) {
          updates.diger_not = `Masa: ${input.masa_no}${input.ad_soyad ? ' | ' + input.ad_soyad : ''}${input.not ? ' | ' + input.not : ''}`
        } else if (input.ad_soyad || input.not) {
          updates.diger_not = [input.ad_soyad, input.not].filter(Boolean).join(' | ')
        }

        const { data, error } = await supabaseAdmin
          .from('form_gonderimleri')
          .update({ ...updates, guncelleme: new Date().toISOString() })
          .eq('id', input.request_id)
          .eq('kurum_id', kurum.id)
          .select()
          .single()

        if (error) return JSON.stringify({ hata: error.message })
        return JSON.stringify({ basarili: true, guncellenen: data })
      }

      case 'send_message': {
        const telefon = normalizePhone(input.telefon)
        if (!telefon || telefon.length < 12) {
          return JSON.stringify({ hata: 'Geçersiz telefon numarası' })
        }
        await sendWhatsAppMessage(
          telefon,
          input.mesaj,
          kurum.wa_phone_number_id,
          kurum.wa_access_token
        )
        return JSON.stringify({ basarili: true, gonderildi: telefon })
      }

      case 'read_request_detail': {
        const { data, error } = await supabaseAdmin
          .from('form_gonderimleri')
          .select('*, event:events(ad)')
          .eq('id', input.request_id)
          .eq('kurum_id', kurum.id)
          .single()

        if (error) return JSON.stringify({ hata: error.message })
        return JSON.stringify(data)
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
    .order('created_at', { ascending: false }).limit(14)
  return (data || []).reverse() as { role: 'user' | 'assistant'; content: string }[]
}

async function saveMsg(waId: string, kurumId: string, role: 'user' | 'assistant', content: string) {
  await supabaseAdmin.from('wa_conversations')
    .insert({ wa_id: waId, kurum_id: kurumId, role, content })
}

// ── MAIN AGENT ─────────────────────────────────────────────────────────────

export async function runWeddingAgent(params: {
  waId: string
  message: string
  kurum: any
  isBoss: boolean
}) {
  const { waId, message, kurum, isBoss } = params

  const history = await getHistory(waId, kurum.id)
  const systemPrompt = isBoss ? getBossPrompt(kurum) : getGuestPrompt(kurum)
  const tools = isBoss ? managerTools : weddingTools

  const messages: Anthropic.MessageParam[] = [
    ...history.map(h => ({ role: h.role as 'user' | 'assistant', content: h.content })),
    { role: 'user', content: message }
  ]

  await saveMsg(waId, kurum.id, 'user', message)

  const firstToolChoice = isBoss ? { type: 'any' as const } : { type: 'auto' as const }

  let response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: systemPrompt,
    tools,
    tool_choice: firstToolChoice,
    messages
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
      model: MODEL,
      max_tokens: 1024,
      system: systemPrompt,
      tools,
      tool_choice: { type: 'auto' },
      messages
    })
  }

  const finalText = response.content
    .filter(b => b.type === 'text')
    .map((b: any) => b.text)
    .join('')

  await saveMsg(waId, kurum.id, 'assistant', finalText)
  return finalText
}

// ── PROMPTS ────────────────────────────────────────────────────────────────

function getGuestPrompt(kurum: any) {
  return kurum.ai_system_prompt || `Sen ${kurum.ad} için görev yapan dijital misafir ilişkileri asistanısın.
Misafir mesajlarını kibar, sıcak ve çözüm odaklı yönet. Asla yapay zeka olduğunu belirtme.
Her mesajda tek adım ilerle. Kısa ve zarif yaz. Önemli kelimeleri kalın yap (*kelime*).

AKIŞ:
1. İlk mesajda read_guest_history çalıştır — geçmiş kayıt varsa adıyla hitap et
2. Geçmiş yoksa read_active_event ile etkinliği öğren, sıcak karşıla
3. Talep netleşince ad soyad ve masa no iste (geçmişte biliniyorsa sorma)
4. Bilgiler tamamlanınca save_request ile kaydet, kapanış mesajı gönder`
}

function getBossPrompt(kurum: any) {
  return kurum.ai_boss_prompt || `Sen ${kurum.ad} yöneticisinin güvenilir asistanısın. Esnek, zeki ve çözüm odaklısın.

YETKİLERİN:
- read_pending → bekleyen tüm talepleri listele (parametre gerekmez)
- update_status → tek veya toplu talep kapat/işleme al (request_ids: sıra numaraları, örn: ["1","2"] veya ["1"])
- update_request_info → talebe eksik bilgi ekle (masa no, isim, not)
- send_message → herhangi bir müşteriye mesaj gönder
- read_request_detail → belirli bir talebin detayını getir

ÇALIŞMA TARZI:
- Yönetici ne isterse yap — katı adımlar değil, duruma göre hareket et
- "Hepsini çözdüm" → tüm bekleyenleri güncelle + hepsine bilgi gönder
- "1 ve 3'ü çözdüm" → sadece onları güncelle + onlara bilgi gönder
- "5 masaya sor bakalım ne istiyor" → send_message ile sor
- "Servis şikayeti nerede" → read_pending filtrele, durumu özetle
- Çözümleme yaptıktan sonra müşteriye MUTLAKA send_message ile bilgi ver:
  "Merhaba, ilettiğiniz *[konu]* talebiniz çözüme kavuşturulmuştur. Keyifli bir gece dileriz 🌹"
- send_message için telefon alanını kullan (whatsapp_id öncelikli, yoksa telefon)
- Yöneticiye işlem özeti ver: ne yapıldı, kime bildirildi

KURAL: update_status'tan ÖNCE mutlaka read_pending çalıştır — sıra numaralarını güncelle.
KURAL: update_status'a request_ids olarak sıra numaralarını gönder ("1", "2" gibi) — UUID değil.
KURAL: Güncelleme tool'u başarılı dönmeden çözüldü deme.
KURAL: Kısa, net, profesyonel — ama insan gibi konuş.`
}
