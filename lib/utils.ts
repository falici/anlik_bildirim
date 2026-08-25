export function formatPhone(telefon: string): string {
  const t = telefon.replace(/\D/g, '')
  if (t.startsWith('90')) return `+${t}`
  if (t.startsWith('0')) return `+9${t}`
  return `+90${t}`
}

export function buildWhatsAppMessage(params: {
  kurumAd: string
  eventAd: string
  kategoriler: string[]
  digerNot?: string
  telefon: string
}): string {
  const { kurumAd, eventAd, kategoriler, digerNot, telefon } = params
  const kategorilerText = kategoriler.join(', ')
  const digerText = digerNot ? `\n\nEk not: ${digerNot}` : ''
  const ref = Date.now().toString(36).toUpperCase()

  return `Merhaba, *${kurumAd}* - *${eventAd}* etkinliği için geri bildirimim:\n\n📋 Konular: ${kategorilerText}${digerText}\n\n📞 Numaram: ${telefon}\n🔖 Referans: #${ref}`
}
