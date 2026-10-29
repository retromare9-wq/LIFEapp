import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Habit } from '../db'
import { WEEKDAYS, addMonths, fmtShort, monthGrid, todayKey, weekKeys } from '../lib/date'
import { currentStreak } from '../lib/stats'
import { weekId } from '../lib/rewards'
import { DONE_GREEN } from '../lib/colors'
import { DeleteHint, Sheet, TopBar, confirmDelete, useSwipe } from '../components/ui'
import { IconCheck } from '../components/Icons'
import { MonthNav } from './Calendar'

async function toggleHabit(habitId: number, date: string) {
  const existing = await db.habitLogs.where('[habitId+date]').equals([habitId, date]).first()
  if (existing) await db.habitLogs.delete(existing.id!)
  else await db.habitLogs.add({ habitId, date })
}

/** Weeks (ISO) in which the weekly target was reached. */
function reachedWeeks(dates: Set<string>, target: number) {
  const perWeek = new Map<string, number>()
  dates.forEach((d) => perWeek.set(weekId(d), (perWeek.get(weekId(d)) ?? 0) + 1))
  return new Set([...perWeek].filter(([, n]) => n >= target).map(([w]) => w))
}

function HabitSheet({ habit, onClose }: { habit?: Habit; onClose: () => void }) {
  const [name, setName] = useState(habit?.name ?? '')
  const [description, setDescription] = useState(habit?.description ?? '')
  const [target, setTarget] = useState(habit?.weeklyTarget ?? 7)
  const save = async () => {
    if (!name.trim()) return
    const data = { name: name.trim(), description: description.trim() || undefined, weeklyTarget: target }
    if (habit) await db.habits.update(habit.id!, data)
    else await db.habits.add({ ...data, createdAt: todayKey(), order: Date.now() })
    onClose()
  }
  return (
    <Sheet title={habit ? 'Habit bearbeiten' : 'Neues Habit'} onClose={onClose}>
      <div className="stack">
        <label className="field">
          Bezeichnung
          <input type="text" autoFocus={!habit} value={name} placeholder="z. B. Zahnseide benutzt" onChange={(e) => setName(e.target.value)} />
        </label>
        <div className="field" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="small muted">Ziel pro Woche</span>
          <div className="row" style={{ gap: 6 }}>
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <button key={n} type="button" className={`btn small grow ${target === n ? 'primary' : ''}`} style={{ padding: 0 }} onClick={() => setTarget(n)}>{n}×</button>
            ))}
          </div>
        </div>
        <label className="field">
          Beschreibung – warum ist dieses Habit sinnvoll? (optional)
          <textarea style={{ minHeight: 110 }} value={description} onChange={(e) => setDescription(e.target.value)} />
        </label>
      </div>
      <div className="sheet-actions">
        <button className="btn ghost" onClick={onClose}>Abbrechen</button>
        <button className="btn primary" onClick={save} disabled={!name.trim()}>Speichern</button>
      </div>
    </Sheet>
  )
}

export function HabitList() {
  const navigate = useNavigate()
  const today = todayKey()
  const week = weekKeys(today)
  const [adding, setAdding] = useState(false)
  const [deleteMode, setDeleteMode] = useState(false)
  const data = useLiveQuery(async () => {
    const [habits, logs] = await Promise.all([db.habits.orderBy('order').toArray(), db.habitLogs.toArray()])
    const byHabit = new Map<number, Set<string>>()
    logs.forEach((l) => {
      if (!byHabit.has(l.habitId)) byHabit.set(l.habitId, new Set())
      byHabit.get(l.habitId)!.add(l.date)
    })
    return { habits, byHabit }
  }) ?? { habits: [], byHabit: new Map<number, Set<string>>() }

  const remove = async (h: Habit) => {
    if (!confirmDelete(h.name)) return
    await db.habitLogs.where('habitId').equals(h.id!).delete()
    await db.habits.delete(h.id!)
  }

  return (
    <div className="page">
      <TopBar title="Habits" onAdd={() => setAdding(true)} deleteMode={deleteMode} onToggleDelete={() => setDeleteMode(!deleteMode)} />
      <DeleteHint active={deleteMode} />
      {data.habits.length > 0 && (
        <div className="habit-row habit-head">
          <span />
          <div className="habit-week">{WEEKDAYS.map((w, i) => <span key={w} className={week[i] === today ? 'is-today' : ''}>{w[0]}</span>)}</div>
          <span className="tiny muted" style={{ width: 46, textAlign: 'center' }}>heute</span>
        </div>
      )}
      <div className="list">
        {data.habits.map((h) => {
          const dates = data.byHabit.get(h.id!) ?? new Set<string>()
          const doneToday = dates.has(today)
          const target = h.weeklyTarget || 7
          const thisWeek = week.filter((d) => dates.has(d)).length
          const reached = thisWeek >= target
          return (
            <div key={h.id} className={`item habit-row ${deleteMode ? 'deletable' : ''}`}
              onClick={() => (deleteMode ? remove(h) : navigate(`/habits/${h.id}`))} role="button">
              <div style={{ minWidth: 0 }}>
                <div className="title" style={{ wordBreak: 'break-word' }}>{h.name}</div>
                <div className="row tiny muted" style={{ gap: 6, marginTop: 2, flexWrap: 'wrap' }}>
                  <span className="num">{fmtShort(h.createdAt)}</span>
                  <span className="habit-box num" title="gesamt / aktueller Streak">{dates.size} | {currentStreak(dates, today)}</span>
                  <span className="num" style={{ color: reached ? DONE_GREEN : undefined }}>{thisWeek}/{target}</span>
                </div>
              </div>
              <div className="habit-week">
                {week.map((d) => (
                  <button key={d} aria-label={d} disabled={d > today || deleteMode}
                    className={`circle small-circle ${dates.has(d) ? 'on' : ''} ${d > today ? 'future' : ''} ${d === today ? 'today' : ''}`}
                    style={dates.has(d) && reached ? { background: DONE_GREEN, borderColor: DONE_GREEN } : undefined}
                    onClick={(e) => { e.stopPropagation(); toggleHabit(h.id!, d) }} />
                ))}
              </div>
              <button className={`circle-big ${doneToday ? 'on' : ''}`} aria-label="Heute erfüllt" aria-pressed={doneToday} disabled={deleteMode}
                onClick={(e) => { e.stopPropagation(); toggleHabit(h.id!, today) }}>
                {doneToday && <IconCheck />}
              </button>
            </div>
          )
        })}
      </div>
      {!data.habits.length && <div className="empty">Noch keine Habits. Mit + anlegen.</div>}
      {adding && <HabitSheet onClose={() => setAdding(false)} />}
    </div>
  )
}

