-- =============================================
-- Operasyon (Bakım/Onarım) Modülü - Supabase Schema
-- Bu dosyayı Supabase SQL Editor'de elle çalıştırın.
-- =============================================

-- Operasyon personeli tablosu
CREATE TABLE IF NOT EXISTS operasyon_personel (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  kurum_id UUID REFERENCES kurumlar(id) ON DELETE CASCADE,
  ad TEXT NOT NULL,
  telefon TEXT NOT NULL,
  rol TEXT,
  aktif BOOLEAN DEFAULT true,
  olusturulma TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_op_personel_kurum ON operasyon_personel(kurum_id);
CREATE INDEX IF NOT EXISTS idx_op_personel_tel ON operasyon_personel(telefon);

ALTER TABLE operasyon_personel ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service full op_personel" ON operasyon_personel USING (true) WITH CHECK (true);

-- form_gonderimleri genişletme — operasyon talepleri için
ALTER TABLE form_gonderimleri ADD COLUMN IF NOT EXISTS tip TEXT DEFAULT 'misafir' CHECK (tip IN ('misafir', 'operasyon'));
ALTER TABLE form_gonderimleri ADD COLUMN IF NOT EXISTS medya_url TEXT;
ALTER TABLE form_gonderimleri ADD COLUMN IF NOT EXISTS medya_tip TEXT;

CREATE INDEX IF NOT EXISTS idx_gonderimleri_tip ON form_gonderimleri(tip);

-- Operasyon fotoğrafları için public storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('operasyon-medya', 'operasyon-medya', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policy: service role tam erişim, herkes okuyabilir (public bucket zaten okumaya izin verir)
-- Not: Bu policy zaten varsa (ikinci çalıştırmada) hata alırsanız bu bloğu atlayabilirsiniz.
CREATE POLICY "Service full operasyon-medya"
  ON storage.objects FOR ALL
  USING (bucket_id = 'operasyon-medya')
  WITH CHECK (bucket_id = 'operasyon-medya');
