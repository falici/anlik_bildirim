import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { normalizePhone } from '@/lib/whatsapp'

export async function GET() {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('operasyon_personel')
    .select('*, kurum:kurumlar(id, ad)')
    .order('olusturulma', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const body = await req.json()
  const { kurum_id, ad, telefon, rol } = body

  if (!kurum_id) return NextResponse.json({ error: 'Kurum seçimi zorunlu' }, { status: 400 })
  if (!ad?.trim()) return NextResponse.json({ error: 'Ad zorunlu' }, { status: 400 })
  if (!telefon?.trim()) return NextResponse.json({ error: 'Telefon zorunlu' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('operasyon_personel')
    .insert({ kurum_id, ad: ad.trim(), telefon: normalizePhone(telefon), rol: rol?.trim() })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function PUT(req: NextRequest) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const body = await req.json()
  const { id, kurum_id, ad, telefon, rol, aktif } = body

  const update: Record<string, unknown> = { kurum_id, ad, rol, aktif }
  if (telefon) update.telefon = normalizePhone(telefon)

  const { data, error } = await supabaseAdmin
    .from('operasyon_personel')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  const { error } = await supabaseAdmin.from('operasyon_personel').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
