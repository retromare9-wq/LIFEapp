import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, setTodoDone } from '../db'
import { WEEKDAYS, addMonths, fmtLong, fmtMonthYear, fmtWeekday, monthDayKeys, monthGrid, shiftKey, todayKey } from '../lib/date'
import { activeSubstances, logKey } from '../lib/stats'
import { useDaySheetConfig } from '../lib/settings'
import { Checkbox, TopBar, useSwipe } from '../components/ui'
import { IconCalendar, IconChevronLeft, IconChevronRight, SubstanceGlyph } from '../components/Icons'
import { moodLabel } from '../forms/JournalForms'

export function MonthNav({ month, onChange }: { month: Date; onChange: (d: Date) => void }) {
  return (
    <div className="row" style={{ justifyContent: 'space-between', marginBottom: 10 }}>
      <button className="icon-btn" aria-label="Vorheriger Monat" onClick={() => onChange(addMonths(month, -1))}><IconChevronLeft /></button>
      <strong style={{ textTransform: 'capitalize' }}>{fmtMonthYear(month)}</strong>
      <button className="icon-btn" aria-label="Nächster Monat" onClick={() => onChange(addMonths(month, 1))}><IconChevronRight /></button>
    </div>
  )
}

export function CalendarMonth() {
  const navigate = useNavigate()
  const today = todayKey()
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const swipe = useSwipe(() => setMonth((m) => addMonths(m, -1)), () => setMonth((m) => addMonths(m, 1)))
  const keys = monthDayKeys(month)
  const first = keys[0]
  const last = keys[keys.length - 1]

  const data = useLiveQuery(async () => {
    const [appts, substances, logs] = await Promise.all([
      db.todos.where('date').between(first, last, true, true).filter((t) => t.isAppointment).toArray(),
      db.substances.orderBy('order').toArray(),
      db.abstinenceLogs.where('date').between(first, last, true, true).toArray(),
    ])
    return { appts, substances, logs: new Set(logs.map((l) => logKey(l.substanceId, l.date))) }
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
            const appts = (data?.appts ?? []).filter((t) => t.date === d).sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''))
            const abstinent = d <= today
              ? activeSubstances(data?.substances ?? [], d).filter((s) => data?.logs.has(logKey(s.id!, d)))
              : []
            return (
              <button key={d} className={`cal-cell ${d === today ? 'today' : ''}`} onClick={() => navigate(`/tag/${d}`)}>
                <span className="d num">{Number(d.slice(8))}</span>
                {appts.slice(0, 3).map((t) => (
                  <span key={t.id} className={`appt rel-${t.relevance} ${t.done ? 'done-text' : ''}`}>
                    {t.time ? `${t.time} ` : ''}{t.title}
                  </span>
                ))}
                {appts.length > 3 && <span className="appt muted">+{appts.length - 3}</span>}
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
      <p className="tiny muted" style={{ marginTop: 10 }}>Nach rechts wischen: vorheriger Monat. Tag antippen: Tagesblatt.</p>
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
  const swipe = useSwipe(() => navigate(`/tag/${shiftKey(date, -1)}`, { replace: true }), () => navigate(`/tag/${shiftKey(date, 1)}`, { replace: true }))

  const data = useLiveQuery(async () => {
    const [todos, activities, habitLogs, habits, substances, absLogs, moods, dreams, notes] = await Promise.all([
      db.todos.where('date').equals(date).toArray(),
      db.activities.where('date').equals(date).toArray(),
      db.habitLogs.where('date').equals(date).toArray(),
      db.habits.count(),
      db.substances.orderBy('order').toArray(),
      db.abstinenceLogs.where('date').equals(date).toArray(),
      db.moods.where('date').equals(date).toArray(),
      db.dreams.where('date').equals(date).count(),
      db.notes.where('date').equals(date).toArray(),
    ])
    const sortT = (a: { time?: string }, b: { time?: string }) => (a.time ?? '99').localeCompare(b.time ?? '99')
    return {
      todos: todos.filter((t) => !t.isAppointment).sort(sortT),
      appts: todos.filter((t) => t.isAppointment).sort(sortT),
      activities, habitsDone: habitLogs.length, habits,
      substances: activeSubstances(substances, date),
      absLogs: new Set(absLogs.map((l) => l.substanceId)),
      moods, dreams, notes,
    }
  }, [date])

  if (!data) return <div className="page"><TopBar title={fmtLong(date)} /></div>

  const TodoRow = ({ t }: { t: (typeof data.todos)[number] }) => (
    <div className={`item rel-${t.relevance}`}>
      <span className="stripe rel-bg" />
      <div className="grow">
        <div className={`title ${t.done ? 'done-text' : ''}`}>{t.title}</div>
        {t.time && <div className="meta num">{t.time}</div>}
      </div>
      <Checkbox on={t.done} onChange={() => setTodoDone(t, !t.done, today)} />
    </div>
  )

  return (
    <div className="page" {...swipe}>
      <TopBar title={fmtLong(date)}>
        <Link to="/kalender" className="icon-btn" aria-label="Monat"><IconCalendar /></Link>
      </TopBar>
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
        <span className="muted" style={{ textTransform: 'capitalize' }}>{fmtWeekday(date)}{date === today ? ' · heute' : ''}</span>
        <div className="row" style={{ gap: 6 }}>
          <button className="icon-btn" aria-label="Vortag" onClick={() => navigate(`/tag/${shiftKey(date, -1)}`, { replace: true })}><IconChevronLeft /></button>
          <button className="icon-btn" aria-label="Folgetag" onClick={() => navigate(`/tag/${shiftKey(date, 1)}`, { replace: true })}><IconChevronRight /></button>
        </div>
      </div>

      {cfg.appointments && (
        <>
          <div className="section-title">Termine</div>
          {data.appts.length ? <div className="list">{data.appts.map((t) => <TodoRow key={t.id} t={t} />)}</div> : <div className="small muted">Keine Termine</div>}
        </>
      )}
      {cfg.todos && (
        <>
          <div className="section-title">To-Dos</div>
          {data.todos.length ? <div className="list">{data.todos.map((t) => <TodoRow key={t.id} t={t} />)}</div> : <div className="small muted">Keine To-Dos</div>}
        </>
      )}

      <div className="section-title">Überblick</div>
      <div className="card" style={{ padding: '2px 14px' }}>
        {cfg.activities && <Line label="Aktivitäten" value={<span className="num">{data.activities.filter((a) => a.done).length}</span>} />}
        {cfg.habits && <Line label="Erfüllte Habits" value={<span className="num">{data.habitsDone} / {data.habits}</span>} />}
        {cfg.abstinence && data.substances.map((s) => {
          const ok = data.absLogs.has(s.id!)
          return <Line key={s.id} label={`Frei von ${s.name}`} value={ok ? 'ja' : date <= today ? 'nein' : '—'} ok={ok} />
        })}
        {cfg.mood && <Line label="Gefühlsbuch" value={data.moods.length ? `ja (${data.moods.map((m) => moodLabel(m.mood)).join(', ')})` : 'nein'} ok={data.moods.length > 0} />}
        {cfg.dream && <Line label="Traumbuch" value={data.dreams ? 'ja' : 'nein'} ok={data.dreams > 0} />}
        {cfg.money && <Line label="Geld ausgegeben" value={<span className="muted">Finanzbuch folgt</span>} />}
      </div>

      {cfg.activityList && data.activities.length > 0 && (
        <>
          <div className="section-title">Aktivitäten</div>
          <div className="list">
            {data.activities.map((a) => (
              <div key={a.id} className="item">
                <div className="grow">
                  <div className={`title ${a.done ? '' : 'muted'}`}>{a.title}</div>
                  <div className="meta num">{[a.timeFrom, a.timeTo].filter(Boolean).join('–')}{a.done ? '' : ' geplant'}</div>
                </div>
              </div>
            ))}
          </div>
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
      <p className="tiny muted" style={{ marginTop: 16 }}>Angezeigte Infos lassen sich in den Einstellungen anpassen.</p>
    </div>
  )
}
