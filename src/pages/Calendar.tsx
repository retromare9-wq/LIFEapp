import { useState, type ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Activity, type Todo } from '../db'
import { WEEKDAYS, addMonths, fmtDuration, fmtLong, fmtMonthYear, fmtWeekday, monthDayKeys, monthGrid, shiftKey, todayKey } from '../lib/date'
import { activeSubstances, logKey } from '../lib/stats'
import { useDaySheetConfig } from '../lib/settings'
import { KIND_MARK, coversDay, doneStyle, timeOnDay, todoColor } from '../lib/todo'
import { Sheet, TopBar, useSwipe } from '../components/ui'
import { IconCalendar, IconChevronLeft, IconChevronRight, IconPlus, SubstanceGlyph } from '../components/Icons'
import { moodLabel } from '../forms/JournalForms'
import { TodoForm } from '../forms/TodoForm'
import { ActivityForm } from '../forms/ActivityForm'
import { ActivityItem } from './Activities'
import { TodoItem } from './Todos'

export function MonthNav({ month, onChange }: { month: Date; onChange: (d: Date) => void }) {
  return (
    <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
      <button className="icon-btn" aria-label="Vorheriger Monat" onClick={() => onChange(addMonths(month, -1))}><IconChevronLeft /></button>
      <strong style={{ textTransform: 'capitalize' }}>{fmtMonthYear(month)}</strong>
      <button className="icon-btn" aria-label="Nächster Monat" onClick={() => onChange(addMonths(month, 1))}><IconChevronRight /></button>
    </div>
  )
}

/** All dated to-dos that touch the range [first, last] (multi-day events included). */
const todosInRange = (first: string, last: string) =>
  db.todos.where('date').belowOrEqual(last).filter((t) => {
    for (let d = first; d <= last; d = shiftKey(d, 1)) if (coversDay(t, d)) return true
    return false
  }).toArray()

