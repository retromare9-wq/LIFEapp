import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, setTodoDone, type Todo } from '../db'
import { fmtShort, toKey, todayKey } from '../lib/date'
import { KIND_MARK, doneStyle, lastDay, todoColor, todoWhen } from '../lib/todo'
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

export function TodoList() {
  const [editing, setEditing] = useState<Todo | 'new'>()
  const [deleteMode, setDeleteMode] = useState(false)
  const { toggle, sheet } = useTodoCompletion()
  const projects = useProjectNames()
  const todos = useLiveQuery(() => db.todos.filter((t) => !t.done).toArray()) ?? []
  const dated = todos.filter((t) => t.date).sort((a, b) => `${a.date}${a.time ?? ''}`.localeCompare(`${b.date}${b.time ?? ''}`))
  const undated = todos.filter((t) => !t.date).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const item = (t: Todo) => (
    <TodoItem key={t.id} t={t} deleteMode={deleteMode} onEdit={() => setEditing(t)} onToggle={toggle}
      projectName={t.projectId ? projects.get(t.projectId) : undefined} />
  )

  return (
    <div className="page">
      <TopBar title="To-Dos" onAdd={() => setEditing('new')} deleteMode={deleteMode} onToggleDelete={() => setDeleteMode(!deleteMode)} />
      <DeleteHint active={deleteMode} />
      <Link to="/todos/erledigt" className="btn ghost small" style={{ marginBottom: 12 }}>Erledigte To-Dos ansehen →</Link>

      {dated.length > 0 && <div className="section-title">Terminiert</div>}
      <div className="list">{dated.map(item)}</div>
      {undated.length > 0 && <div className="section-title">Ohne Termin</div>}
      <div className="list">{undated.map(item)}</div>
      {!todos.length && <div className="empty">Keine offenen To-Dos. Mit + ein neues anlegen.</div>}

      {editing && <TodoForm todo={editing === 'new' ? undefined : editing} onClose={() => setEditing(undefined)} />}
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
