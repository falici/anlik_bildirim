import Anthropic from '@anthropic-ai/sdk'

export const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 3 })

export const PRIMARY_MODEL = 'claude-haiku-4-5-20251001'
const FALLBACK_MODEL = 'claude-sonnet-5'

// Anthropic API ara sıra 529 (overloaded_error) dönebiliyor. SDK zaten
// otomatik retry yapıyor (maxRetries) ama bir model üzerinde sürekli
// yoğunluk yaşanırsa retry'lar da yetmeyebilir — bu durumda aynı isteği
// farklı bir modelle (ayrı kapasite havuzu) bir kez daha deneriz.
export async function createMessage(
  params: Omit<Anthropic.MessageCreateParamsNonStreaming, 'model'> & { model?: string }
): Promise<Anthropic.Message> {
  const model = params.model || PRIMARY_MODEL
  try {
    return await anthropic.messages.create({ ...params, model } as any)
  } catch (e: any) {
    if (e?.status === 529 && model !== FALLBACK_MODEL) {
      console.error(`${model} overloaded (529) — ${FALLBACK_MODEL} ile tekrar deneniyor`)
      return await anthropic.messages.create({ ...params, model: FALLBACK_MODEL } as any)
    }
    throw e
  }
}
