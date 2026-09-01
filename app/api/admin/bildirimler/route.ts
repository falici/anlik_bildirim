import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const kurumId = searchParams.get('kurum_id')
  const durum = searchParams.get('durum') // 'acik' | 'kapali' | null (hepsi)
  const tip = searchParams.get('tip') // 'misafir' | 'operasyon' | null (hepsi)

  let query = supabaseAdmin
    .from('form_gonderimleri')
    .select(`*, kurum:kurumlar(id, ad), event:events(id, ad)`)
    .order('olusturulma', { ascending: false })

  if (kurumId) query = query.eq('kurum_id', kurumId)
  if (tip) query = query.eq('tip', tip)
  if (durum) query = query.eq('durum', durum)
  else query = query.eq('durum', 'acik') // varsayılan: açık olanlar

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PUT(req: NextRequest) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const { id, durum, kapatan_not } = await req.json()

  const { data, error } = await supabaseAdmin
    .from('form_gonderimleri')
    .update({ 
      durum, 
      kapatan_not: kapatan_not || null,
      guncelleme: new Date().toISOString() 
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
