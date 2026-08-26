import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/auth'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(req: NextRequest) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const kurumId = searchParams.get('kurum_id')

  const { data, error } = await supabaseAdmin
    .from('kurumlar')
    .select('id, ad, ai_system_prompt, ai_boss_prompt, boss_wa_numbers, wa_phone_number_id, wa_access_token, wa_verify_token')
    .eq('id', kurumId)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PUT(req: NextRequest) {
  const session = await requireAdmin()
  if (!session) return NextResponse.json({ error: 'Yetkisiz' }, { status: 401 })

  const body = await req.json()
  const { kurum_id, ai_system_prompt, ai_boss_prompt, boss_wa_numbers, wa_phone_number_id, wa_access_token, wa_verify_token } = body

  const { data, error } = await supabaseAdmin
    .from('kurumlar')
    .update({
      ai_system_prompt,
      ai_boss_prompt,
      boss_wa_numbers: Array.isArray(boss_wa_numbers) ? boss_wa_numbers : boss_wa_numbers?.split('\n').filter(Boolean),
      wa_phone_number_id,
      wa_access_token,
      wa_verify_token,
      guncelleme: new Date().toISOString()
    })
    .eq('id', kurum_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
