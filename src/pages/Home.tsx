import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, setTodoDone, type Activity, type Todo } from '../db'
import { fmtDayMonth, fmtLong, fmtWeekdayShort, shiftKey, todayKey } from '../lib/date'
import { useSwipe } from '../components/ui'
import { IconSettings } from '../components/Icons'
import { TodoForm } from '../forms/TodoForm'
import { ActivityForm } from '../forms/ActivityForm'
import { DreamForm, MoodForm, NoteForm } from '../forms/JournalForms'

type QuickType = 'todo' | 'activity' | 'note' | 'idea' | 'dream' | 'mood'

const QUICK: { type: QuickType; label: string; path: string }[] = [
  { type: 'todo', label: 'To-Do', path: '/todos' },
  { type: 'activity', label: 'Aktivität', path: '/aktivitaeten' },
  { type: 'note', label: 'Notiz', path: '/notizen' },
  { type: 'idea', label: 'Idee', path: '/notizen' },
  { type: 'dream', label: 'Traum', path: '/traeume' },
  { type: 'mood', label: 'Gefühl', path: '/gefuehle' },
]

type ColumnItem =
  | { kind: 'todo'; time?: string; item: Todo }
  | { kind: 'activity'; time?: string; item: Activity }

function byTime(a: ColumnItem, b: ColumnItem) {
  if (a.time && b.time) return a.time.localeCompare(b.time)
  if (a.time) return -1
  if (b.time) return 1
  return 0
}

export default function Home() {
  const navigate = useNavigate()
  const today = todayKey()
  const [text, setText] = useState('')
  const [form, setForm] = useState<QuickType>()
  const [offset, setOffset] = useState(0)
  const days = [0, 1, 2].map((i) => shiftKey(today, offset + i))
  const swipe = useSwipe(() => setOffset((o) => o - 3), () => setOffset((o) => o + 3))

  const columns = useLiveQuery(async () => {
    const [todos, activities] = await Promise.all([
      db.todos.where('date').between(days[0], days[2], true, true).toArray(),
      db.activities.where('date').between(days[0], days[2], true, true).toArray(),
    ])
    return days.map((d) =>
      [
        ...todos.filter((t) => t.date === d).map((t): ColumnItem => ({ kind: 'todo', time: t.time, item: t })),
        ...activities.filter((a) => a.date === d && !todos.some((t) => t.id === a.fromTodoId)).map((a): ColumnItem => ({ kind: 'activity', time: a.timeFrom, item: a })),
      ].sort(byTime),
    )
  }, [days[0]]) ?? [[], [], []]

  const quick = (q: (typeof QUICK)[number]) => {
    if (text.trim()) setForm(q.type)
    else navigate(q.path)
  }
  const closeForm = (saved?: boolean) => {
    if (saved) setText('')
    setForm(undefined)
  }

  const toggle = (c: ColumnItem) => {
    if (c.kind === 'todo') setTodoDone(c.item, !c.item.done, today)
    else db.activities.update(c.item.id!, { done: !c.item.done })
  }

  const colTitle = (d: string, i: number) => {
    if (offset === 0) return ['Heute', `Morgen ${fmtDayMonth(d)}`, `Übermorgen ${fmtDayMonth(d)}`][i]
    if (d === today) return 'Heute'
    return `${fmtWeekdayShort(d)} ${fmtDayMonth(d)}`
  }

  return (
    <div className="page">
      <header className="home-head">
        <div className="score">
          <div><span className="num">0</span> <span className="muted small">km</span></div>
          <div><span className="num">0</span> <span className="muted small">Credits</span></div>
        </div>
        <Link to="/einstellungen" className="icon-btn" aria-label="Einstellungen"><IconSettings /></Link>
      </header>

      <div className="home-nav">
        <Link to="/habits" className="btn">Habits</Link>
        <Link to="/abstinenz" className="btn">Abstinenz</Link>
        <Link to="/projekte" className="btn">Projekte</Link>
      </div>

      <textarea className="quick-text" placeholder="Was liegt an? Text eingeben und unten zuordnen …"
        value={text} onChange={(e) => setText(e.target.value)} />

      <div className="quick-grid">
        {QUICK.map((q) => (
          <button key={q.type} className={`btn ${text.trim() ? 'primary' : ''}`} onClick={() => quick(q)}>{q.label}</button>
        ))}
        <button className="btn" disabled title="Folgt später">Finanzen</button>
      </div>

      <Link to="/kalender" className="date-banner">
        <span className="num">{fmtLong(today)}</span>
      </Link>

      <div className="columns" {...swipe}>
        {days.map((d, i) => (
          <div key={d} className={`column ${d === today ? 'is-today' : ''}`}>
            <Link to={`/tag/${d}`} className="column-title">{colTitle(d, i)}</Link>
            {columns[i].length === 0 && <div className="tiny" style={{ color: 'var(--faint)' }}>—</div>}
            {columns[i].map((c) => (
              <button key={`${c.kind}${c.item.id}`} onClick={() => toggle(c)}
                className={`col-item ${c.kind === 'todo' ? `rel-${c.item.relevance}` : 'is-activity'} ${c.item.done ? 'done-text' : ''}`}>
                {c.time && <span className="num col-time">{c.time}</span>}
                {c.kind === 'todo' && c.item.isAppointment && <span aria-label="Termin">◆ </span>}
                {c.item.title}
              </button>
            ))}
          </div>
        ))}
      </div>
      <div className="row tiny muted" style={{ justifyContent: 'space-between', marginTop: 6 }}>
        <span>Nach rechts wischen: zurückblättern</span>
        {offset !== 0 && <button className="chip" onClick={() => setOffset(0)}>Heute</button>}
      </div>

      {form === 'todo' && <TodoForm initial={{ title: text.trim() }} onClose={closeForm} />}
      {form === 'activity' && <ActivityForm initial={{ title: text.trim() }} onClose={closeForm} />}
      {(form === 'note' || form === 'idea') && <NoteForm initial={{ text: text.trim(), kind: form }} onClose={closeForm} />}
      {form === 'dream' && <DreamForm initial={{ text: text.trim() }} onClose={closeForm} />}
      {form === 'mood' && <MoodForm initial={{ text: text.trim() }} onClose={closeForm} />}
    </div>
  )
}
