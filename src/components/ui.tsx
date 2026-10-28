import { useEffect, useRef, useState, type ReactNode, type TouchEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, nowIso, type TagScope } from '../db'
import { todayKey } from '../lib/date'
import { IconBack, IconCheck, IconMinus, IconPlus } from './Icons'

export function TopBar({
  title, back = true, onAdd, deleteMode, onToggleDelete, children,
}: {
  title: string
  back?: boolean
  onAdd?: () => void
  deleteMode?: boolean
  onToggleDelete?: () => void
  children?: ReactNode
}) {
  const navigate = useNavigate()
  return (
    <header className="topbar">
      {back && (
        <button className="icon-btn" aria-label="Zurück" onClick={() => navigate(-1)}>
          <IconBack />
        </button>
      )}
      <h1>{title}</h1>
      {children}
      {onToggleDelete && (
        <button className={`icon-btn ${deleteMode ? 'active' : ''}`} aria-label="Löschen-Modus" onClick={onToggleDelete}>
          <IconMinus />
        </button>
      )}
      {onAdd && (
        <button className="icon-btn" aria-label="Neu" onClick={onAdd}>
          <IconPlus />
        </button>
      )}
    </header>
  )
}

export function DeleteHint({ active }: { active?: boolean }) {
  if (!active) return null
  return <p className="small" style={{ color: 'var(--red)', margin: '0 0 10px' }}>Löschen-Modus: Eintrag antippen, um ihn zu löschen.</p>
}

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])
  return (
    <div className="sheet-backdrop" onClick={() => onClose()}>
      <div className="sheet" role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  )
}

export function Checkbox({ on, onChange, label }: { on: boolean; onChange: () => void; label?: string }) {
  return (
    <button className={`checkbox ${on ? 'on' : ''}`} aria-label={label ?? 'Erledigt'} aria-pressed={on}
      onClick={(e) => { e.stopPropagation(); onChange() }}>
      {on && <IconCheck />}
    </button>
  )
}

/**
 * Horizontal swipe detection. Swiping right means "back in time" throughout the app.
 */
export function useSwipe(onRight: () => void, onLeft: () => void) {
  const start = useRef<{ x: number; y: number } | null>(null)
  return {
    onTouchStart: (e: TouchEvent) => {
      const t = e.touches[0]
      start.current = { x: t.clientX, y: t.clientY }
    },
    onTouchEnd: (e: TouchEvent) => {
      if (!start.current) return
      const t = e.changedTouches[0]
      const dx = t.clientX - start.current.x
      const dy = t.clientY - start.current.y
      start.current = null
      if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(dy) * 1.5) return
      if (dx > 0) onRight()
      else onLeft()
    },
  }
}

/** Optional date + optional time (time only once a date is set). */
export function DateTimeFields({
  date, time, onDate, onTime, dateLabel = 'Datum (optional)', required = false,
}: {
  date?: string
  time?: string
  onDate: (v?: string) => void
  onTime: (v?: string) => void
  dateLabel?: string
  required?: boolean
}) {
  return (
    <div className="row" style={{ alignItems: 'flex-end' }}>
      <label className="field grow">
        {dateLabel}
        <input type="date" value={date ?? ''} required={required}
          onChange={(e) => { onDate(e.target.value || undefined); if (!e.target.value) onTime(undefined) }} />
      </label>
      <label className="field" style={{ width: 130 }}>
        Uhrzeit (optional)
        <input type="time" value={time ?? ''} disabled={!date} onChange={(e) => onTime(e.target.value || undefined)} />
      </label>
    </div>
  )
}

/** Tag picker: existing tags as chips, new tags get added to the list automatically on save. */
export function TagInput({ scope, value, onChange }: { scope: TagScope; value: string[]; onChange: (v: string[]) => void }) {
  const tags = useLiveQuery(() => db.tags.where('scope').equals(scope).sortBy('name'), [scope]) ?? []
  const [draft, setDraft] = useState('')
  const names = Array.from(new Set([...tags.map((t) => t.name), ...value]))
  const toggle = (name: string) => onChange(value.includes(name) ? value.filter((v) => v !== name) : [...value, name])
  const addDraft = () => {
    const name = draft.trim().replace(/^#/, '')
    if (name && !value.includes(name)) onChange([...value, name])
    setDraft('')
  }
  return (
    <div className="field" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span className="small muted">Tags</span>
      {names.length > 0 && (
        <div className="chips">
          {names.map((n) => (
            <button type="button" key={n} className={`chip ${value.includes(n) ? 'on' : ''}`} onClick={() => toggle(n)}>
              #{n}
            </button>
          ))}
        </div>
      )}
      <div className="row">
        <input type="text" placeholder="Neuer Tag" value={draft} onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addDraft() } }} />
        <button type="button" className="btn small" onClick={addDraft} disabled={!draft.trim()}>+</button>
      </div>
    </div>
  )
}

/** Project selection with the option to create a new project inline. */
export function ProjectSelect({ value, onChange }: { value?: number; onChange: (id?: number) => void }) {
  const projects = useLiveQuery(() => db.projects.where('status').equals('active').toArray()) ?? []
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const create = async () => {
    if (!name.trim()) return
    const id = await db.projects.add({
      name: name.trim(), description: '', startDate: todayKey(), status: 'active', createdAt: nowIso(),
    })
    onChange(id)
    setName('')
    setCreating(false)
  }
  return (
    <label className="field">
      Projekt (optional)
      {creating ? (
        <div className="row">
          <input type="text" autoFocus placeholder="Name des neuen Projekts" value={name} onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); create() } }} />
          <button type="button" className="btn small" onClick={create}>OK</button>
        </div>
      ) : (
        <select value={value ?? ''} onChange={(e) => {
          if (e.target.value === '__new') setCreating(true)
          else onChange(e.target.value ? Number(e.target.value) : undefined)
        }}>
          <option value="">— kein Projekt —</option>
          {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          <option value="__new">+ Neues Projekt anlegen …</option>
        </select>
      )}
    </label>
  )
}

export function useProjectNames() {
  const projects = useLiveQuery(() => db.projects.toArray()) ?? []
  return new Map(projects.map((p) => [p.id!, p.name]))
}

export function SearchInput({ value, onChange, placeholder = 'Suchen …' }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return <input type="search" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
}

export function confirmDelete(what: string) {
  return window.confirm(`„${what}“ wirklich löschen?`)
}
