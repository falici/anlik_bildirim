'use client'
import { useState, useEffect } from 'react'

export default function AIAyarlariPage() {
  const [kurumlar, setKurumlar] = useState<any[]>([])
  const [secilenKurum, setSecilenKurum] = useState('')
  const [settings, setSettings] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [form, setForm] = useState({
    ai_system_prompt: '',
    ai_boss_prompt: '',
    boss_wa_numbers: '',
    wa_phone_number_id: '',
    wa_access_token: '',
    wa_verify_token: '',
  })

  useEffect(() => {
    fetch('/api/admin/kurumlar').then(r => r.json()).then(setKurumlar)
  }, [])

  useEffect(() => {
    if (!secilenKurum) return
    setLoading(true)
    fetch(`/api/admin/ai-settings?kurum_id=${secilenKurum}`)
      .then(r => r.json())
      .then(d => {
        setSettings(d)
        setForm({
          ai_system_prompt: d.ai_system_prompt || '',
          ai_boss_prompt: d.ai_boss_prompt || '',
          boss_wa_numbers: (d.boss_wa_numbers || []).join('\n'),
          wa_phone_number_id: d.wa_phone_number_id || '',
          wa_access_token: d.wa_access_token || '',
          wa_verify_token: d.wa_verify_token || '',
        })
        setLoading(false)
      })
  }, [secilenKurum])

  const save = async () => {
    setSaving(true); setSaved(false)
    await fetch('/api/admin/ai-settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kurum_id: secilenKurum, ...form })
    })
    setSaving(false); setSaved(true)
    setTimeout(() => setSaved(false), 3000)
  }

  const webhookUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/webhook/whatsapp`
    : '/api/webhook/whatsapp'

  const inputStyle = {
    width: '100%', border: '1.5px solid #e5e7eb', borderRadius: 10,
    padding: '10px 14px', fontSize: 13, color: '#111', outline: 'none',
    boxSizing: 'border-box' as const, fontFamily: 'inherit', background: '#fff'
  }
  const labelStyle = {
    display: 'block', fontSize: 11, fontWeight: 600 as const, color: '#6b7280',
    letterSpacing: '0.05em', textTransform: 'uppercase' as const, marginBottom: 8
  }
  const sectionStyle = {
    background: '#fff', border: '1px solid #ede9f8', borderRadius: 16, padding: 24, marginBottom: 16
  }

  return (
    <div style={{ maxWidth: 780 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0f0a1e', marginBottom: 4 }}>🤖 AI & WhatsApp Ayarları</h1>
        <p style={{ fontSize: 13, color: '#9ca3af' }}>Her kurum için ayrı AI prompt ve WhatsApp bağlantısı tanımlayın.</p>
      </div>

      {/* Kurum seç */}
      <div style={sectionStyle}>
        <label style={labelStyle}>Kurum Seç</label>
        <select value={secilenKurum} onChange={e => setSecilenKurum(e.target.value)}
          style={{ ...inputStyle, cursor: 'pointer' }}>
          <option value="">Kurum seçin...</option>
          {kurumlar.map(k => <option key={k.id} value={k.id}>{k.ad}</option>)}
        </select>
      </div>

      {secilenKurum && !loading && (
        <>
          {/* Webhook URL */}
          <div style={sectionStyle}>
            <label style={labelStyle}>📡 Webhook URL (Meta'ya ekle)</label>
            <div style={{ background: '#f0eeff', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
              <code style={{ fontSize: 12, color: '#6d28d9', wordBreak: 'break-all' }}>{webhookUrl}</code>
              <button onClick={() => navigator.clipboard.writeText(webhookUrl)}
                style={{ background: '#7c3aed', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 11, fontWeight: 700, color: '#fff', cursor: 'pointer', flexShrink: 0 }}>
                Kopyala
              </button>
            </div>
            <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 8 }}>Bu URL'yi Meta Business → WhatsApp → Webhook Configuration'a ekle.</p>
          </div>

          {/* WhatsApp API */}
          <div style={sectionStyle}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0f0a1e', marginBottom: 16 }}>📱 WhatsApp API Bilgileri</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={labelStyle}>Phone Number ID</label>
                <input style={inputStyle} value={form.wa_phone_number_id}
                  onChange={e => setForm({ ...form, wa_phone_number_id: e.target.value })}
                  placeholder="Meta Business'tan alınan Phone Number ID" />
              </div>
              <div>
                <label style={labelStyle}>Access Token</label>
                <input type="password" style={inputStyle} value={form.wa_access_token}
                  onChange={e => setForm({ ...form, wa_access_token: e.target.value })}
                  placeholder="Permanent access token" />
              </div>
              <div>
                <label style={labelStyle}>Verify Token</label>
                <input style={inputStyle} value={form.wa_verify_token}
                  onChange={e => setForm({ ...form, wa_verify_token: e.target.value })}
                  placeholder="Webhook verify token (kendin belirle)" />
              </div>
              <div>
                <label style={labelStyle}>Boss Numaraları (her satıra bir numara)</label>
                <textarea style={{ ...inputStyle, resize: 'none' }} rows={3}
                  value={form.boss_wa_numbers}
                  onChange={e => setForm({ ...form, boss_wa_numbers: e.target.value })}
                  placeholder={'905321234567\n905987654321'} />
                <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>Bu numaralardan gelen mesajlar Yönetici Asistanına yönlendirilir.</p>
              </div>
            </div>
          </div>

          {/* Misafir AI Promptu */}
          <div style={sectionStyle}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0f0a1e', marginBottom: 4 }}>🎊 Misafir Asistanı Sistem Promptu</h3>
            <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 14 }}>Misafirlerle konuşacak AI'ın kuralları ve kişiliği.</p>
            <textarea
              style={{ ...inputStyle, resize: 'vertical', minHeight: 280, lineHeight: 1.6 }}
              value={form.ai_system_prompt}
              onChange={e => setForm({ ...form, ai_system_prompt: e.target.value })}
              placeholder="Sen [Kurum Adı] için görev yapan dijital misafir ilişkileri asistanısın..."
            />
          </div>

          {/* Boss AI Promptu */}
          <div style={sectionStyle}>
            <h3 style={{ fontSize: 14, fontWeight: 700, color: '#0f0a1e', marginBottom: 4 }}>👔 Yönetici Asistanı Sistem Promptu</h3>
            <p style={{ fontSize: 12, color: '#9ca3af', marginBottom: 14 }}>Boss numaralarından gelen mesajlar için AI kuralları.</p>
            <textarea
              style={{ ...inputStyle, resize: 'vertical', minHeight: 200, lineHeight: 1.6 }}
              value={form.ai_boss_prompt}
              onChange={e => setForm({ ...form, ai_boss_prompt: e.target.value })}
              placeholder="Sen [Kurum Adı] yöneticisine yardımcı olan asistansın..."
            />
          </div>

          {/* Kaydet */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <button onClick={save} disabled={saving}
              style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)', border: 'none', borderRadius: 12, padding: '13px 32px', fontSize: 14, fontWeight: 700, color: '#fff', cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Kaydediliyor...' : 'Kaydet'}
            </button>
            {saved && <span style={{ fontSize: 13, color: '#22c55e', fontWeight: 600 }}>✓ Kaydedildi!</span>}
          </div>
        </>
      )}

      {loading && <p style={{ color: '#9ca3af', textAlign: 'center', padding: 40 }}>Yükleniyor...</p>}
    </div>
  )
}
