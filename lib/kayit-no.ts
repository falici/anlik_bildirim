import { supabaseAdmin } from './supabase'

export async function generateKayitNo(kurumId: string): Promise<string> {
  const { data: kurum } = await supabaseAdmin
    .from('kurumlar')
    .select('ad')
    .eq('id', kurumId)
    .single()

  const ad = kurum?.ad || 'EVT'
  const kod = ad.replace(/[^a-zA-ZğüşıöçĞÜŞİÖÇ]/g, '').toUpperCase().slice(0, 3) || 'EVT'

  const { count } = await supabaseAdmin
    .from('form_gonderimleri')
    .select('*', { count: 'exact', head: true })
    .eq('kurum_id', kurumId)

  const sira = (count || 0) + 1
  return `${kod}-${String(sira).padStart(4, '0')}`
}
