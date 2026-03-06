import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import MapboxDraw from '@mapbox/mapbox-gl-draw'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN

const STATUS_COLORS = {
  not_started:     '#ef4444',
  in_progress:     '#eab308',
  needs_attention: '#f97316',
  complete:        '#22c55e',
}

export default function MapView({ project, isAdmin, onItemSelect, layers }) {
  const { user } = useAuth()
  const mapContainer = useRef(null)
  const map = useRef(null)
  const draw = useRef(null)
  const realtimeChannel = useRef(null)
  const [mapReady, setMapReady] = useState(false)
  const [saveModal, setSaveModal] = useState(null)
  const [saveForm, setSaveForm] = useState({})
  const [handholeTypes, setHandholeTypes] = useState([])
  const [pedestalTypes, setPedestalTypes] = useState([])
  const [pipeSizes, setPipeSizes] = useState([])
  const [saving, setSaving] = useState(false)

  // Load type lists for modals
  useEffect(() => {
    supabase.from('handhole_types').select('*').order('name').then(({ data }) => setHandholeTypes(data || []))
    supabase.from('pedestal_types').select('*').order('name').then(({ data }) => setPedestalTypes(data || []))
    supabase.from('bore_pipe_sizes').select('*').order('name').then(({ data }) => setPipeSizes(data || []))
  }, [])

  // Init map
  useEffect(() => {
    if (map.current) return

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      center: [project.center_lng || -96.7970, project.center_lat || 32.7767],
      zoom: project.zoom || 17,
    })

    map.current.addControl(new mapboxgl.NavigationControl({ showCompass: true }), 'top-right')
    map.current.addControl(new mapboxgl.ScaleControl(), 'bottom-left')

    if (isAdmin) {
      draw.current = new MapboxDraw({
        displayControlsDefault: false,
        controls: { line_string: true, point: true, trash: true },
      })
      map.current.addControl(draw.current, 'top-left')
    }

    map.current.on('load', () => {
      initSources()
      loadAllItems()
      setMapReady(true)
    })

    // Draw event - new feature created by admin
    if (isAdmin) {
      map.current.on('draw.create', ({ features }) => {
        const f = features[0]
        if (f.geometry.type === 'Point') {
          setSaveModal({ featureType: 'point', feature: f })
          setSaveForm({ kind: 'handhole', type_id: '', label: '' })
        } else if (f.geometry.type === 'LineString') {
          setSaveModal({ featureType: 'line', feature: f })
          setSaveForm({ pipe_size_id: '', num_pipes: 1, label: '' })
        }
      })
    }

    // Click handlers for existing items
    map.current.on('click', 'layer-handholes', e => {
      e.preventDefault()
      const props = e.features[0].properties
      onItemSelect('handhole', {
        id: props.id, label: props.label, status: props.status,
        type_id: props.type_id, num_pipes: null
      })
    })
    map.current.on('click', 'layer-pedestals', e => {
      e.preventDefault()
      const props = e.features[0].properties
      onItemSelect('pedestal', {
        id: props.id, label: props.label, status: props.status,
        type_id: props.type_id
      })
    })
    map.current.on('click', 'layer-bore-paths', e => {
      e.preventDefault()
      const props = e.features[0].properties
      onItemSelect('bore_path', {
        id: props.id, label: props.label, status: props.status,
        pipe_size_id: props.pipe_size_id, num_pipes: props.num_pipes
      })
    })

    // Cursor changes
    const layers = ['layer-handholes', 'layer-pedestals', 'layer-bore-paths', 'layer-bore-paths-hit']
    layers.forEach(l => {
      map.current.on('mouseenter', l, () => { map.current.getCanvas().style.cursor = 'pointer' })
      map.current.on('mouseleave', l, () => { map.current.getCanvas().style.cursor = '' })
    })

    return () => {
      if (realtimeChannel.current) supabase.removeChannel(realtimeChannel.current)
      map.current?.remove()
      map.current = null
    }
  }, [])

  function initSources() {
    const empty = { type: 'FeatureCollection', features: [] }

    // Handholes source + layer
    map.current.addSource('src-handholes', { type: 'geojson', data: empty })
    map.current.addLayer({
      id: 'layer-handholes',
      type: 'circle',
      source: 'src-handholes',
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 6, 18, 12],
        'circle-color': [
          'match', ['get', 'status'],
          'not_started', STATUS_COLORS.not_started,
          'in_progress', STATUS_COLORS.in_progress,
          'needs_attention', STATUS_COLORS.needs_attention,
          'complete', STATUS_COLORS.complete,
          STATUS_COLORS.not_started
        ],
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 2,
        'circle-opacity': 0.9,
      }
    })
    // Handhole label
    map.current.addLayer({
      id: 'layer-handholes-label',
      type: 'symbol',
      source: 'src-handholes',
      minzoom: 16,
      layout: {
        'text-field': ['get', 'label'],
        'text-size': 11,
        'text-offset': [0, 1.5],
        'text-anchor': 'top',
      },
      paint: {
        'text-color': '#ffffff',
        'text-halo-color': '#000000',
        'text-halo-width': 1,
      }
    })

    // Pedestals source + layer (diamond shape via rotation)
    map.current.addSource('src-pedestals', { type: 'geojson', data: empty })
    map.current.addLayer({
      id: 'layer-pedestals',
      type: 'circle',
      source: 'src-pedestals',
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 6, 18, 12],
        'circle-color': [
          'match', ['get', 'status'],
          'not_started', STATUS_COLORS.not_started,
          'in_progress', STATUS_COLORS.in_progress,
          'needs_attention', STATUS_COLORS.needs_attention,
          'complete', STATUS_COLORS.complete,
          STATUS_COLORS.not_started
        ],
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 2,
        'circle-stroke-opacity': 0.6,
        'circle-blur': 0.15,
      }
    })

    // Bore paths source + layers
    map.current.addSource('src-bore-paths', { type: 'geojson', data: empty })
    // Casing (white outline)
    map.current.addLayer({
      id: 'layer-bore-paths-casing',
      type: 'line',
      source: 'src-bore-paths',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-width': ['interpolate', ['linear'], ['zoom'], 13, 4, 18, 8],
        'line-color': '#ffffff',
        'line-opacity': 0.3,
      }
    })
    // Main line
    map.current.addLayer({
      id: 'layer-bore-paths',
      type: 'line',
      source: 'src-bore-paths',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-width': ['interpolate', ['linear'], ['zoom'], 13, 3, 18, 6],
        'line-color': [
          'match', ['get', 'status'],
          'not_started', STATUS_COLORS.not_started,
          'in_progress', STATUS_COLORS.in_progress,
          'needs_attention', STATUS_COLORS.needs_attention,
          'complete', STATUS_COLORS.complete,
          STATUS_COLORS.not_started
        ],
        'line-opacity': 0.9,
      }
    })
    // Wide invisible hit target for bore paths
    map.current.addLayer({
      id: 'layer-bore-paths-hit',
      type: 'line',
      source: 'src-bore-paths',
      paint: { 'line-width': 20, 'line-opacity': 0 }
    })

    // Subscribe to realtime
    realtimeChannel.current = supabase
      .channel(`map-realtime-${project.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'handholes', filter: `project_id=eq.${project.id}` }, loadAllItems)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedestals', filter: `project_id=eq.${project.id}` }, loadAllItems)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bore_paths', filter: `project_id=eq.${project.id}` }, loadAllItems)
      .subscribe()
  }

  async function loadAllItems() {
    if (!map.current || !map.current.getSource('src-handholes')) return

    const [{ data: hh }, { data: ped }, { data: bp }] = await Promise.all([
      supabase.from('handholes').select('*').eq('project_id', project.id),
      supabase.from('pedestals').select('*').eq('project_id', project.id),
      supabase.from('bore_paths').select('*').eq('project_id', project.id),
    ])

    const hhFeatures = (hh || []).map(h => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [h.lng, h.lat] },
      properties: { ...h }
    }))
    const pedFeatures = (ped || []).map(p => ({
      type: 'Feature',
      geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
      properties: { ...p }
    }))
    const bpFeatures = (bp || []).map(b => ({
      type: 'Feature',
      geometry: { type: 'LineString', coordinates: b.coordinates },
      properties: { ...b, coordinates: JSON.stringify(b.coordinates) }
    }))

    if (map.current.getSource('src-handholes')) map.current.getSource('src-handholes').setData({ type: 'FeatureCollection', features: hhFeatures })
    if (map.current.getSource('src-pedestals')) map.current.getSource('src-pedestals').setData({ type: 'FeatureCollection', features: pedFeatures })
    if (map.current.getSource('src-bore-paths')) map.current.getSource('src-bore-paths').setData({ type: 'FeatureCollection', features: bpFeatures })
  }

  // Layer visibility
  useEffect(() => {
    if (!mapReady) return
    const vis = v => v ? 'visible' : 'none'
    const setVis = (ids, value) => ids.forEach(id => {
      if (map.current.getLayer(id)) map.current.setLayoutProperty(id, 'visibility', value)
    })
    setVis(['layer-handholes', 'layer-handholes-label'], vis(layers.handholes))
    setVis(['layer-pedestals'], vis(layers.pedestals))
    setVis(['layer-bore-paths', 'layer-bore-paths-casing', 'layer-bore-paths-hit'], vis(layers.borePaths))
  }, [layers, mapReady])

  async function handleSave() {
    setSaving(true)
    const { feature, featureType } = saveModal
    try {
      if (featureType === 'point') {
        const [lng, lat] = feature.geometry.coordinates
        const table = saveForm.kind === 'handhole' ? 'handholes' : 'pedestals'
        await supabase.from(table).insert({
          project_id: project.id,
          lat, lng,
          label: saveForm.label || null,
          type_id: saveForm.type_id || null,
          created_by: user.id
        })
      } else {
        await supabase.from('bore_paths').insert({
          project_id: project.id,
          coordinates: feature.geometry.coordinates,
          label: saveForm.label || null,
          pipe_size_id: saveForm.pipe_size_id || null,
          num_pipes: parseInt(saveForm.num_pipes) || 1,
          created_by: user.id
        })
      }
      draw.current?.deleteAll()
      setSaveModal(null)
    } catch (err) {
      console.error('Save error:', err)
    }
    setSaving(false)
  }

  const activeTypes = saveModal?.featureType === 'point'
    ? (saveForm.kind === 'handhole' ? handholeTypes : pedestalTypes)
    : []

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainer} className="w-full h-full" />

      {/* Save item modal */}
      {saveModal && (
        <div className="absolute inset-0 bg-black/60 flex items-end sm:items-center justify-center z-40 p-4">
          <div className="bg-gray-800 border border-gray-700 rounded-2xl p-5 w-full max-w-sm shadow-2xl space-y-4">
            <h3 className="text-white font-semibold">
              {saveModal.featureType === 'point' ? '📍 Place Item' : '〰️ Save Bore Path'}
            </h3>

            {saveModal.featureType === 'point' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wide">Item Type</label>
                  <div className="flex gap-2">
                    {['handhole', 'pedestal'].map(k => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setSaveForm(p => ({ ...p, kind: k, type_id: '' }))}
                        className={`flex-1 py-2 rounded-xl text-sm font-medium transition-colors border ${
                          saveForm.kind === k
                            ? 'bg-orange-500/20 border-orange-500/50 text-orange-400'
                            : 'bg-gray-700 border-gray-600 text-gray-300 hover:border-gray-500'
                        }`}
                      >
                        {k === 'handhole' ? '🔳 Handhole' : '📦 Pedestal'}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wide">
                    {saveForm.kind === 'handhole' ? 'Handhole' : 'Pedestal'} Type
                  </label>
                  <select
                    value={saveForm.type_id}
                    onChange={e => setSaveForm(p => ({ ...p, type_id: e.target.value }))}
                    className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="">-- Select Type --</option>
                    {activeTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                  {activeTypes.length === 0 && (
                    <p className="text-xs text-yellow-500 mt-1">⚠️ No types configured. Add them in Admin Settings.</p>
                  )}
                </div>
              </>
            )}

            {saveModal.featureType === 'line' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wide">Pipe Size</label>
                  <select
                    value={saveForm.pipe_size_id}
                    onChange={e => setSaveForm(p => ({ ...p, pipe_size_id: e.target.value }))}
                    className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="">-- Select Pipe Size --</option>
                    {pipeSizes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  {pipeSizes.length === 0 && (
                    <p className="text-xs text-yellow-500 mt-1">⚠️ No pipe sizes configured. Add them in Admin Settings.</p>
                  )}
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wide">Number of Conduits</label>
                  <input
                    type="number"
                    min="1"
                    max="24"
                    value={saveForm.num_pipes}
                    onChange={e => setSaveForm(p => ({ ...p, num_pipes: e.target.value }))}
                    className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wide">Label (optional)</label>
              <input
                value={saveForm.label}
                onChange={e => setSaveForm(p => ({ ...p, label: e.target.value }))}
                placeholder={saveModal.featureType === 'point' ? 'e.g. HH-01' : 'e.g. BORE-01'}
                className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div className="flex gap-3 pt-1">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-medium py-2.5 rounded-xl transition-colors"
              >
                {saving ? 'Saving...' : 'Save to Map'}
              </button>
              <button
                onClick={() => { draw.current?.deleteAll(); setSaveModal(null) }}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2.5 rounded-xl transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
