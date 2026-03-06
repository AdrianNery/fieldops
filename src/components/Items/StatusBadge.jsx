const STATUS_MAP = {
  not_started:      { label: 'Not Started',        color: 'bg-red-500/20 text-red-400 border-red-500/30' },
  in_progress:      { label: 'In Progress',        color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30' },
  needs_attention:  { label: 'Needs Attention',    color: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
  complete:         { label: 'Complete',           color: 'bg-green-500/20 text-green-400 border-green-500/30' },
}

export default function StatusBadge({ status, size = 'sm' }) {
  const s = STATUS_MAP[status] || STATUS_MAP.not_started
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${s.color}`}>
      {s.label}
    </span>
  )
}
