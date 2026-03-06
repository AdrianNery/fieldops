import Sidebar from './Sidebar'

export default function AppShell({ children }) {
  return (
    <div className="flex h-full bg-gray-900 overflow-hidden">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
