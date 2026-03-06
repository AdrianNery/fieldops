import { useState } from 'react'
import AppShell from '../components/Layout/AppShell'
import TypeManager from '../components/Admin/TypeManager'
import ChecklistTemplateManager from '../components/Admin/ChecklistTemplateManager'
import UserManager from '../components/Admin/UserManager'

const TABS = [
  { key: 'handhole-types', label: '🔳 Handhole Types' },
  { key: 'pedestal-types', label: '📦 Pedestal Types' },
  { key: 'pipe-sizes',     label: '〰️ Pipe Sizes' },
  { key: 'checklists',     label: '✅ Checklists' },
  { key: 'users',          label: '👥 Users' },
]

export default function AdminSettings() {
  const [activeTab, setActiveTab] = useState('handhole-types')

  return (
    <AppShell>
      <div className="p-6 max-w-3xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-white">Admin Settings</h1>
          <p className="text-gray-400 text-sm mt-1">Manage item types, checklists, and users</p>
        </div>

        {/* Tab bar */}
        <div className="flex gap-2 flex-wrap mb-8 border-b border-gray-700 pb-4">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-orange-500 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === 'handhole-types' && (
          <TypeManager tableName="handhole_types" title="Handhole Types" singularName="Handhole Type" />
        )}
        {activeTab === 'pedestal-types' && (
          <TypeManager tableName="pedestal_types" title="Pedestal Types" singularName="Pedestal Type" />
        )}
        {activeTab === 'pipe-sizes' && (
          <TypeManager tableName="bore_pipe_sizes" title="Bore Pipe Sizes" singularName="Pipe Size" />
        )}
        {activeTab === 'checklists' && <ChecklistTemplateManager />}
        {activeTab === 'users' && <UserManager />}
      </div>
    </AppShell>
  )
}
