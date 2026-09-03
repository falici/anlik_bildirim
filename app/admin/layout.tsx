import AdminSidebar from './AdminSidebar'

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-col md:flex-row" style={{ display: 'flex', minHeight: '100vh', background: '#f6f5ff', fontFamily: 'system-ui,-apple-system,sans-serif' }}>
      <AdminSidebar />
      <main className="p-4 md:px-10 md:py-9" style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>
        {children}
      </main>
    </div>
  )
}
