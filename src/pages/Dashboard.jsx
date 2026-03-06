import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import AppShell from '../components/Layout/AppShell'

export default function Dashboard() {
  const { user, profile } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [form, setForm] = useState({ name: '', description: '', center_lat: '', center_lng: '' })
  const [creating, setCreating] = useState(false)

  async function load() {
    setLoading(true)
    if (isAdmin) {
      const { data } = await supabase.from('projects').select('*').order('created_at', { ascending: false })
      setProjects(data || [])
    } else {
      const { data: memberships } = await supabase
        .from('project_members')
        .select('project_id')
        .eq('user_id', user.id)
      const ids = memberships?.map(m => m.project_id) || []
      if (!ids.length) { setProjects([]); setLoading(false); return }
      const { data } = await supabase.from('projects').select('*').in('id', ids).order('created_at', { ascending: false })
      setProjects(data || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    if (profile) load()
  }, [profile])

  async function createProject() {
    if (!form.name.trim()) return
    setCreating(true)
    const { data } = await supabase.from('projects').insert({
      name: form.name.trim(),
      description: form.description.trim() || null,
      center_lat: parseFloat(form.center_lat) || 32.7767,
      center_lng: parseFloat(form.center_lng) || -96.7970,
      created_by: user.id
    }).select().single()
    setShowCreate(false)
    setForm({ name: '', description: '', center_lat: '', center_lng: '' })
    await load()
    setCreating(false)
  }

  return (
    <AppShell>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Projects</h1>
            <p className="text-gray-400 text-sm mt-0.5">
              {isAdmin ? 'All job sites' : 'Your assigned job sites'}
            </p>
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowCreate(true)}
              className="bg-orange-500 hover:bg-orange-600 text-white font-medium px-4 py-2.5 rounded-xl transition-colors flex items-center gap-2"
            >
              <span>+</span> New Project
            </button>
          )}
        </div>

        {/* Create modal */}
        {showCreate && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4" onClick={() => setShowCreate(false)}>
            <div className="bg-gray-800 border border-gray-700 rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
              <h2 className="text-lg font-semibold text-white mb-5">New Project</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Project Name *</label>
                  <input
                    value={form.name}
                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="e.g. Oak Street Fiber Run"
                    className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1">Description</label>
                  <input
                    value={form.description}
                    onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                    placeholder="Optional job description"
                    className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-sm text-gray-300 mb-1">Center Latitude</label>
                    <input
                      value={form.center_lat}
                      onChange={e => setForm(p => ({ ...p, center_lat: e.target.value }))}
                      placeholder="32.7767"
                      className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-300 mb-1">Center Longitude</label>
                    <input
                      value={form.center_lng}
                      onChange={e => setForm(p => ({ ...p, center_lng: e.target.value }))}
                      placeholder="-96.7970"
                      className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>
                </div>
                <p className="text-xs text-gray-500">You can always recenter the map from the project view.</p>
              </div>
              <div className="flex gap-3 mt-5">
                <button
                  onClick={createProject}
                  disabled={creating || !form.name.trim()}
                  className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white font-medium py-2.5 rounded-xl transition-colors"
                >
                  {creating ? 'Creating...' : 'Create Project'}
                </button>
                <button
                  onClick={() => setShowCreate(false)}
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2.5 rounded-xl transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-500">
            <span className="animate-pulse">Loading projects...</span>
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-24">
            <p className="text-5xl mb-4">🏗️</p>
            <p className="text-xl text-white font-medium">No projects yet</p>
            <p className="text-gray-500 text-sm mt-2">
              {isAdmin ? 'Create your first project to get started.' : 'You have not been assigned to any projects yet.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {projects.map(p => (
              <Link
                key={p.id}
                to={`/projects/${p.id}`}
                className="group bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-orange-500/40 rounded-2xl p-5 transition-all block"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 bg-orange-500/10 border border-orange-500/20 rounded-xl flex items-center justify-center text-xl">
                    🗺️
                  </div>
                  <span className="text-xs text-gray-600 group-hover:text-gray-500 transition-colors">
                    {new Date(p.created_at).toLocaleDateString()}
                  </span>
                </div>
                <h2 className="text-white font-semibold text-base mb-1 group-hover:text-orange-400 transition-colors">
                  {p.name}
                </h2>
                {p.description && (
                  <p className="text-gray-400 text-sm line-clamp-2">{p.description}</p>
                )}
                <div className="flex items-center gap-1 mt-3 text-orange-400 text-sm opacity-0 group-hover:opacity-100 transition-opacity">
                  <span>Open project</span>
                  <span>→</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  )
}
