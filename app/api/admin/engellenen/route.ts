import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const kurumId = searchParams.get('kurum_id')

  let query = supabaseAdmin
    .from('blocked_numbers')
    .select('*, kurum:kurumlar(id, ad)')
    .order('olusturulma', { ascending: false })

  if (kurumId) query = query.eq('kurum_id', kurumId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const { kurum_id, telefon, sebep } = await req.json()
  if (!kurum_id || !telefon?.trim()) {
    return NextResponse.json({ error: 'Kurum ve telefon zorunlu' }, { status: 400 })
  }

  const temizTelefon = telefon.replace(/\D/g, '')
    .replace(/^0/, '90')
    .replace(/^(?!90)/, '90')

  const { data, error } = await supabaseAdmin
    .from('blocked_numbers')
    .insert({ kurum_id, telefon: temizTelefon, sebep: sebep?.trim() || null })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  const { error } = await supabaseAdmin.from('blocked_numbers').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
