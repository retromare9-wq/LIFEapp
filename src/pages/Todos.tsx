import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, setTodoDone, type Todo } from '../db'
import { fmtDayMonth, fmtDuration, fmtShort, fmtWeekdayShort, shiftKey, toKey, todayKey } from '../lib/date'
import { KIND_MARK, budgetSummary, coversDay, doneStyle, lastDay, timeOnDay, todoColor, todoWhen } from '../lib/todo'
import { Checkbox, DeleteHint, TopBar, confirmDelete, useProjectNames } from '../components/ui'
import { TodoForm, useTodoCompletion } from '../forms/TodoForm'

function Checklist({ t }: { t: Todo }) {
  const toggle = (id: string) =>
    db.todos.update(t.id!, { checklist: t.checklist.map((c) => (c.id === id ? { ...c, done: !c.done } : c)) })
  return (
    <div className="stack" style={{ gap: 2, marginTop: 6 }} onClick={(e) => e.stopPropagation()}>
      {t.checklist.map((c) => (
        <label key={c.id} className="check" style={{ minHeight: 32 }}>
          <input type="checkbox" checked={c.done} onChange={() => toggle(c.id)} />
          <span className={c.done ? 'done-text' : ''}>{c.text}</span>
        </label>
      ))}
    </div>
  )
}

export function TodoItem({ t, deleteMode, onEdit, onToggle, projectName }: {
  t: Todo; deleteMode?: boolean; onEdit: () => void; onToggle?: (t: Todo) => void; projectName?: string
}) {
  const today = todayKey()
  const [open, setOpen] = useState(false)
  const overdue = !t.done && t.date && lastDay(t)! < today
  const done = doneStyle(t)
  const checked = t.checklist?.filter((c) => c.done).length ?? 0
  const click = async () => {
    if (!deleteMode) return onEdit()
    if (confirmDelete(t.title)) {
      if (t.activityId != null) await db.activities.delete(t.activityId)
      await db.todos.delete(t.id!)
    }
  }
  const when = todoWhen(t)
  return (
    <div className={`item ${deleteMode ? 'deletable' : ''}`} onClick={click} role="button" style={{ alignItems: 'flex-start' }}>
      <span className="stripe" style={{ background: todoColor(t) }} />
      <div className="grow">
        <div className={`title ${done.className}`} style={done.style}>{KIND_MARK[t.kind]}{t.title}</div>
        <div className="meta">
          {when && <span className="num" style={{ color: overdue ? 'var(--red)' : undefined }}>{when}</span>}
          {when && projectName && ' · '}
          {projectName && <span>{projectName}</span>}
        </div>
        {t.checklist?.length > 0 && (
          <button className="chip" style={{ marginTop: 6 }} onClick={(e) => { e.stopPropagation(); setOpen(!open) }}>
            ☑ {checked}/{t.checklist.length} {open ? '▴' : '▾'}
          </button>
        )}
        {open && <Checklist t={t} />}
      </div>
      {!deleteMode && onToggle && <Checkbox on={t.done} onChange={() => onToggle(t)} />}
    </div>
  )
}

const RELEVANCE_RANK = { high: 0, mid: 1, low: 2 } as const
const byTime = (day: string) => (a: Todo, b: Todo) => (timeOnDay(a, day) ?? '99').localeCompare(timeOnDay(b, day) ?? '99')

/** "3 h 15 min geplant · 2 To-Dos ohne Zeitbudget" */
function BudgetLine({ todos }: { todos: Todo[] }) {
  if (!todos.length) return null
  const { minutes, withoutBudget } = budgetSummary(todos)
  return (
    <div className="budget-line small">
      <span>⏱ <strong className="num">{minutes ? fmtDuration(minutes) : '0 min'}</strong> Zeitbudget</span>
      {withoutBudget > 0 && <span className="muted">{withoutBudget} To-Do{withoutBudget === 1 ? '' : 's'} ohne Zeitbudget</span>}
    </div>
  )
}

