-- WhatsApp konuşma hafızası
CREATE TABLE IF NOT EXISTS wa_conversations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  wa_id TEXT NOT NULL,
  kurum_id UUID REFERENCES kurumlar(id),
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_wa_conv_wa_id ON wa_conversations(wa_id, created_at DESC);

-- Kurum AI ayarları (kurumlar tablosuna kolon ekle)
ALTER TABLE kurumlar ADD COLUMN IF NOT EXISTS ai_system_prompt TEXT;
ALTER TABLE kurumlar ADD COLUMN IF NOT EXISTS boss_wa_numbers TEXT[]; -- birden fazla boss olabilir
ALTER TABLE kurumlar ADD COLUMN IF NOT EXISTS wa_phone_number_id TEXT;
ALTER TABLE kurumlar ADD COLUMN IF NOT EXISTS wa_access_token TEXT;
ALTER TABLE kurumlar ADD COLUMN IF NOT EXISTS wa_verify_token TEXT;

-- RLS
ALTER TABLE wa_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service full wa_conv" ON wa_conversations USING (true) WITH CHECK (true);
