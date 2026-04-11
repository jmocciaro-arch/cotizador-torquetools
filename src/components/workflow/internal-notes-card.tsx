'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { MessageSquare, Send, User } from 'lucide-react'

export interface InternalNote {
  id: string
  author: string
  authorInitials: string
  content: string
  createdAt: string
  isSystem?: boolean
}

interface InternalNotesCardProps {
  notes: InternalNote[]
  onAddNote?: (content: string) => void
}

export function InternalNotesCard({ notes, onAddNote }: InternalNotesCardProps) {
  const [newNote, setNewNote] = useState('')

  const handleSubmit = () => {
    if (newNote.trim() && onAddNote) {
      onAddNote(newNote.trim())
      setNewNote('')
    }
  }

  return (
    <div className="bg-[#141820] rounded-xl border border-[#2A3040] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[#2A3040]">
        <MessageSquare size={14} className="text-[#9CA3AF]" />
        <h3 className="text-xs font-bold text-[#F0F2F5] uppercase tracking-wide">
          Notas internas
        </h3>
        <span className="text-[10px] text-[#6B7280]">({notes.length})</span>
      </div>

      {/* Notes list */}
      <div className="max-h-[300px] overflow-y-auto">
        {notes.length > 0 ? (
          <div className="divide-y divide-[#1E2330]">
            {notes.map((note) => (
              <div
                key={note.id}
                className={cn(
                  'px-4 py-3',
                  note.isSystem && 'bg-[#1C2230]/30'
                )}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  {note.isSystem ? (
                    <div className="w-5 h-5 rounded-full bg-[#2A3040] flex items-center justify-center">
                      <span className="text-[8px] text-[#6B7280]">SYS</span>
                    </div>
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-[#FF6600] flex items-center justify-center">
                      <span className="text-[8px] text-white font-bold">{note.authorInitials}</span>
                    </div>
                  )}
                  <span className="text-[10px] font-semibold text-[#9CA3AF]">
                    {note.author}
                  </span>
                  <span className="text-[9px] text-[#6B7280]">
                    {note.createdAt}
                  </span>
                </div>
                <p className="text-xs text-[#D1D5DB] leading-relaxed pl-7">
                  {note.content}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-4 py-6 text-center">
            <p className="text-xs text-[#6B7280]">Sin notas internas</p>
          </div>
        )}
      </div>

      {/* Add note */}
      {onAddNote && (
        <div className="px-4 py-3 border-t border-[#2A3040]">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder="Agregar nota interna..."
              className="flex-1 bg-[#0B0E13] border border-[#2A3040] rounded-lg px-3 py-2 text-xs text-[#F0F2F5] placeholder-[#6B7280] focus:outline-none focus:border-[#FF6600] transition-colors"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSubmit()
                }
              }}
            />
            <button
              onClick={handleSubmit}
              disabled={!newNote.trim()}
              className={cn(
                'p-2 rounded-lg transition-colors',
                newNote.trim()
                  ? 'bg-[#FF6600] text-white hover:bg-[#E55A00]'
                  : 'bg-[#1E2330] text-[#6B7280]'
              )}
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
