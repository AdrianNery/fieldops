import { useEffect, useState, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'
import MediaUpload from './MediaUpload'

export default function NotesPanel({ itemType, itemId }) {
  const { user } = useAuth()
  const [notes, setNotes] = useState([])
  const [newNote, setNewNote] = useState('')
  const [files, setFiles] = useState([])
  const [submitting, setSubmitting] = useState(false)
  const [lightbox, setLightbox] = useState(null)

  async function fetchNotes() {
    const { data } = await supabase
      .from('item_notes')
      .select('*, profiles(full_name), item_media(*)')
      .eq('item_type', itemType)
      .eq('item_id', itemId)
      .order('created_at', { ascending: false })
    setNotes(data || [])
  }

  useEffect(() => {
    if (!itemId) return
    fetchNotes()
    const channel = supabase
      .channel(`notes-${itemType}-${itemId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'item_notes',
        filter: `item_id=eq.${itemId}`
      }, fetchNotes)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [itemId, itemType])

  async function uploadFile(file, noteId) {
    const ext = file.name.split('.').pop()
    const path = `${itemType}/${itemId}/${noteId}/${Date.now()}.${ext}`
    const { error: uploadError } = await supabase.storage
      .from('fieldops-media')
      .upload(path, file)
    if (uploadError) { console.error('Upload error:', uploadError); return }
    const { data: { publicUrl } } = supabase.storage.from('fieldops-media').getPublicUrl(path)
    await supabase.from('item_media').insert({
      item_type: itemType,
      item_id: itemId,
      note_id: noteId,
      user_id: user.id,
      url: publicUrl,
      storage_path: path,
      media_type: file.type.startsWith('video') ? 'video' : 'photo',
      filename: file.name
    })
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!newNote.trim() && files.length === 0) return
    setSubmitting(true)
    const { data: note, error } = await supabase
      .from('item_notes')
      .insert({
        item_type: itemType,
        item_id: itemId,
        user_id: user.id,
        note: newNote.trim() || '(media attached)'
      })
      .select()
      .single()

    if (error) { console.error('Note error:', error); setSubmitting(false); return }

    if (files.length > 0) {
      await Promise.all(files.map(f => uploadFile(f, note.id)))
    }

    setNewNote('')
    setFiles([])
    await fetchNotes()
    setSubmitting(false)
  }

  function timeAgo(date) {
    const diff = Date.now() - new Date(date).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24) return `${hrs}h ago`
    return new Date(date).toLocaleDateString()
  }

  return (
    <div className="flex flex-col h-full">
      {/* Lightbox */}
      {lightbox && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
          {lightbox.type === 'video'
            ? <video src={lightbox.url} controls className="max-w-full max-h-full rounded-xl" onClick={e => e.stopPropagation()} />
            : <img src={lightbox.url} className="max-w-full max-h-full rounded-xl object-contain" alt="" />
          }
          <button onClick={() => setLightbox(null)} className="absolute top-4 right-4 text-white text-3xl leading-none hover:text-gray-300">×</button>
        </div>
      )}

      <div className="flex-1 overflow-auto space-y-3 mb-4 pr-1">
        {notes.length === 0 && (
          <div className="text-center py-8">
            <p className="text-3xl mb-2">💬</p>
            <p className="text-gray-500 text-sm">No notes yet. Add the first one.</p>
          </div>
        )}
        {notes.map(note => (
          <div key={note.id} className="bg-gray-750 border border-gray-700 rounded-xl p-3">
            <div className="flex items-start justify-between mb-2 gap-2">
              <span className="text-sm font-semibold text-orange-400 truncate">
                {note.profiles?.full_name || 'Unknown'}
              </span>
              <span className="text-xs text-gray-500 shrink-0">{timeAgo(note.created_at)}</span>
            </div>
            <p className="text-sm text-gray-200 whitespace-pre-wrap break-words">{note.note}</p>
            {note.item_media?.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {note.item_media.map(m => m.media_type === 'video' ? (
                  <div key={m.id} className="relative cursor-pointer" onClick={() => setLightbox({ url: m.url, type: 'video' })}>
                    <video src={m.url} className="w-20 h-20 object-cover rounded-lg border border-gray-600" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-lg">
                      <span className="text-2xl">▶️</span>
                    </div>
                  </div>
                ) : (
                  <img key={m.id} src={m.url} alt={m.filename}
                    className="w-20 h-20 object-cover rounded-lg border border-gray-600 cursor-pointer hover:opacity-80 transition"
                    onClick={() => setLightbox({ url: m.url, type: 'photo' })}
                  />
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="border-t border-gray-700 pt-3 space-y-2 shrink-0">
        <textarea
          value={newNote}
          onChange={e => setNewNote(e.target.value)}
          rows={3}
          placeholder="Add a note for the crew..."
          className="w-full bg-gray-700 border border-gray-600 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-500 resize-none focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
        <div className="flex items-center justify-between gap-2">
          <MediaUpload onFilesSelected={setFiles} />
          <button
            type="submit"
            disabled={submitting || (!newNote.trim() && files.length === 0)}
            className="bg-orange-500 hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-medium px-4 py-2 rounded-xl transition-colors shrink-0"
          >
            {submitting ? 'Posting...' : 'Post'}
          </button>
        </div>
      </form>
    </div>
  )
}
