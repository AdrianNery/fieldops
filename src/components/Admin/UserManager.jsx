import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

export default function UserManager() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState([])
  const [saving, setSaving] = useState(null)

  async function load() {
    const { data } = await supabase.from('profiles').select('*').order('created_at')
    setUsers(data || [])
  }

  useEffect(() => { load() }, [])

  async function updateRole(id, role) {
    setSaving(id)
    await supabase.from('profiles').update({ role }).eq('id', id)
    await load()
    setSaving(null)
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-white mb-2">Users</h2>
      <p className="text-gray-400 text-sm mb-5">Manage user roles. Admins can draw on maps, manage settings, and change item statuses.</p>

      <div className="space-y-2">
        {users.length === 0 && <p className="text-gray-500 text-sm italic">No users found.</p>}
        {users.map(u => (
          <div key={u.id} className="flex items-center justify-between bg-gray-700 rounded-xl px-4 py-3 gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="text-white font-medium truncate">{u.full_name || 'Unnamed User'}</p>
                {u.id === currentUser?.id && (
                  <span className="text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30 px-1.5 py-0.5 rounded-full">You</span>
                )}
              </div>
              <p className="text-gray-400 text-sm truncate">{u.email}</p>
            </div>
            <div className="shrink-0">
              {saving === u.id ? (
                <span className="text-xs text-gray-500 animate-pulse">Saving...</span>
              ) : (
                <select
                  value={u.role}
                  onChange={e => updateRole(u.id, e.target.value)}
                  className="bg-gray-600 border border-gray-500 text-white text-sm rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="crew">Crew</option>
                  <option value="admin">Admin</option>
                </select>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