export function HabitDetail() {
  const { id } = useParams()
  const habitId = Number(id)
  const today = todayKey()
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const [editing, setEditing] = useState(false)
  const swipe = useSwipe(() => setMonth((m) => addMonths(m, -1)), () => setMonth((m) => addMonths(m, 1)))
  const habit = useLiveQuery(() => db.habits.get(habitId), [habitId])
  const dates = useLiveQuery(async () => new Set((await db.habitLogs.where('habitId').equals(habitId).toArray()).map((l) => l.date)), [habitId]) ?? new Set<string>()

  if (!habit) return <div className="page"><TopBar title="Habit" /></div>
  const monthPrefix = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`
  const inMonth = [...dates].filter((d) => d.startsWith(monthPrefix)).length
  const target = habit.weeklyTarget || 7
  const reached = reachedWeeks(dates, target)

  return (
    <div className="page">
      <TopBar title={habit.name}>
        <button className="btn small ghost" onClick={() => setEditing(true)}>Bearbeiten</button>
      </TopBar>
      <div className="row" style={{ gap: 8, marginBottom: 14 }}>
        <div className="card grow"><div className="tiny muted">Gesamt</div><div className="num" style={{ fontSize: 22 }}>{dates.size}</div></div>
        <div className="card grow"><div className="tiny muted">Streak</div><div className="num" style={{ fontSize: 22 }}>{currentStreak(dates, today)}</div></div>
        <div className="card grow"><div className="tiny muted">Monat</div><div className="num" style={{ fontSize: 22 }}>{inMonth}</div></div>
        <div className="card grow"><div className="tiny muted">Ziel</div><div className="num" style={{ fontSize: 22 }}>{target}×</div></div>
      </div>
      {habit.description && <div className="card pre" style={{ marginBottom: 14 }}>{habit.description}</div>}
      <MonthNav month={month} onChange={setMonth} />
      <div {...swipe} style={{ touchAction: 'pan-y' }}>
        <div className="cal-head">{WEEKDAYS.map((w) => <div key={w}>{w}</div>)}</div>
        <div className="cal-grid">
          {monthGrid(month).map((d, i) =>
            d ? (
              <button key={d} disabled={d > today}
                className={`cal-cell cal-mini num ${dates.has(d) ? 'filled' : ''} ${d === today ? 'today' : ''}`}
                style={{
                  opacity: d > today ? 0.35 : 1,
                  ...(dates.has(d) && reached.has(weekId(d)) ? { background: DONE_GREEN, borderColor: DONE_GREEN, color: '#000' } : {}),
                }}
                onClick={() => toggleHabit(habitId, d)}>
                {Number(d.slice(8))}
              </button>
            ) : <div key={`b${i}`} className="cal-cell blank" />,
          )}
        </div>
      </div>
      <p className="tiny muted" style={{ marginTop: 10 }}>
        Eingetragen am {fmtShort(habit.createdAt)}. Grün = Wochenziel erreicht. Tag antippen zum Nachtragen/Entfernen. Nach rechts wischen: vorheriger Monat.
      </p>
      {editing && <HabitSheet habit={habit} onClose={() => setEditing(false)} />}
    </div>
  )
}
