import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { signToken, COOKIE_NAME } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const { username, password } = await req.json()

  const adminUser = process.env.ADMIN_USERNAME || 'admin'
  const adminHash = process.env.ADMIN_PASSWORD_HASH || ''

  if (username !== adminUser) {
    return NextResponse.json({ error: 'Kullanıcı adı veya şifre hatalı' }, { status: 401 })
  }

  // Eğer hash yoksa direkt karşılaştır (geliştirme)
  let valid = false
  if (adminHash.startsWith('$2')) {
    valid = await bcrypt.compare(password, adminHash)
  } else {
    valid = password === (process.env.ADMIN_PASSWORD || 'admin123')
  }

  if (!valid) {
    return NextResponse.json({ error: 'Kullanıcı adı veya şifre hatalı' }, { status: 401 })
  }

  const token = await signToken({ role: 'admin', username })

  const res = NextResponse.json({ success: true })
  res.cookies.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 8, // 8 saat
    path: '/'
  })
  return res
}

export async function DELETE() {
  const res = NextResponse.json({ success: true })
  res.cookies.delete(COOKIE_NAME)
  return res
}
