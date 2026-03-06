import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import MapboxDraw from '@mapbox/mapbox-gl-draw'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN

const STATUS_COLORS = {
  not_started: '#ef4444',
  in_progress: '#eab308',
  needs_attention: '#f97316',
  complete: '#22c55e',
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
  const [showPropertyLines, setShowPropertyLines] = useState(true)
  
  // Tool modes: 'select', 'handhole', 'pedestal', 'bore'
  const [toolMode, setToolMode] = useState('select')

  // Load type lists
  useEffect(() => {
    supabase.from('handhole_types').select('*').order('name').then(({ data }) => setHandholeTypes(data || []))
    supabase.from('pedestal_types').select('*').order('name').then(({ data }) => setPedestalTypes(data || []))
    supabase.from('bore_pipe_sizes').select('*').order('name').then(({ data }) => setPipeSizes(data || []))
  }, [])

  // Handle tool mode changes from outside (from toolbar)
  useEffect(() => {
    if (!map.current || !mapReady) return
    
    if (toolMode === 'handhole' || toolMode === 'pedestal') {
      map.current.getCanvas().style.cursor = 'crosshair'
    } else {
      map.current.getCanvas().style.cursor = ''
    }
  }, [toolMode, mapReady])

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

    // Add draw control for bore paths
    if (isAdmin) {
      draw.current = new MapboxDraw({
        displayControlsDefault: false,
        controls: { line_string: true, trash: true },
      })
      map.current.addControl(draw.current, 'top-left')
    }

    map.current.on('load', () => {
      // Enable property lines (cadastral data) - built into satellite-streets style
      // Show parcel boundaries at certain zoom levels
      if (map.current.getLayer('cadastral-parcels')) {
        map.current.setLayoutProperty('cadastral-parcels', 'visibility', showPropertyLines ? 'visible' : 'none')
      }
      
      // Add property lines layer manually if not available
      if (!map.current.getLayer('property-lines')) {
        map.current.addLayer({
          id: 'property-lines',
          type: 'line',
          source: 'composite',
          'source-layer': 'cadastral-parcels',
          paint: {
            'line-color': '#FFFF00',
            'line-width': 1.5,
            'line-opacity': 0.7
          },
          layout: {
            'line-join': 'round',
            'line-cap': 'round'
          },
          minzoom: 14,
          maxzoom: 22
        }, 'road-label') // Add below road labels
      }
      
      initSources()
      loadAllItems()
      setMapReady(true)
    })

    // Set up click handler after map loads
    map.current.on('load', () => {
      // Click handler for placing handholes/pedestals
      map.current.on('click', (e) => {
        if (!isAdmin) return
        
        // Check if clicking on existing feature first
        const features = map.current.queryRenderedFeatures(e.point, {
          layers: ['layer-handholes', 'layer-pedestals', 'layer-bore-paths']
        })
        
        if (features.length > 0) return // Clicked on existing item
        
        // Otherwise, place new item if in placement mode
        if (toolMode === 'handhole') {
          const feature = {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [e.lngLat.lng, e.lngLat.lat] }
          }
          setSaveModal({ featureType: 'point', feature, itemType: 'handhole' })
          setSaveForm({ kind: 'handhole', type_id: '', label: '' })
        } else if (toolMode === 'pedestal') {
          const feature = {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: [e.lngLat.lng, e.lngLat.lat] }
          }
          setSaveModal({ featureType: 'point', feature, itemType: 'pedestal' })
          setSaveForm({ kind: 'pedestal', type_id: '', label: '' })
        }
      })
      
      // Draw event for bore paths
      map.current.on('draw.create', ({ features }) => {
        const f = features[0]
        if (f.geometry.type === 'LineString') {
          setSaveModal({ featureType: 'line', feature: f })
          setSaveForm({ pipe_size_id: '', num_pipes: 1, label: '' })
        }
      })
    })

    // Click handlers for existing items (outside load to ensure they're set up)
    map.current.on('click', 'layer-handholes', e => {
      e.preventDefault()
      e.stopPropagation()
      const props = e.features[0].properties
      onItemSelect('handhole', {
        id: props.id, label: props.label, status: props.status,
        type_id: props.type_id, num_pipes: null
      })
    })
    map.current.on('click', 'layer-pedestals', e => {
      e.preventDefault()
      e.stopPropagation()
      const props = e.features[0].properties
      onItemSelect('pedestal', {
        id: props.id, label: props.label, status: props.status,
        type_id: props.type_id
      })
    })
    map.current.on('click', 'layer-bore-paths', e => {
      e.preventDefault()
      e.stopPropagation()
      const props = e.features[0].properties
      onItemSelect('bore_path', {
        id: props.id, label: props.label, status: props.status,
        pipe_size_id: props.pipe_size_id, num_pipes: props.num_pipes
      })
    })

    // Cursor changes for existing items
    const itemLayers = ['layer-handholes', 'layer-pedestals', 'layer-bore-paths']
    itemLayers.forEach(l => {
      map.current.on('mouseenter', l, () => { 
        if (toolMode === 'select') map.current.getCanvas().style.cursor = 'pointer' 
      })
      map.current.on('mouseleave', l, () => { 
        if (toolMode === 'select') map.current.getCanvas().style.cursor = '' 
      })
    })

    return () => {
      if (realtimeChannel.current) supabase.removeChannel(realtimeChannel.current)
      map.current?.remove()
      map.current = null
    }
  }, [])

  // Toggle property lines
  useEffect(() => {
    if (!mapReady || !map.current) return
    if (map.current.getLayer('property-lines')) {
      map.current.setLayoutProperty(
        'property-lines', 
        'visibility', 
        showPropertyLines ? 'visible' : 'none'
      )
    }
  }, [showPropertyLines, mapReady])

  function initSources() {
    const empty = { type: 'FeatureCollection', features: [] }

    // Handholes
    map.current.addSource('src-handholes', { type: 'geojson', data: empty })
    map.current.addLayer({
      id: 'layer-handholes',
      type: 'circle',
      source: 'src-handholes',
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 6, 18, 12],
        'circle-color': ['match', ['get', 'status'], 'not_started', STATUS_COLORS.not_started, 'in_progress', STATUS_COLORS.in_progress, 'needs_attention', STATUS_COLORS.needs_attention, 'complete', STATUS_COLORS.complete, STATUS_COLORS.not_started],
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 2,
      }
    })
    map.current.addLayer({
      id: 'layer-handholes-label',
      type: 'symbol',
      source: 'src-handholes',
      minzoom: 16,
      layout: { 'text-field': ['get', 'label'], 'text-size': 11, 'text-offset': [0, 1.5] },
      paint: { 'text-color': '#ffffff', 'text-halo-color': '#000000', 'text-halo-width': 1 }
    })

    // Pedestals
    map.current.addSource('src-pedestals', { type: 'geojson', data: empty })
    map.current.addLayer({
      id: 'layer-pedestals',
      type: 'circle',
      source: 'src-pedestals',
      paint: {
        'circle-radius': ['interpolate', ['linear'], ['zoom'], 13, 7, 18, 14],
        'circle-color': ['match', ['get', 'status'], 'not_started', STATUS_COLORS.not_started, 'in_progress', STATUS_COLORS.in_progress, 'needs_attention', STATUS_COLORS.needs_attention, 'complete', STATUS_COLORS.complete, STATUS_COLORS.not_started],
        'circle-stroke-color': '#ffffff',
        'circle-stroke-width': 2,
      }
    })
    map.current.addLayer({
      id: 'layer-pedestals-label',
      type: 'symbol',
      source: 'src-pedestals',
      minzoom: 16,
      layout: { 'text-field': ['get', 'label'], 'text-size': 11, 'text-offset': [0, 1.5] },
      paint: { 'text-color': '#ffffff', 'text-halo-color': '#000000', 'text-halo-width': 1 }
    })

    // Bore paths
    map.current.addSource('src-bore-paths', { type: 'geojson', data: empty })
    map.current.addLayer({
      id: 'layer-bore-paths-casing',
      type: 'line',
      source: 'src-bore-paths',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-width': ['interpolate', ['linear'], ['zoom'], 13, 4, 18, 8], 'line-color': '#ffffff', 'line-opacity': 0.3 }
    })
    map.current.addLayer({
      id: 'layer-bore-paths',
      type: 'line',
      source: 'src-bore-paths',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: { 'line-width': ['interpolate', ['linear'], ['zoom'], 13, 2, 18, 5], 'line-color': ['match', ['get', 'status'], 'not_started', STATUS_COLORS.not_started, 'in_progress', STATUS_COLORS.in_progress, 'needs_attention', STATUS_COLORS.needs_attention, 'complete', STATUS_COLORS.complete, STATUS_COLORS.not_started] }
    })

    // Blueprint overlay
    if (project.blueprint_url) {
      map.current.addSource('src-blueprint', { type: 'image', url: project.blueprint_url, coordinates: project.blueprint_bounds || [[-96.7970, 32.7767], [-96.7970, 32.7767], [-96.7970, 32.7767], [-96.7970, 32.7767]] })
      map.current.addLayer({ id: 'layer-blueprint', type: 'raster', source: 'src-blueprint', paint: { 'raster-opacity': project.blueprint_opacity || 0.5 } }, 'layer-bore-paths-casing')
    }
  }

  async function loadAllItems() {
    const { data: hh } = await supabase.from('handholes').select('*').eq('project_id', project.id)
    const { data: pd } = await supabase.from('pedestals').select('*').eq('project_id', project.id)
    const { data: bp } = await supabase.from('bore_paths').select('*').eq('project_id', project.id)

    if (map.current.getSource('src-handholes')) {
      map.current.getSource('src-handholes').setData({ type: 'FeatureCollection', features: (hh || []).map(h => ({ type: 'Feature', properties: { id: h.id, label: h.label, status: h.status, type_id: h.type_id }, geometry: { type: 'Point', coordinates: [h.lng, h.lat] } })) })
    }
    if (map.current.getSource('src-pedestals')) {
      map.current.getSource('src-pedestals').setData({ type: 'FeatureCollection', features: (pd || []).map(p => ({ type: 'Feature', properties: { id: p.id, label: p.label, status: p.status, type_id: p.type_id }, geometry: { type: 'Point', coordinates: [p.lng, p.lat] } })) })
    }
    if (map.current.getSource('src-bore-paths')) {
      map.current.getSource('src-bore-paths').setData({ type: 'FeatureCollection', features: (bp || []).map(b => ({ type: 'Feature', properties: { id: b.id, label: b.label, status: b.status, pipe_size_id: b.pipe_size_id, num_pipes: b.num_pipes }, geometry: b.coordinates })) })
    }
  }

  async function handleSave() {
    setSaving(true)
    const coords = saveModal.feature.geometry.coordinates
    const label = saveForm.label || null

    try {
      if (saveModal.featureType === 'point') {
        const table = saveForm.kind === 'handhole' ? 'handholes' : 'pedestals'
        
        await supabase.from(table).insert({
          project_id: project.id,
          type_id: saveForm.type_id || null,
          lat: coords[1], lng: coords[0],
          label,
          status: 'not_started',
          created_by: user.id
        })
      } else {
        const coordsArray = typeof coords[0] === 'number' ? [coords] : coords
        await supabase.from('bore_paths').insert({
          project_id: project.id,
          coordinates: { type: 'LineString', coordinates: coordsArray },
          pipe_size_id: saveForm.pipe_size_id || null,
          num_pipes: saveForm.num_pipes || 1,
          label,
          status: 'not_started',
          created_by: user.id
        })
      }

      draw.current?.deleteAll()
      setSaveModal(null)
      setSaveForm({})
      setToolMode('select')
      loadAllItems()
    } catch (err) {
      alert('Error saving: ' + err.message)
    }
    setSaving(false)
  }

  const toolBtn = (mode, icon, label) => (
    <button
      onClick={() => setToolMode(mode)}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg font-medium text-sm transition-all ${
        toolMode === mode 
          ? 'bg-orange-500 text-white shadow-lg' 
          : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
      }`}
    >
      <span>{icon}</span>
      <span className="hidden sm:inline">{label}</span>
    </button>
  )

  return (
    <div className="relative w-full h-full">
      {/* Toolbar for admins */}
      {isAdmin && (
        <div className="absolute top-4 left-4 z-10 flex flex-col gap-2 bg-gray-900/95 backdrop-blur p-2 rounded-xl shadow-xl border border-gray-700">
          <div className="flex gap-2">
            {toolBtn('select', '👆', 'Select')}
            {toolBtn('handhole', '⬡', 'Handhole')}
            {toolBtn('pedestal', '◆', 'Pedestal')}
          </div>
          <div className="flex gap-2">
            {toolBtn('bore', '📏', 'Draw Bore')}
          </div>
          <div className="border-t border-gray-600 pt-2 mt-1">
            <label className="flex items-center gap-2 cursor-pointer px-2">
              <input 
                type="checkbox" 
                checked={showPropertyLines} 
                onChange={(e) => setShowPropertyLines(e.target.checked)}
                className="w-4 h-4 accent-orange-500"
              />
              <span className="text-xs text-gray-300">Property Lines</span>
            </label>
          </div>
        </div>
      )}

      {/* Help text */}
      {isAdmin && toolMode !== 'select' && (
        <div className="absolute top-40 left-4 z-10 bg-blue-900/90 backdrop-blur px-4 py-2 rounded-lg text-sm text-white max-w-xs">
          {toolMode === 'handhole' && '🖱️ Click on the map to place a handhole'}
          {toolMode === 'pedestal' && '🖱️ Click on the map to place a pedestal'}
          {toolMode === 'bore' && '📏 Use the draw tool to draw a bore path line'}
        </div>
      )}

      <div ref={mapContainer} className="w-full h-full" />

      {/* Save Modal */}
      {saveModal && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-20 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-md shadow-2xl border border-gray-700">
            <h3 className="text-xl font-bold text-white mb-4">
              {saveModal.featureType === 'point' ? 'Add Handhole/Pedestal' : 'Add Bore Path'}
            </h3>

            {saveModal.featureType === 'point' && (
              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-400 mb-2 uppercase tracking-wide">Type</label>
                <div className="flex gap-2 mb-3">
                  <button
                    onClick={() => setSaveForm(p => ({ ...p, kind: 'handhole', type_id: '' }))}
                    className={`flex-1 py-2 rounded-lg font-medium text-sm ${saveForm.kind === 'handhole' ? 'bg-orange-500 text-white' : 'bg-gray-700 text-gray-300'}`}
                  >
                    ⬡ Handhole
                  </button>
                  <button
                    onClick={() => setSaveForm(p => ({ ...p, kind: 'pedestal', type_id: '' }))}
                    className={`flex-1 py-2 rounded-lg font-medium text-sm ${saveForm.kind === 'pedestal' ? 'bg-orange-500 text-white' : 'bg-gray-700 text-gray-300'}`}
                  >
                    ◆ Pedestal
                  </button>
                </div>
                
                <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wide">
                  {saveForm.kind === 'handhole' ? 'Handhole Type' : 'Pedestal Type'}
                </label>
                <select
                  value={saveForm.type_id}
                  onChange={e => setSaveForm(p => ({ ...p, type_id: e.target.value }))}
                  className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="">-- Select Type --</option>
                  {(saveForm.kind === 'handhole' ? handholeTypes : pedestalTypes).map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            )}

            {saveModal.featureType === 'line' && (
              <>
                <div className="mb-4">
                  <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wide">Pipe Size</label>
                  <select
                    value={saveForm.pipe_size_id}
                    onChange={e => setSaveForm(p => ({ ...p, pipe_size_id: e.target.value }))}
                    className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-white text-sm"
                  >
                    <option value="">-- Select Pipe Size --</option>
                    {pipeSizes.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div className="mb-4">
                  <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wide">Number of Conduits</label>
                  <input
                    type="number"
                    min="1"
                    max="24"
                    value={saveForm.num_pipes}
                    onChange={e => setSaveForm(p => ({ ...p, num_pipes: e.target.value }))}
                    className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-white text-sm"
                  />
                </div>
              </>
            )}

            <div className="mb-4">
              <label className="block text-xs font-medium text-gray-400 mb-1.5 uppercase tracking-wide">Label (optional)</label>
              <input
                value={saveForm.label}
                onChange={e => setSaveForm(p => ({ ...p, label: e.target.value }))}
                placeholder={saveModal.featureType === 'point' ? 'e.g. HH-01' : 'e.g. BORE-01'}
                className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-white text-sm placeholder-gray-500"
              />
            </div>

            <div className="flex gap-3">
              <button onClick={handleSave} disabled={saving} className="flex-1 bg-orange-500 hover:bg-orange-600 text-white font-medium py-2.5 rounded-xl">
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button onClick={() => { draw.current?.deleteAll(); setSaveModal(null) }} className="flex-1 bg-gray-700 hover:bg-gray-600 text-white py-2.5 rounded-xl">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
