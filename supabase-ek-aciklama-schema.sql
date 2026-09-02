-- =============================================
-- Ek Açıklama Alanı - Supabase Schema
-- Bu dosyayı Supabase SQL Editor'de elle çalıştırın.
-- =============================================

-- update_request_info ile eklenen sonradan gelen detaylar buraya birikir.
-- diger_not (ilk talep bilgisi: masa no, ad soyad) artık bu tool tarafından
-- ÜZERİNE YAZILMAZ, sadece eksikse eklenir.
ALTER TABLE form_gonderimleri ADD COLUMN IF NOT EXISTS ek_aciklama TEXT;
