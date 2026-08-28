import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { normalizePhone } from '@/lib/whatsapp'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const token = searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'Token gerekli' }, { status: 400 })

  const { data: qr, error: qrError } = await supabaseAdmin
    .from('qr_kodlar')
    .select('*, kurum:kurumlar(id, ad, aciklama, aktif, whatsapp_no)')
    .eq('token', token)
    .single()

  if (qrError || !qr) return NextResponse.json({ error: 'Geçersiz QR kod' }, { status: 404 })
  if (!qr.kurum?.aktif) return NextResponse.json({ error: 'Bu kurum aktif değil' }, { status: 403 })

  const now = new Date().toISOString()
  const { data: events, error: evError } = await supabaseAdmin
    .from('events')
    .select('*')
    .eq('kurum_id', qr.kurum_id)
    .eq('aktif', true)
    .lte('baslangic', now)
    .gte('bitis', now)
    .order('baslangic', { ascending: true })

  if (evError) return NextResponse.json({ error: evError.message }, { status: 500 })
  if (!events || events.length === 0) return NextResponse.json({ error: 'Şu an aktif bir etkinlik bulunmuyor' }, { status: 404 })

  const { data: kategoriler } = await supabaseAdmin.from('kategoriler').select('*').order('sira')

  return NextResponse.json({ event: events[0], kurum: qr.kurum, kategoriler: kategoriler || [] })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { token, telefon, kategoriler, diger_not, whatsapp_id } = body

  if (!token || !telefon?.trim() || !kategoriler?.length) {
    return NextResponse.json({ error: 'Zorunlu alanlar eksik' }, { status: 400 })
  }

  // Telefon normalize et — form'dan gelen numara
  const temizTelefon = normalizePhone(telefon)
  if (temizTelefon.length < 12) {
    return NextResponse.json({ error: 'Geçerli bir telefon numarası girin' }, { status: 400 })
  }

  const { data: qr } = await supabaseAdmin.from('qr_kodlar').select('kurum_id').eq('token', token).single()
  if (!qr) return NextResponse.json({ error: 'Geçersiz token' }, { status: 404 })

  const now = new Date().toISOString()
  const { data: events } = await supabaseAdmin
    .from('events').select('id')
    .eq('kurum_id', qr.kurum_id).eq('aktif', true)
    .lte('baslangic', now).gte('bitis', now)
    .order('baslangic', { ascending: true }).limit(1)

  if (!events || events.length === 0) return NextResponse.json({ error: 'Aktif etkinlik bulunamadı' }, { status: 404 })

  // telefon = formda yazılan numara (her zaman)
  // whatsapp_id = WA'dan gelen from (webhook'tan güncellenir, form numarası yazılmaz)
  const { data, error } = await supabaseAdmin
    .from('form_gonderimleri')
    .insert({
      kurum_id: qr.kurum_id,
      event_id: events[0].id,
      telefon: temizTelefon,  // formda yazılan
      whatsapp_id: null,      // webhook'tan gelecek gerçek WA from
      kategoriler,
      diger_not: diger_not?.trim() || null
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true, id: data.id }, { status: 201 })
}
