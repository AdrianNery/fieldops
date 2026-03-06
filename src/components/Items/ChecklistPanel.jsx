import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

export default function ChecklistPanel({ itemType, itemId }) {
  const { user, profile } = useAuth()
  const [templateItems, setTemplateItems] = useState([])
  const [responses, setResponses] = useState({})
  const [loading, setLoading] = useState(true)
  const [noTemplate, setNoTemplate] = useState(false)

  useEffect(() => {
    if (!itemId) return
    loadChecklist()
  }, [itemType, itemId])

  async function loadChecklist() {
    setLoading(true)
    const { data: tmpl } = await supabase
      .from('checklist_templates')
      .select('id')
      .eq('item_type', itemType)
      .single()

    if (!tmpl) {
      setNoTemplate(true)
      setLoading(false)
      return
    }

    setNoTemplate(false)
    const { data: items } = await supabase
      .from('checklist_template_items')
      .select('*')
      .eq('template_id', tmpl.id)
      .order('order_index')

    setTemplateItems(items || [])

    const { data: resp } = await supabase
      .from('item_checklist_responses')
      .select('*, profiles(full_name)')
      .eq('item_type', itemType)
      .eq('item_id', itemId)

    const map = {}
    resp?.forEach(r => { map[r.template_item_id] = r })
    setResponses(map)
    setLoading(false)
  }

  async function toggleItem(templateItemId) {
    const existing = responses[templateItemId]
    const newChecked = !existing?.checked

    const { data, error } = await supabase
      .from('item_checklist_responses')
      .upsert({
        item_type: itemType,
        item_id: itemId,
        template_item_id: templateItemId,
        checked: newChecked,
        checked_by: user.id,
        checked_at: newChecked ? new Date().toISOString() : null
      }, { onConflict: 'item_type,item_id,template_item_id' })
      .select('*, profiles(full_name)')
      .single()

    if (data) setResponses(prev => ({ ...prev, [templateItemId]: data }))
  }

  const checkedCount = Object.values(responses).filter(r => r.checked).length

  if (loading) return <p className="text-gray-400 text-sm animate-pulse">Loading checklist...</p>

  if (noTemplate) return (
    <div className="text-center py-6">
      <p className="text-3xl mb-2">📋</p>
      <p className="text-gray-400 text-sm">No checklist configured for this item type.</p>
      <p className="text-gray-500 text-xs mt-1">Set one up in Admin Settings → Checklists</p>
    </div>
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs text-gray-500">{checkedCount} of {templateItems.length} complete</p>
        <div className="flex-1 mx-3 bg-gray-700 rounded-full h-1.5">
          <div
            className="bg-green-500 h-1.5 rounded-full transition-all"
            style={{ width: `${templateItems.length ? (checkedCount / templateItems.length) * 100 : 0}%` }}
          />
        </div>
      </div>
      <div className="space-y-3">
        {templateItems.map(item => {
          const resp = responses[item.id]
          return (
            <label key={item.id} className="flex items-start gap-3 cursor-pointer group">
              <input
                type="checkbox"
                checked={resp?.checked || false}
                onChange={() => toggleItem(item.id)}
                className="mt-0.5 w-5 h-5 rounded accent-orange-500 cursor-pointer shrink-0"
              />
              <div className="flex-1 min-w-0">
                <span className={`text-sm block ${resp?.checked ? 'line-through text-gray-500' : 'text-gray-200'}`}>
                  {item.label}
                </span>
                {resp?.checked && resp?.profiles && (
                  <p className="text-xs text-gray-600 mt-0.5">
                    ✓ {resp.profiles.full_name} · {new Date(resp.checked_at).toLocaleDateString()}
                  </p>
                )}
              </div>
            </label>
          )
        })}
      </div>
    </div>
  )
}
