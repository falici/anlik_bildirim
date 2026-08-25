-- =============================================
-- Event QR Yönetim Sistemi - Supabase Schema
-- =============================================

-- Kurumlar tablosu
CREATE TABLE IF NOT EXISTS kurumlar (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ad TEXT NOT NULL,
  aciklama TEXT,
  logo_url TEXT,
  aktif BOOLEAN DEFAULT true,
  olusturulma TIMESTAMPTZ DEFAULT now(),
  guncelleme TIMESTAMPTZ DEFAULT now()
);

-- Eventler tablosu
CREATE TABLE IF NOT EXISTS events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  kurum_id UUID REFERENCES kurumlar(id) ON DELETE CASCADE,
  ad TEXT NOT NULL,
  aciklama TEXT,
  baslangic TIMESTAMPTZ NOT NULL,
  bitis TIMESTAMPTZ NOT NULL,
  konum TEXT,
  aktif BOOLEAN DEFAULT true,
  olusturulma TIMESTAMPTZ DEFAULT now(),
  guncelleme TIMESTAMPTZ DEFAULT now()
);

-- QR Kodlar tablosu (bir kuruma ait tek QR)
CREATE TABLE IF NOT EXISTS qr_kodlar (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  kurum_id UUID REFERENCES kurumlar(id) ON DELETE CASCADE UNIQUE,
  token TEXT NOT NULL UNIQUE,
  olusturulma TIMESTAMPTZ DEFAULT now()
);

-- Şikayet / İstek kategorileri
CREATE TABLE IF NOT EXISTS kategoriler (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ad TEXT NOT NULL,
  ikon TEXT,
  sira INTEGER DEFAULT 0
);

-- Varsayılan kategoriler
INSERT INTO kategoriler (ad, ikon, sira) VALUES
  ('Servis Yavaş', '🍽️', 1),
  ('Temizlik', '🧹', 2),
  ('Müzik / Ses', '🎵', 3),
  ('İkram Kalitesi', '⭐', 4),
  ('Personel Tutumu', '👤', 5),
  ('Mekan Düzeni', '🏛️', 6),
  ('Diğer', '💬', 7)
ON CONFLICT DO NOTHING;

-- Form gönderileri tablosu
CREATE TABLE IF NOT EXISTS form_gonderimleri (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  kurum_id UUID REFERENCES kurumlar(id),
  event_id UUID REFERENCES events(id),
  telefon TEXT NOT NULL,
  whatsapp_id TEXT,
  kategoriler TEXT[] NOT NULL DEFAULT '{}',
  diger_not TEXT,
  durum TEXT DEFAULT 'beklemede' CHECK (durum IN ('beklemede', 'isleniyor', 'tamamlandi')),
  olusturulma TIMESTAMPTZ DEFAULT now(),
  guncelleme TIMESTAMPTZ DEFAULT now()
);

-- RLS (Row Level Security) - Service role bypass
ALTER TABLE kurumlar ENABLE ROW LEVEL SECURITY;
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
ALTER TABLE qr_kodlar ENABLE ROW LEVEL SECURITY;
ALTER TABLE kategoriler ENABLE ROW LEVEL SECURITY;
ALTER TABLE form_gonderimleri ENABLE ROW LEVEL SECURITY;

-- Public read for form (anon key)
CREATE POLICY "Public QR token read" ON qr_kodlar FOR SELECT USING (true);
CREATE POLICY "Public event read" ON events FOR SELECT USING (aktif = true);
CREATE POLICY "Public kurum read" ON kurumlar FOR SELECT USING (aktif = true);
CREATE POLICY "Public kategori read" ON kategoriler FOR SELECT USING (true);
CREATE POLICY "Public form insert" ON form_gonderimleri FOR INSERT WITH CHECK (true);

-- Service role full access (API routes kullanır)
CREATE POLICY "Service full kurumlar" ON kurumlar USING (true) WITH CHECK (true);
CREATE POLICY "Service full events" ON events USING (true) WITH CHECK (true);
CREATE POLICY "Service full qr" ON qr_kodlar USING (true) WITH CHECK (true);
CREATE POLICY "Service full gonderimleri" ON form_gonderimleri USING (true) WITH CHECK (true);

-- Index'ler
CREATE INDEX IF NOT EXISTS idx_events_kurum ON events(kurum_id);
CREATE INDEX IF NOT EXISTS idx_events_zaman ON events(baslangic, bitis);
CREATE INDEX IF NOT EXISTS idx_qr_token ON qr_kodlar(token);
CREATE INDEX IF NOT EXISTS idx_gonderimleri_kurum ON form_gonderimleri(kurum_id);
CREATE INDEX IF NOT EXISTS idx_gonderimleri_event ON form_gonderimleri(event_id);
CREATE INDEX IF NOT EXISTS idx_gonderimleri_wa ON form_gonderimleri(whatsapp_id);
