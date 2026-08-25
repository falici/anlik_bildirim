export interface Kurum {
  id: string
  ad: string
  aciklama?: string
  logo_url?: string
  aktif: boolean
  olusturulma: string
  guncelleme: string
}

export interface Event {
  id: string
  kurum_id: string
  ad: string
  aciklama?: string
  baslangic: string
  bitis: string
  konum?: string
  aktif: boolean
  olusturulma: string
  guncelleme: string
  kurum?: Kurum
}

export interface QRKod {
  id: string
  kurum_id: string
  token: string
  olusturulma: string
  kurum?: Kurum
}

export interface Kategori {
  id: string
  ad: string
  ikon?: string
  sira: number
}

export interface FormGonderimi {
  id: string
  kurum_id: string
  event_id: string
  telefon: string
  whatsapp_id?: string
  kategoriler: string[]
  diger_not?: string
  durum: 'beklemede' | 'isleniyor' | 'tamamlandi'
  olusturulma: string
  guncelleme: string
  kurum?: Kurum
  event?: Event
}

export interface ActiveEventResponse {
  event: Event
  kurum: Kurum
  kategoriler: Kategori[]
}
