import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function Sidebar() {
  const { profile, signOut } = useAuth()
  const { pathname } = useLocation()

  const navLink = (to, icon, label) => (
    <Link
      to={to}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-colors ${
        pathname === to
          ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30'
          : 'text-gray-300 hover:bg-gray-700 hover:text-white'
      }`}
    >
      <span className="text-lg">{icon}</span>
      {label}
    </Link>
  )

  return (
    <aside className="w-60 bg-gray-800 border-r border-gray-700 flex flex-col shrink-0">
      <div className="p-5 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🏗️</span>
          <span className="text-xl font-bold text-orange-500">FieldOps</span>
        </div>
        <p className="text-xs text-gray-500 mt-1">Field Operations Platform</p>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {navLink('/', '🗂', 'Projects')}
        {profile?.role === 'admin' && navLink('/admin', '⚙️', 'Admin Settings')}
      </nav>

      <div className="p-3 border-t border-gray-700">
        <div className="px-3 py-2 mb-1">
          <p className="text-xs font-medium text-white truncate">{profile?.full_name || 'User'}</p>
          <p className="text-xs text-gray-500 truncate">{profile?.email}</p>
          <span className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full ${
            profile?.role === 'admin' ? 'bg-orange-500/20 text-orange-400' : 'bg-gray-700 text-gray-400'
          }`}>
            {profile?.role === 'admin' ? 'Admin' : 'Crew'}
          </span>
        </div>
        <button
          onClick={signOut}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-700 rounded-xl transition-colors"
        >
          <span>🚪</span> Sign Out
        </button>
      </div>
    </aside>
  )
}
