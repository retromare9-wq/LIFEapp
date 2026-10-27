import { useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Dream, type Mood, type MoodLevel, type Note } from '../db'
import { WEEKDAYS, addMonths, fmtDateTime, monthGrid, todayKey } from '../lib/date'
import { DeleteHint, SearchInput, TopBar, confirmDelete, useProjectNames, useSwipe } from '../components/ui'
import { AttachmentBadge, AttachmentList } from '../components/Attachments'
import { DreamForm, MOODS, MoodForm, NoteForm, moodLabel } from '../forms/JournalForms'
import { MonthNav } from './Calendar'

const matches = (text: string, q: string) => !q.trim() || text.toLowerCase().includes(q.trim().toLowerCase())
const newestFirst = <T extends { date: string; time?: string; createdAt: string }>(a: T, b: T) =>
  `${b.date}${b.time ?? ''}${b.createdAt}`.localeCompare(`${a.date}${a.time ?? ''}${a.createdAt}`)

function TagFilter({ tags, value, onChange }: { tags: string[]; value: string[]; onChange: (v: string[]) => void }) {
  if (!tags.length) return null
  return (
    <div className="chips" style={{ marginBottom: 10 }}>
      {tags.map((t) => (
        <button key={t} className={`chip ${value.includes(t) ? 'on' : ''}`}
          onClick={() => onChange(value.includes(t) ? value.filter((x) => x !== t) : [...value, t])}>#{t}</button>
      ))}
    </div>
  )
}

function Entry({ meta, text, color, deleteMode, onClick, children }: {
  meta: ReactNode; text: string; color?: string; deleteMode?: boolean; onClick: () => void; children?: ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className={`item ${deleteMode ? 'deletable' : ''}`} style={{ alignItems: 'stretch' }} role="button"
      onClick={() => (deleteMode ? onClick() : setOpen(!open))}>
      {color && <span className="stripe" style={{ background: color, width: 6 }} />}
      <div className="grow">
        <div className="meta" style={{ marginBottom: 3 }}>{meta}</div>
        <div className={`pre ${open ? '' : 'clamp'}`}>{text || <span className="muted">(ohne Text)</span>}</div>
        {open && children}
        {open && !deleteMode && (
          <button className="btn small ghost" style={{ marginTop: 8 }} onClick={(e) => { e.stopPropagation(); onClick() }}>Bearbeiten</button>
        )}
      </div>
    </div>
  )
}

