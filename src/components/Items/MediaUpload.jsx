import { useRef, useState } from 'react'

export default function MediaUpload({ onFilesSelected }) {
  const inputRef = useRef()
  const [previews, setPreviews] = useState([])

  function handleChange(e) {
    const files = Array.from(e.target.files)
    if (!files.length) return
    onFilesSelected(files)
    const urls = files.map(f => ({
      url: URL.createObjectURL(f),
      type: f.type.startsWith('video') ? 'video' : 'photo',
      name: f.name
    }))
    setPreviews(prev => [...prev, ...urls])
  }

  function clearPreviews() {
    previews.forEach(p => URL.revokeObjectURL(p.url))
    setPreviews([])
    onFilesSelected([])
    inputRef.current.value = ''
  }

  return (
    <div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current.click()}
          className="flex items-center gap-1.5 text-sm text-orange-400 hover:text-orange-300 transition-colors"
        >
          <span>📎</span> Attach Photos/Videos
        </button>
        {previews.length > 0 && (
          <button type="button" onClick={clearPreviews} className="text-xs text-gray-500 hover:text-gray-300">
            Clear ({previews.length})
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*,video/*"
        capture="environment"
        onChange={handleChange}
        className="hidden"
      />
      {previews.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {previews.map((p, i) =>
            p.type === 'video' ? (
              <video key={i} src={p.url} className="w-16 h-16 object-cover rounded-lg border border-gray-600" />
            ) : (
              <img key={i} src={p.url} className="w-16 h-16 object-cover rounded-lg border border-gray-600" alt={p.name} />
            )
          )}
        </div>
      )}
    </div>
  )
}
