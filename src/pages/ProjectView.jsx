import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import MapView from '../components/Map/MapView'
import ItemDetailPanel from '../components/Items/ItemDetailPanel'

export default function ProjectView() {
  const { projectId } = useParams()
  const { profile } = useAuth()
  const isAdmin = profile?.role === 'admin'

  const [project, setProject] = useState(null)
  const [selectedItem, setSelectedItem] = useState(null)
  const [layers, setLayers] = useState({ handholes: true, pedestals: true, borePaths: true })
  const [drawMode, setDrawMode] = useState(false)

  useEffect(() => {
    supabase.from('projects').select('*').eq('id', projectId).single().then(({ data }) => setProject(data))
  }, [projectId])

  function toggleLayer(key) {
    setLayers(prev => ({ ...prev, [key]: !prev[key] }))
  }

  function handleItemSelect(type, item) {
    setSelectedItem({ type, item })
  }

  function handleStatusChange(newStatus) {
    setSelectedItem(prev => prev ? { ...prev, item: { ...prev.item, status: newStatus } } : prev)
  }

  if (!project) return (
    <div className="flex items-center justify-center h-full bg-gray-900">
      <p className="text-gray-400 animate-pulse">Loading project...</p>
    </div>
  )

  return (
    <div className="flex flex-col h-full bg-gray-900">
      {/* Top bar */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-800 border-b border-gray-700 shrink-0 flex-wrap">
        <Link to="/" className="text-gray-400 hover:text-white text-sm transition-colors flex items-center gap-1 mr-1">
          ← <span className="hidden sm:inline">Projects</span>
        </Link>

        <h1 className="text-white font-semibold text-sm flex-1 truncate">{project.name}</h1>

        {/* Layer toggles */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {[
            { key: 'handholes', label: '🔳', full: 'Handholes' },
            { key: 'pedestals', label: '📦', full: 'Pedestals' },
            { key: 'borePaths', label: '〰️', full: 'Bore Paths' },
          ].map(({ key, label, full }) => (
            <button
              key={key}
              onClick={() => toggleLayer(key)}
              title={layers[key] ? `Hide ${full}` : `Show ${full}`}
              className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
                layers[key]
                  ? 'bg-orange-500/20 border-orange-500/40 text-orange-400'
                  : 'border-gray-600 text-gray-500 hover:border-gray-500 hover:text-gray-400'
              }`}
            >
              <span>{label}</span>
              <span className="hidden sm:inline ml-1">{full}</span>
            </button>
          ))}

          {isAdmin && (
            <button
              onClick={() => setDrawMode(p => !p)}
              className={`text-xs px-2.5 py-1.5 rounded-lg border transition-colors ml-1 ${
                drawMode
                  ? 'bg-blue-500/20 border-blue-500/40 text-blue-400'
                  : 'border-gray-600 text-gray-400 hover:border-gray-500'
              }`}
            >
              ✏️ <span className="hidden sm:inline">{drawMode ? 'Drawing On' : 'Draw Mode'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Map + panel */}
      <div className="flex flex-1 overflow-hidden">
        {/* Map */}
        <div className="flex-1 relative min-w-0">
          <MapView
            project={project}
            isAdmin={isAdmin && drawMode}
            layers={layers}
            onItemSelect={handleItemSelect}
          />

          {/* Map legend */}
          <div className="absolute bottom-8 right-3 bg-gray-900/80 backdrop-blur rounded-xl p-3 text-xs space-y-1.5 border border-gray-700/50">
            {[
              { color: 'bg-red-500', label: 'Not Started' },
              { color: 'bg-yellow-500', label: 'In Progress' },
              { color: 'bg-orange-500', label: 'Needs Attention' },
              { color: 'bg-green-500', label: 'Complete' },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-2">
                <div className={`w-2.5 h-2.5 rounded-full ${s.color} shrink-0`} />
                <span className="text-gray-300">{s.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Item detail panel */}
        {selectedItem && (
          <div className="w-full sm:w-96 shrink-0 border-l border-gray-700 overflow-hidden flex flex-col">
            <ItemDetailPanel
              itemType={selectedItem.type}
              item={selectedItem.item}
              onClose={() => setSelectedItem(null)}
              onStatusChange={handleStatusChange}
            />
          </div>
        )}
      </div>
    </div>
  )
}