export function CalendarMonth() {
  const navigate = useNavigate()
  const today = todayKey()
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const swipe = useSwipe(() => setMonth((m) => addMonths(m, -1)), () => setMonth((m) => addMonths(m, 1)))
  const keys = monthDayKeys(month)
  const first = keys[0]
  const last = keys[keys.length - 1]

  const data = useLiveQuery(async () => {
    const [todos, substances, logs] = await Promise.all([
      todosInRange(first, last),
      db.substances.orderBy('order').toArray(),
      db.abstinenceLogs.where('date').between(first, last, true, true).toArray(),
    ])
    return { appts: todos, substances, logs: new Set(logs.map((l) => logKey(l.substanceId, l.date))) }
  }, [first])

  return (
    <div className="page">
      <TopBar title="Kalender" />
      <MonthNav month={month} onChange={setMonth} />
      <div {...swipe} style={{ touchAction: 'pan-y' }}>
        <div className="cal-head">{WEEKDAYS.map((w) => <div key={w}>{w}</div>)}</div>
        <div className="cal-grid">
          {monthGrid(month).map((d, i) => {
            if (!d) return <div key={`b${i}`} className="cal-cell blank" />
            // Appointments and events first, then to-dos; each by time.
            const appts = (data?.appts ?? []).filter((t) => coversDay(t, d)).sort((a, b) =>
              Number(a.kind === 'todo') - Number(b.kind === 'todo') || (timeOnDay(a, d) ?? '99').localeCompare(timeOnDay(b, d) ?? '99'))
            const abstinent = d <= today
              ? activeSubstances(data?.substances ?? [], d).filter((s) => data?.logs.has(logKey(s.id!, d)))
              : []
            return (
              <button key={d} className={`cal-cell ${d === today ? 'today' : ''}`} onClick={() => navigate(`/tag/${d}`)}>
                <span className="d num">{Number(d.slice(8))}</span>
                {appts.slice(0, 4).map((t) => {
                  const done = doneStyle(t)
                  return (
                    <span key={t.id} className={`appt ${done.className}`} style={{ color: todoColor(t), ...done.style }}>
                      {KIND_MARK[t.kind]}{t.title}
                    </span>
                  )
                })}
                {appts.length > 4 && <span className="appt muted">+{appts.length - 4}</span>}
                {abstinent.length > 0 && (
                  <span className="icons">
                    {abstinent.map((s) => <SubstanceGlyph key={s.id} icon={s.icon} size={13} />)}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
      <p className="tiny muted" style={{ marginTop: 10 }}>◆ Termin · ▰ Event · ohne Zeichen: To-Do. Nach rechts wischen: vorheriger Monat. Tag antippen: Tagesblatt.</p>
    </div>
  )
}

function Line({ label, value, ok }: { label: string; value: ReactNode; ok?: boolean }) {
  return (
    <div className="row" style={{ justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
      <span className="muted">{label}</span>
      <strong style={{ color: ok === undefined ? undefined : ok ? 'var(--mood-5)' : 'var(--faint)' }}>{value}</strong>
    </div>
  )
}

export function DaySheet() {
  const { date = todayKey() } = useParams()
  const navigate = useNavigate()
  const today = todayKey()
  const cfg = useDaySheetConfig()
  const [adding, setAdding] = useState<'choose' | 'todo' | 'activity'>()
  const [editTodo, setEditTodo] = useState<Todo>()
  const [editActivity, setEditActivity] = useState<Activity>()
  const go = (days: number) => navigate(`/tag/${shiftKey(date, days)}`, { replace: true })
  const swipe = useSwipe(() => go(-1), () => go(1))

  const data = useLiveQuery(async () => {
    const [todos, activities, habitLogs, habits, substances, absLogs, moods, dreams, notes, reading] = await Promise.all([
      todosInRange(date, date),
      db.activities.where('date').equals(date).toArray(),
      db.habitLogs.where('date').equals(date).toArray(),
      db.habits.count(),
      db.substances.orderBy('order').toArray(),
      db.abstinenceLogs.where('date').equals(date).toArray(),
      db.moods.where('date').equals(date).toArray(),
      db.dreams.where('date').equals(date).count(),
      db.notes.where('date').equals(date).toArray(),
      db.readingLogs.where('date').equals(date).toArray(),
    ])
    const sortT = (a: Todo, b: Todo) => (timeOnDay(a, date) ?? '99').localeCompare(timeOnDay(b, date) ?? '99')
    return {
      todos: todos.filter((t) => t.kind === 'todo').sort(sortT),
      appts: todos.filter((t) => t.kind !== 'todo').sort(sortT),
      activities: activities.sort((a, b) => (a.timeFrom ?? '99').localeCompare(b.timeFrom ?? '99')),
      habitsDone: habitLogs.length, habits,
      substances: activeSubstances(substances, date),
      absLogs: new Set(absLogs.map((l) => l.substanceId)),
      moods: moods.sort((a, b) => (a.time ?? '').localeCompare(b.time ?? '')),
      dreams, notes,
      pages: reading.reduce((s, l) => s + (l.pages || 0), 0),
    }
  }, [date])

  if (!data) return <div className="page"><TopBar title={fmtLong(date)} /></div>
  const counted = date <= today ? data.activities : []
  const totalMinutes = counted.reduce((s, a) => s + (a.durationMinutes ?? 0), 0)

  return (
    <div className="page" {...swipe}>
      <TopBar title={fmtLong(date)} onAdd={() => setAdding('choose')}>
        <button className="icon-btn" aria-label="Monat" onClick={() => navigate('/kalender')}><IconCalendar /></button>
      </TopBar>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
        <span className="muted" style={{ textTransform: 'capitalize' }}>{fmtWeekday(date)}{date === today ? ' · heute' : ''}</span>
        <div className="row" style={{ gap: 6 }}>
          <button className="icon-btn" aria-label="Vortag" onClick={() => go(-1)}><IconChevronLeft /></button>
          <button className="icon-btn" aria-label="Folgetag" onClick={() => go(1)}><IconChevronRight /></button>
        </div>
      </div>

      {cfg.appointments && (
        <>
          <div className="section-title">Termine & Events</div>
          {data.appts.length ? <div className="list">{data.appts.map((t) => <TodoItem key={t.id} t={t} onEdit={() => setEditTodo(t)} />)}</div> : <div className="small muted">Keine Termine</div>}
        </>
      )}
      {cfg.todos && (
        <>
          <div className="section-title">To-Dos</div>
          {data.todos.length ? <div className="list">{data.todos.map((t) => <TodoItem key={t.id} t={t} onEdit={() => setEditTodo(t)} />)}</div> : <div className="small muted">Keine To-Dos</div>}
        </>
      )}

      <div className="section-title">Überblick</div>
      <div className="card" style={{ padding: '2px 14px' }}>
        {cfg.activities && <Line label="Aktivitäten" value={<span className="num">{counted.length}{totalMinutes ? ` · ${fmtDuration(totalMinutes)}` : ''}</span>} />}
        {cfg.habits && <Line label="Erfüllte Habits" value={<span className="num">{data.habitsDone} / {data.habits}</span>} />}
        {cfg.abstinence && data.substances.map((s) => {
          const ok = data.absLogs.has(s.id!)
          return <Line key={s.id} label={`Frei von ${s.name}`} value={ok ? 'ja' : date <= today ? 'nein' : '—'} ok={ok} />
        })}
        {cfg.mood && (
          <Line label="Gefühlsbuch" ok={data.moods.length > 0} value={data.moods.length ? (
            <span className="row" style={{ gap: 6 }}>
              ja
              {data.moods.map((m) => <span key={m.id} className="dot" style={{ width: 14, height: 14, background: `var(--mood-${m.mood})` }} title={moodLabel(m.mood)} />)}
            </span>
          ) : 'nein'} />
        )}
        {cfg.dream && <Line label="Traumbuch" value={data.dreams ? 'ja' : 'nein'} ok={data.dreams > 0} />}
        {cfg.reading && <Line label="Gelesene Seiten" value={<span className="num">{data.pages}</span>} />}
        {cfg.money && <Line label="Geld ausgegeben" value={<span className="muted">Finanzbuch folgt</span>} />}
      </div>

      {cfg.activityList && data.activities.length > 0 && (
        <>
          <div className="section-title">Aktivitäten</div>
          <div className="list">{data.activities.map((a) => <ActivityItem key={a.id} a={a} onEdit={() => setEditActivity(a)} />)}</div>
        </>
      )}
      {cfg.notes && data.notes.length > 0 && (
        <>
          <div className="section-title">Ideen & Notizen</div>
          <div className="list">
            {data.notes.map((n) => (
              <div key={n.id} className="item"><div className="grow"><div className="meta">{n.kind === 'idea' ? 'Idee' : 'Notiz'}</div><div className="clamp pre">{n.text}</div></div></div>
            ))}
          </div>
        </>
      )}
      <p className="tiny muted" style={{ marginTop: 16 }}>Erledigen geht in der To-Do-Liste. Angezeigte Infos lassen sich in den Einstellungen anpassen.</p>

      {adding === 'choose' && (
        <Sheet title={`Für ${fmtLong(date)} hinzufügen`} onClose={() => setAdding(undefined)}>
          <div className="stack">
            <button className="btn" onClick={() => setAdding('todo')}><IconPlus /> To-Do / Termin / Event</button>
            <button className="btn" onClick={() => setAdding('activity')}><IconPlus /> Aktivität</button>
          </div>
        </Sheet>
      )}
      {adding === 'todo' && <TodoForm initial={{ date }} onClose={() => setAdding(undefined)} />}
      {adding === 'activity' && <ActivityForm initial={{ date }} onClose={() => setAdding(undefined)} />}
      {editTodo && <TodoForm todo={editTodo} onClose={() => setEditTodo(undefined)} />}
      {editActivity && <ActivityForm activity={editActivity} onClose={() => setEditActivity(undefined)} />}
    </div>
  )
}
