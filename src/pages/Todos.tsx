import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, setTodoDone, type Todo } from '../db'
import { fmtDateTime, fmtShort, toKey, todayKey } from '../lib/date'
import { Checkbox, DeleteHint, TopBar, confirmDelete, useProjectNames } from '../components/ui'
import { TodoForm } from '../forms/TodoForm'

export function TodoItem({ t, deleteMode, onEdit, projectName }: { t: Todo; deleteMode?: boolean; onEdit: () => void; projectName?: string }) {
  const today = todayKey()
  const overdue = !t.done && t.date && t.date < today
  const click = async () => {
    if (!deleteMode) return onEdit()
    if (confirmDelete(t.title)) await db.todos.delete(t.id!)
  }
  return (
    <div className={`item rel-${t.relevance} ${deleteMode ? 'deletable' : ''}`} onClick={click} role="button">
      <span className="stripe rel-bg" />
      <div className="grow">
        <div className={`title ${t.done ? 'done-text' : ''}`}>{t.isAppointment && '◆ '}{t.title}</div>
        <div className="meta">
          {t.date && <span className="num" style={{ color: overdue ? 'var(--red)' : undefined }}>{fmtDateTime(t.date, t.time)}</span>}
          {t.date && projectName && ' · '}
          {projectName && <span>{projectName}</span>}
        </div>
      </div>
      {!deleteMode && <Checkbox on={t.done} onChange={() => setTodoDone(t, !t.done, today)} />}
    </div>
  )
}

export function TodoList() {
  const [editing, setEditing] = useState<Todo | 'new'>()
  const [deleteMode, setDeleteMode] = useState(false)
  const projects = useProjectNames()
  const todos = useLiveQuery(() => db.todos.filter((t) => !t.done).toArray()) ?? []
  const undated = todos.filter((t) => !t.date).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const dated = todos.filter((t) => t.date).sort((a, b) => `${a.date}${a.time ?? ''}`.localeCompare(`${b.date}${b.time ?? ''}`))

  return (
    <div className="page">
      <TopBar title="To-Dos" onAdd={() => setEditing('new')} deleteMode={deleteMode} onToggleDelete={() => setDeleteMode(!deleteMode)} />
      <DeleteHint active={deleteMode} />
      <Link to="/todos/erledigt" className="btn ghost small" style={{ marginBottom: 12 }}>Erledigte To-Dos ansehen →</Link>

      {undated.length > 0 && <div className="section-title">Ohne Termin</div>}
      <div className="list">
        {undated.map((t) => <TodoItem key={t.id} t={t} deleteMode={deleteMode} onEdit={() => setEditing(t)} projectName={t.projectId ? projects.get(t.projectId) : undefined} />)}
      </div>
      {dated.length > 0 && <div className="section-title">Terminiert</div>}
      <div className="list">
        {dated.map((t) => <TodoItem key={t.id} t={t} deleteMode={deleteMode} onEdit={() => setEditing(t)} projectName={t.projectId ? projects.get(t.projectId) : undefined} />)}
      </div>
      {!todos.length && <div className="empty">Keine offenen To-Dos. Mit + ein neues anlegen.</div>}

      {editing && <TodoForm todo={editing === 'new' ? undefined : editing} onClose={() => setEditing(undefined)} />}
    </div>
  )
}

export function TodosDone() {
  const today = todayKey()
  const all = useLiveQuery(() => db.todos.filter((t) => t.done).toArray()) ?? []
  const sorted = [...all].sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? ''))
  let lastDay = ''
  return (
    <div className="page">
      <TopBar title="Erledigte To-Dos" />
      {!sorted.length && <div className="empty">Noch nichts erledigt.</div>}
      <div className="list">
        {sorted.map((t) => {
          const day = t.doneAt ? fmtShort(toKey(new Date(t.doneAt))) : '—'
          const header = day !== lastDay ? day : null
          lastDay = day
          return (
            <div key={t.id}>
              {header && <div className="section-title num" style={{ marginTop: 14 }}>{header}</div>}
              <div className={`item rel-${t.relevance}`}>
                <span className="stripe rel-bg" />
                <div className="grow"><div className="title done-text">{t.title}</div></div>
                <Checkbox on onChange={() => setTodoDone(t, false, today)} label="Wieder öffnen" />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
