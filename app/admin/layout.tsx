import AdminSidebar from './AdminSidebar'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#f6f5ff', fontFamily: 'system-ui,-apple-system,sans-serif' }}>
      <AdminSidebar />
      <main style={{ flex: 1, minWidth: 0, padding: '36px 40px', overflowY: 'auto' }}>
        {children}
      </main>
    </div>
  )
}
