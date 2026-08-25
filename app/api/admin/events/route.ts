import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const kurumId = searchParams.get('kurum_id')

  let query = supabaseAdmin
    .from('events')
    .select('*, kurum:kurumlar(id, ad)')
    .order('baslangic', { ascending: false })

  if (kurumId) query = query.eq('kurum_id', kurumId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const body = await req.json()
  const { kurum_id, ad, aciklama, baslangic, bitis, konum } = body

  if (!kurum_id || !ad?.trim() || !baslangic || !bitis) {
    return NextResponse.json({ error: 'Zorunlu alanlar eksik' }, { status: 400 })
  }

  if (new Date(baslangic) >= new Date(bitis)) {
    return NextResponse.json({ error: 'Başlangıç tarihi bitiş tarihinden önce olmalı' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('events')
    .insert({ kurum_id, ad: ad.trim(), aciklama, baslangic, bitis, konum })
    .select('*, kurum:kurumlar(id, ad)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function PUT(req: NextRequest) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const body = await req.json()
  const { id, ad, aciklama, baslangic, bitis, konum, aktif } = body

  const { data, error } = await supabaseAdmin
    .from('events')
    .update({ ad, aciklama, baslangic, bitis, konum, aktif, guncelleme: new Date().toISOString() })
    .eq('id', id)
    .select('*, kurum:kurumlar(id, ad)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  const { error } = await supabaseAdmin.from('events').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
