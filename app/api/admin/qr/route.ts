import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'
import { randomBytes } from 'crypto'

export async function GET(req: NextRequest) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const kurumId = searchParams.get('kurum_id')

  let query = supabaseAdmin
    .from('qr_kodlar')
    .select('*, kurum:kurumlar(id, ad)')

  if (kurumId) query = query.eq('kurum_id', kurumId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const { kurum_id } = await req.json()
  if (!kurum_id) return NextResponse.json({ error: 'Kurum ID zorunlu' }, { status: 400 })

  // Varsa sil, yenisini oluştur
  await supabaseAdmin.from('qr_kodlar').delete().eq('kurum_id', kurum_id)

  const token = randomBytes(16).toString('hex')

  const { data, error } = await supabaseAdmin
    .from('qr_kodlar')
    .insert({ kurum_id, token })
    .select('*, kurum:kurumlar(id, ad)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