export function NotesPage() {
  const [editing, setEditing] = useState<Note | 'new'>()
  const [deleteMode, setDeleteMode] = useState(false)
  const [q, setQ] = useState('')
  const [kind, setKind] = useState<'all' | 'note' | 'idea'>('all')
  const [project, setProject] = useState<number>()
  const [tagFilter, setTagFilter] = useState<string[]>([])
  const projects = useProjectNames()
  const notes = useLiveQuery(() => db.notes.toArray()) ?? []
  const tags = useLiveQuery(async () => (await db.tags.where('scope').equals('note').toArray()).map((t) => t.name).sort()) ?? []
  const usedProjects = [...new Set(notes.map((n) => n.projectId).filter((x): x is number => x != null))]

  const shown = notes
    .filter((n) => kind === 'all' || n.kind === kind)
    .filter((n) => project == null || n.projectId === project)
    .filter((n) => tagFilter.every((t) => n.tags.includes(t)))
    .filter((n) => matches(n.text, q))
    .sort(newestFirst)

  const remove = async (n: Note) => {
    if (!confirmDelete(n.kind === 'idea' ? 'Idee' : 'Notiz')) return
    await db.notes.delete(n.id!)
    await db.attachments.where('[ownerType+ownerId]').equals(['note', n.id!]).delete()
  }

  return (
    <div className="page">
      <TopBar title="Ideen & Notizen" onAdd={() => setEditing('new')} deleteMode={deleteMode} onToggleDelete={() => setDeleteMode(!deleteMode)} />
      <DeleteHint active={deleteMode} />
      <div className="searchbar"><SearchInput value={q} onChange={setQ} /></div>
      <div className="row" style={{ marginBottom: 10 }}>
        {(['all', 'note', 'idea'] as const).map((k) => (
          <button key={k} className={`chip ${kind === k ? 'on' : ''}`} onClick={() => setKind(k)}>{{ all: 'Alle', note: 'Notizen', idea: 'Ideen' }[k]}</button>
        ))}
        {usedProjects.length > 0 && (
          <select style={{ minHeight: 32, padding: '4px 8px', width: 'auto', marginLeft: 'auto' }} value={project ?? ''}
            onChange={(e) => setProject(e.target.value ? Number(e.target.value) : undefined)}>
            <option value="">Alle Projekte</option>
            {usedProjects.map((id) => <option key={id} value={id}>{projects.get(id)}</option>)}
          </select>
        )}
      </div>
      <TagFilter tags={tags} value={tagFilter} onChange={setTagFilter} />
      <div className="list">
        {shown.map((n) => (
          <Entry key={n.id} text={n.text} deleteMode={deleteMode} color={n.kind === 'idea' ? 'var(--mood-3)' : 'var(--blue)'}
            onClick={() => (deleteMode ? remove(n) : setEditing(n))}
            meta={<>
              <strong style={{ color: n.kind === 'idea' ? 'var(--mood-3)' : 'var(--rel-low)' }}>{n.kind === 'idea' ? 'Idee' : 'Notiz'}</strong>
              {' · '}<span className="num">{fmtDateTime(n.date, n.time)}</span>
              {n.projectId != null && ` · ${projects.get(n.projectId) ?? ''}`}
              {n.tags.length > 0 && ` · ${n.tags.map((t) => `#${t}`).join(' ')}`}
              {' '}<AttachmentBadge ownerType="note" ownerId={n.id!} />
            </>}>
            <AttachmentList ownerType="note" ownerId={n.id!} />
          </Entry>
        ))}
      </div>
      {!shown.length && <div className="empty">{notes.length ? 'Keine Treffer.' : 'Noch keine Einträge. Mit + anlegen.'}</div>}
      {editing && <NoteForm note={editing === 'new' ? undefined : editing} onClose={() => setEditing(undefined)} />}
    </div>
  )
}

export function MoodsPage() {
  const [editing, setEditing] = useState<Mood | 'new'>()
  const [deleteMode, setDeleteMode] = useState(false)
  const [q, setQ] = useState('')
  const [moodFilter, setMoodFilter] = useState<MoodLevel[]>([])
  const moods = useLiveQuery(() => db.moods.toArray()) ?? []
  const shown = moods
    .filter((m) => !moodFilter.length || moodFilter.includes(m.mood))
    .filter((m) => matches(m.text, q))
    .sort(newestFirst)

  const remove = async (m: Mood) => {
    if (!confirmDelete('Gefühlseintrag')) return
    await db.moods.delete(m.id!)
    await db.attachments.where('[ownerType+ownerId]').equals(['mood', m.id!]).delete()
  }

  return (
    <div className="page">
      <TopBar title="Gefühlsbuch" onAdd={() => setEditing('new')} deleteMode={deleteMode} onToggleDelete={() => setDeleteMode(!deleteMode)} />
      <DeleteHint active={deleteMode} />
      <Link to="/gefuehle/monat" className="btn ghost small" style={{ marginBottom: 12 }}>Monatsübersicht →</Link>
      <div className="searchbar"><SearchInput value={q} onChange={setQ} /></div>
      <div className="chips" style={{ marginBottom: 10 }}>
        {MOODS.map((m) => {
          const on = moodFilter.includes(m.value)
          return (
            <button key={m.value} className={`chip mood-${m.value}`}
              style={{ borderColor: 'var(--mood)', background: on ? 'var(--mood)' : 'transparent', color: on ? '#000' : 'var(--mood)' }}
              onClick={() => setMoodFilter(on ? moodFilter.filter((x) => x !== m.value) : [...moodFilter, m.value])}>{m.label}</button>
          )
        })}
      </div>
      <div className="list">
        {shown.map((m) => (
          <Entry key={m.id} text={m.text} deleteMode={deleteMode} color={`var(--mood-${m.mood})`}
            onClick={() => (deleteMode ? remove(m) : setEditing(m))}
            meta={<>
              <strong style={{ color: `var(--mood-${m.mood})` }}>{moodLabel(m.mood)}</strong>
              {' · '}<span className="num">{fmtDateTime(m.date, m.time)}</span>
              {' '}<AttachmentBadge ownerType="mood" ownerId={m.id!} />
            </>}>
            <AttachmentList ownerType="mood" ownerId={m.id!} />
          </Entry>
        ))}
      </div>
      {!shown.length && <div className="empty">{moods.length ? 'Keine Treffer.' : 'Noch keine Einträge. Mit + anlegen.'}</div>}
      {editing && <MoodForm mood={editing === 'new' ? undefined : editing} onClose={() => setEditing(undefined)} />}
    </div>
  )
}

export function MoodMonth() {
  const navigate = useNavigate()
  const today = todayKey()
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const swipe = useSwipe(() => setMonth((m) => addMonths(m, -1)), () => setMonth((m) => addMonths(m, 1)))
  const grid = monthGrid(month)
  const days = grid.filter((d): d is string => !!d)
  const moods = useLiveQuery(() => db.moods.where('date').between(days[0], days[days.length - 1], true, true).toArray(), [days[0]]) ?? []
  const counts = MOODS.map((m) => ({ ...m, n: moods.filter((x) => x.mood === m.value).length }))

  return (
    <div className="page">
      <TopBar title="Stimmungen im Monat" />
      <MonthNav month={month} onChange={setMonth} />
      <div {...swipe} style={{ touchAction: 'pan-y' }}>
        <div className="cal-head">{WEEKDAYS.map((w) => <div key={w}>{w}</div>)}</div>
        <div className="cal-grid">
          {grid.map((d, i) => {
            if (!d) return <div key={`b${i}`} className="cal-cell blank" />
            const dayMoods = moods.filter((m) => m.date === d).sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''))
            return (
              <button key={d} className={`cal-cell ${d === today ? 'today' : ''}`} style={{ minHeight: 54 }} onClick={() => navigate(`/tag/${d}`)}>
                <span className="d num">{Number(d.slice(8))}</span>
                <span style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                  {dayMoods.map((m) => <span key={m.id} className="dot" style={{ background: `var(--mood-${m.mood})` }} title={moodLabel(m.mood)} />)}
                </span>
              </button>
            )
          })}
        </div>
      </div>
      <div className="card" style={{ marginTop: 14 }}>
        {counts.map((c) => (
          <div key={c.value} className="row small" style={{ padding: '3px 0' }}>
            <span className="dot" style={{ background: `var(--mood-${c.value})` }} />
            <span className="grow">{c.label}</span>
            <span className="num">{c.n}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function DreamsPage() {
  const [editing, setEditing] = useState<Dream | 'new'>()
  const [deleteMode, setDeleteMode] = useState(false)
  const [q, setQ] = useState('')
  const [tagFilter, setTagFilter] = useState<string[]>([])
  const dreams = useLiveQuery(() => db.dreams.toArray()) ?? []
  const tags = useLiveQuery(async () => (await db.tags.where('scope').equals('dream').toArray()).map((t) => t.name).sort()) ?? []
  const shown = dreams
    .filter((d) => tagFilter.every((t) => d.tags.includes(t)))
    .filter((d) => matches(d.text, q))
    .sort(newestFirst)

  const remove = async (d: Dream) => {
    if (!confirmDelete('Traum')) return
    await db.dreams.delete(d.id!)
    await db.attachments.where('[ownerType+ownerId]').equals(['dream', d.id!]).delete()
  }

  return (
    <div className="page">
      <TopBar title="Traumbuch" onAdd={() => setEditing('new')} deleteMode={deleteMode} onToggleDelete={() => setDeleteMode(!deleteMode)} />
      <DeleteHint active={deleteMode} />
      <div className="searchbar"><SearchInput value={q} onChange={setQ} /></div>
      <TagFilter tags={tags} value={tagFilter} onChange={setTagFilter} />
      <div className="list">
        {shown.map((d) => (
          <Entry key={d.id} text={d.text} deleteMode={deleteMode} color="var(--violet)"
            onClick={() => (deleteMode ? remove(d) : setEditing(d))}
            meta={<>
              <span className="num">{fmtDateTime(d.date, d.time)}</span>
              {d.tags.length > 0 && ` · ${d.tags.map((t) => `#${t}`).join(' ')}`}
              {' '}<AttachmentBadge ownerType="dream" ownerId={d.id!} />
            </>}>
            <AttachmentList ownerType="dream" ownerId={d.id!} />
          </Entry>
        ))}
      </div>
      {!shown.length && <div className="empty">{dreams.length ? 'Keine Treffer.' : 'Noch keine Träume. Mit + anlegen.'}</div>}
      {editing && <DreamForm dream={editing === 'new' ? undefined : editing} onClose={() => setEditing(undefined)} />}
    </div>
  )
}
