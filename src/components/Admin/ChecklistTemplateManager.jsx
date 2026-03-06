import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

const ITEM_TYPES = [
  { value: 'handhole',  label: '🔳 Handhole',  desc: 'QC items for handhole installation' },
  { value: 'pedestal',  label: '📦 Pedestal',  desc: 'QC items for pedestal installation' },
  { value: 'bore_path', label: '〰️ Bore Path', desc: 'QC items for bore path completion' },
]

export default function ChecklistTemplateManager() {
  const [templates, setTemplates] = useState({})
  const [templateItems, setTemplateItems] = useState({})
  const [newLabels, setNewLabels] = useState({})
  const [saving, setSaving] = useState({})

  async function loadAll() {
    const { data: tmpls } = await supabase.from('checklist_templates').select('*')
    const map = {}
    tmpls?.forEach(t => { map[t.item_type] = t })
    setTemplates(map)

    const itemMap = {}
    for (const t of (tmpls || [])) {
      const { data: items } = await supabase
        .from('checklist_template_items')
        .select('*')
        .eq('template_id', t.id)
        .order('order_index')
      itemMap[t.item_type] = items || []
    }
    setTemplateItems(itemMap)
  }

  useEffect(() => { loadAll() }, [])

  async function createTemplate(itemType, label) {
    const name = `${label} Checklist`
    await supabase.from('checklist_templates').insert({ name, item_type: itemType })
    loadAll()
  }

  async function addItem(itemType) {
    const label = newLabels[itemType]?.trim()
    if (!label) return
    setSaving(p => ({ ...p, [itemType]: true }))
    const template = templates[itemType]
    const existing = templateItems[itemType] || []
    await supabase.from('checklist_template_items').insert({
      template_id: template.id,
      label,
      order_index: existing.length
    })
    setNewLabels(prev => ({ ...prev, [itemType]: '' }))
    await loadAll()
    setSaving(p => ({ ...p, [itemType]: false }))
  }

  async function deleteItem(id) {
    if (!confirm('Remove this checklist item?')) return
    await supabase.from('checklist_template_items').delete().eq('id', id)
    loadAll()
  }

  async function moveItem(item, direction, itemType) {
    const list = [...(templateItems[itemType] || [])]
    const idx = list.findIndex(i => i.id === item.id)
    const newIdx = idx + direction
    if (newIdx < 0 || newIdx >= list.length) return
    const swapped = list[newIdx]
    await Promise.all([
      supabase.from('checklist_template_items').update({ order_index: newIdx }).eq('id', item.id),
      supabase.from('checklist_template_items').update({ order_index: idx }).eq('id', swapped.id)
    ])
    loadAll()
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-white">Checklist Templates</h2>
        <p className="text-gray-400 text-sm mt-1">Define QC checklists for each item type. Crews check these off in the field.</p>
      </div>

      {ITEM_TYPES.map(({ value, label, desc }) => (
        <div key={value} className="bg-gray-700/50 border border-gray-600 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-600">
            <h3 className="text-white font-semibold">{label}</h3>
            <p className="text-gray-400 text-xs mt-0.5">{desc}</p>
          </div>

          <div className="p-4">
            {!templates[value] ? (
              <div className="text-center py-4">
                <p className="text-gray-500 text-sm mb-3">No template yet.</p>
                <button
                  onClick={() => createTemplate(value, label.replace(/^[^\w]+/, ''))}
                  className="bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
                >
                  Create Template
                </button>
              </div>
            ) : (
              <div className="space-y-2">
                {(templateItems[value] || []).length === 0 && (
                  <p className="text-gray-500 text-sm italic">No items yet. Add some below.</p>
                )}
                {(templateItems[value] || []).map((item, idx) => (
                  <div key={item.id} className="flex items-center gap-2 bg-gray-700 rounded-xl px-3 py-2.5 group">
                    <span className="text-gray-500 text-xs w-5 text-center">{idx + 1}</span>
                    <span className="flex-1 text-sm text-gray-200">☐ {item.label}</span>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => moveItem(item, -1, value)} disabled={idx === 0}
                        className="text-gray-400 hover:text-white disabled:opacity-30 px-1 py-0.5 rounded text-xs">↑</button>
                      <button onClick={() => moveItem(item, 1, value)} disabled={idx === (templateItems[value] || []).length - 1}
                        className="text-gray-400 hover:text-white disabled:opacity-30 px-1 py-0.5 rounded text-xs">↓</button>
                      <button onClick={() => deleteItem(item.id)}
                        className="text-red-400 hover:text-red-300 px-1 py-0.5 rounded text-xs">✕</button>
                    </div>
                  </div>
                ))}

                <div className="flex gap-2 mt-3">
                  <input
                    value={newLabels[value] || ''}
                    onChange={e => setNewLabels(prev => ({ ...prev, [value]: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && addItem(value)}
                    placeholder="New checklist item..."
                    className="flex-1 bg-gray-700 border border-gray-600 rounded-xl px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                  <button
                    onClick={() => addItem(value)}
                    disabled={saving[value] || !newLabels[value]?.trim()}
                    className="bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white text-sm px-3 py-2 rounded-xl transition-colors"
                  >
                    {saving[value] ? '...' : 'Add'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
