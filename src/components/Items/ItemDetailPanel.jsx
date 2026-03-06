import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import StatusBadge from './StatusBadge'
import ChecklistPanel from './ChecklistPanel'
import NotesPanel from './NotesPanel'

const STATUS_OPTIONS = [
  { value: 'not_started',     label: '🔴 Not Started' },
  { value: 'in_progress',     label: '🟡 In Progress' },
  { value: 'needs_attention', label: '🟠 Needs Attention' },
  { value: 'complete',        label: '🟢 Complete' },
]

const TABLE_MAP = {
  handhole:  'handholes',
  pedestal:  'pedestals',
  bore_path: 'bore_paths',
}

const TYPE_ICONS = {
  handhole:  '🔳',
  pedestal:  '📦',
  bore_path: '〰️',
}

const TYPE_LABELS = {
  handhole:  'Handhole',
  pedestal:  'Pedestal',
  bore_path: 'Bore Path',
}

export default function ItemDetailPanel({ itemType, item, onClose, onStatusChange }) {
  const { profile, user } = useAuth()
  const isAdmin = profile?.role === 'admin'
  const [tab, setTab] = useState('checklist')
  const [currentStatus, setCurrentStatus] = useState(item.status || 'not_started')
  const [updatingStatus, setUpdatingStatus] = useState(false)

  async function handleStatusChange(newStatus) {
    if (!isAdmin) return
    setUpdatingStatus(true)
    const table = TABLE_MAP[itemType]
    const { error } = await supabase
      .from(table)
      .update({
        status: newStatus,
        status_changed_by: user.id,
        status_changed_at: new Date().toISOString()
      })
      .eq('id', item.id)

    if (!error) {
      await supabase.from('status_logs').insert({
        item_type: itemType,
        item_id: item.id,
        old_status: currentStatus,
        new_status: newStatus,
        changed_by: user.id
      })
      setCurrentStatus(newStatus)
      onStatusChange && onStatusChange(newStatus)
    }
    setUpdatingStatus(false)
  }

  return (
    <div className="flex flex-col h-full bg-gray-800">
      {/* Header */}
      <div className="flex items-start justify-between p-4 border-b border-gray-700">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">{TYPE_ICONS[itemType]}</span>
            <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">{TYPE_LABELS[itemType]}</span>
          </div>
          <h2 className="text-lg font-bold text-white truncate">
            {item.label || `Unlabeled ${TYPE_LABELS[itemType]}`}
          </h2>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white text-2xl leading-none ml-3 shrink-0 hover:bg-gray-700 w-8 h-8 flex items-center justify-center rounded-lg transition-colors"
        >
          ×
        </button>
      </div>

      {/* Status */}
      <div className="px-4 py-3 border-b border-gray-700 bg-gray-800/50">
        <div className="flex items-center gap-3 flex-wrap">
          <StatusBadge status={currentStatus} />
          {isAdmin && (
            <select
              value={currentStatus}
              onChange={e => handleStatusChange(e.target.value)}
              disabled={updatingStatus}
              className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50"
            >
              {STATUS_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          )}
          {updatingStatus && <span className="text-xs text-gray-500 animate-pulse">Saving...</span>}
        </div>

        {/* Item-specific metadata */}
        {itemType === 'bore_path' && (
          <p className="text-xs text-gray-500 mt-2">
            {item.num_pipes || 1} conduit{(item.num_pipes || 1) !== 1 ? 's' : ''}
            {item.pipe_size_id ? ' · size on record' : ''}
          </p>
        )}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-700 shrink-0">
        {[
          { key: 'checklist', label: '✅ Checklist' },
          { key: 'notes',     label: '💬 Notes & Media' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-3 text-sm font-medium transition-colors ${
              tab === t.key
                ? 'text-orange-500 border-b-2 border-orange-500 bg-orange-500/5'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Panel content */}
      <div className="flex-1 overflow-auto p-4">
        {tab === 'checklist'
          ? <ChecklistPanel itemType={itemType} itemId={item.id} />
          : <NotesPanel itemType={itemType} itemId={item.id} />
        }
      </div>
    </div>
  )
}