export function TodoList() {
  const today = todayKey()
  const week = Array.from({ length: 7 }, (_, i) => shiftKey(today, i))
  const [tab, setTab] = useState<string>(today)
  const [editing, setEditing] = useState<Todo | 'new'>()
  const [deleteMode, setDeleteMode] = useState(false)
  const { toggle, sheet } = useTodoCompletion()
  const projects = useProjectNames()
  const todos = useLiveQuery(() => db.todos.filter((t) => !t.done).toArray()) ?? []
  const item = (t: Todo) => (
    <TodoItem key={t.id} t={t} deleteMode={deleteMode} onEdit={() => setEditing(t)} onToggle={toggle}
      projectName={t.projectId ? projects.get(t.projectId) : undefined} />
  )

  const later = week[6]
  const undated = todos.filter((t) => !t.date)
    .sort((a, b) => RELEVANCE_RANK[a.relevance] - RELEVANCE_RANK[b.relevance] || a.title.localeCompare(b.title, 'de'))
  const overdue = todos.filter((t) => t.date && lastDay(t)! < today)
  const forDay = (day: string) => todos.filter((t) => coversDay(t, day)).sort(byTime(day))
  const laterTodos = todos.filter((t) => t.date && lastDay(t)! > later)
  const counts: Record<string, number> = {
    ...Object.fromEntries(week.map((d) => [d, forDay(d).length + (d === today ? overdue.length : 0)])),
    later: laterTodos.length,
    undated: undated.length,
  }

  /** Events on top in their own box, then everything else. */
  const dayBlock = (list: Todo[]) => {
    const events = list.filter((t) => t.kind === 'event')
    const rest = list.filter((t) => t.kind !== 'event')
    return (
      <>
        {events.length > 0 && <div className="event-box"><div className="tiny muted" style={{ marginBottom: 6 }}>EVENTS</div><div className="list">{events.map(item)}</div></div>}
        <div className="list">{rest.map(item)}</div>
      </>
    )
  }

  let content: ReactNode
  let shown: Todo[]
  if (tab === 'undated') {
    shown = undated
    content = <div className="list">{undated.map(item)}</div>
  } else if (tab === 'later') {
    shown = laterTodos
    const days = [...new Set(laterTodos.map((t) => (t.date! > later ? t.date! : shiftKey(later, 1))))].sort()
    content = days.map((d) => {
      const list = laterTodos.filter((t) => (t.date! > later ? t.date! : shiftKey(later, 1)) === d).sort(byTime(d))
      return (
        <div key={d}>
          <div className="day-divider num">{fmtWeekdayShort(d)} {fmtShort(d)}</div>
          {dayBlock(list)}
        </div>
      )
    })
  } else {
    const list = forDay(tab)
    shown = tab === today ? [...overdue, ...list] : list
    content = (
      <>
        {tab === today && overdue.length > 0 && (
          <>
            <div className="section-title" style={{ color: 'var(--red)', marginTop: 0 }}>Überfällig</div>
            <div className="list" style={{ marginBottom: 14 }}>{overdue.sort((a, b) => (a.date ?? '').localeCompare(b.date ?? '')).map(item)}</div>
          </>
        )}
        {dayBlock(list)}
      </>
    )
  }

  const tabs = [
    ...week.map((d, i) => ({ key: d, label: i === 0 ? 'Heute' : i === 1 ? 'Morgen' : `${fmtWeekdayShort(d)} ${fmtDayMonth(d)}` })),
    { key: 'later', label: 'Später' },
    { key: 'undated', label: 'Ohne Termin' },
  ]

  return (
    <div className="page">
      <TopBar title="To-Dos" onAdd={() => setEditing('new')} deleteMode={deleteMode} onToggleDelete={() => setDeleteMode(!deleteMode)} />
      <div className="tabs">
        {tabs.map((t) => (
          <button key={t.key} className={`tab ${tab === t.key ? 'on' : ''}`} onClick={() => setTab(t.key)}>
            {t.label}{counts[t.key] ? <span className="tab-count num">{counts[t.key]}</span> : null}
          </button>
        ))}
      </div>
      <DeleteHint active={deleteMode} />
      <BudgetLine todos={shown} />
      {content}
      {!shown.length && <div className="empty">{tab === 'undated' ? 'Keine To-Dos ohne Termin.' : 'Nichts geplant.'}</div>}
      <Link to="/todos/erledigt" className="btn ghost small" style={{ marginTop: 18 }}>Erledigte To-Dos ansehen →</Link>

      {editing && <TodoForm todo={editing === 'new' ? undefined : editing}
        initial={tab !== 'undated' && tab !== 'later' ? { date: tab } : undefined} onClose={() => setEditing(undefined)} />}
      {sheet}
    </div>
  )
}

export function TodosDone() {
  const today = todayKey()
  const all = useLiveQuery(() => db.todos.filter((t) => t.done).toArray()) ?? []
  const sorted = [...all].sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? ''))
  let lastHeader = ''
  return (
    <div className="page">
      <TopBar title="Erledigte To-Dos" />
      {!sorted.length && <div className="empty">Noch nichts erledigt.</div>}
      <div className="list">
        {sorted.map((t) => {
          const day = t.doneAt ? fmtShort(toKey(new Date(t.doneAt))) : '—'
          const header = day !== lastHeader ? day : null
          lastHeader = day
          return (
            <div key={t.id}>
              {header && <div className="section-title num" style={{ marginTop: 14 }}>{header}</div>}
              <TodoItem t={t} onEdit={() => {}} onToggle={() => setTodoDone(t, false, today)} />
            </div>
          )
        })}
      </div>
    </div>
  )
}
