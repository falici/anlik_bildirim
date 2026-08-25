import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('kurumlar')
    .select('*')
    .order('olusturulma', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const body = await req.json()
  const { ad, aciklama, whatsapp_no } = body

  if (!ad?.trim()) return NextResponse.json({ error: 'Kurum adı zorunlu' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('kurumlar')
    .insert({ ad: ad.trim(), aciklama: aciklama?.trim(), whatsapp_no: whatsapp_no?.trim() })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function PUT(req: NextRequest) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const body = await req.json()
  const { id, ad, aciklama, aktif, whatsapp_no } = body

  const { data, error } = await supabaseAdmin
    .from('kurumlar')
    .update({ ad, aciklama, aktif, whatsapp_no, guncelleme: new Date().toISOString() })
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

  const { error } = await supabaseAdmin.from('kurumlar').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
