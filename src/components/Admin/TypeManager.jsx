import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'

export default function TypeManager({ tableName, title, singularName }) {
  const [items, setItems] = useState([])
  const [name, setName] = useState('')
  const [desc, setDesc] = useState('')
  const [editId, setEditId] = useState(null)
  const [saving, setSaving] = useState(false)

  async function load() {
    const { data } = await supabase.from(tableName).select('*').order('created_at')
    setItems(data || [])
  }

  useEffect(() => { load() }, [tableName])

  async function save() {
    if (!name.trim()) return
    setSaving(true)
    if (editId) {
      await supabase.from(tableName).update({ name: name.trim(), description: desc.trim() || null }).eq('id', editId)
    } else {
      await supabase.from(tableName).insert({ name: name.trim(), description: desc.trim() || null })
    }
    setName(''); setDesc(''); setEditId(null)
    await load()
    setSaving(false)
  }

  async function del(id, itemName) {
    if (!confirm(`Delete "${itemName}"? This cannot be undone.`)) return
    await supabase.from(tableName).delete().eq('id', id)
    load()
  }

  function startEdit(item) {
    setEditId(item.id)
    setName(item.name)
    setDesc(item.description || '')
  }

  function cancelEdit() {
    setEditId(null); setName(''); setDesc('')
  }

  return (
    <div>
      <h2 className="text-lg font-semibold text-white mb-4">{title}</h2>

      {/* Add / Edit form */}
      <div className="bg-gray-700/50 border border-gray-600 rounded-2xl p-4 mb-6 space-y-3">
        <h3 className="text-sm font-medium text-gray-300">{editId ? `Edit ${singularName}` : `Add ${singularName}`}</h3>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder={`${singularName} name (required)`}
          onKeyDown={e => e.key === 'Enter' && save()}
          className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
        <input
          value={desc}
          onChange={e => setDesc(e.target.value)}
          placeholder="Description (optional)"
          onKeyDown={e => e.key === 'Enter' && save()}
          className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
        <div className="flex gap-2">
          <button
            onClick={save}
            disabled={saving || !name.trim()}
            className="bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors"
          >
            {saving ? 'Saving...' : editId ? 'Update' : 'Add'}
          </button>
          {editId && (
            <button onClick={cancelEdit} className="bg-gray-600 hover:bg-gray-500 text-white text-sm px-4 py-2 rounded-xl transition-colors">
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div className="space-y-2">
        {items.length === 0 && (
          <p className="text-gray-500 text-sm italic text-center py-6">No {title.toLowerCase()} yet. Add one above.</p>
        )}
        {items.map(item => (
          <div key={item.id} className="flex items-center justify-between bg-gray-700 rounded-xl px-4 py-3 gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-white font-medium truncate">{item.name}</p>
              {item.description && <p className="text-gray-400 text-sm truncate">{item.description}</p>}
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={() => startEdit(item)} className="text-orange-400 hover:text-orange-300 text-sm px-2 py-1 rounded hover:bg-gray-600 transition-colors">Edit</button>
              <button onClick={() => del(item.id, item.name)} className="text-red-400 hover:text-red-300 text-sm px-2 py-1 rounded hover:bg-gray-600 transition-colors">Delete</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
