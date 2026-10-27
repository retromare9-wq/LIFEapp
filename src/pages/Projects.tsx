import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, nowIso, type Activity, type Project, type ProjectStatus, type Todo } from '../db'
import { fmtShort, todayKey } from '../lib/date'
import { DeleteHint, Sheet, TopBar } from '../components/ui'
import { IconCheck, IconPlus, IconTrash, IconX } from '../components/Icons'
import { TodoForm } from '../forms/TodoForm'
import { NoteForm } from '../forms/JournalForms'
import { TodoItem } from './Todos'
import { ActivityItem } from './Activities'
import { ActivityForm } from '../forms/ActivityForm'

const STATUS_LABEL: Record<ProjectStatus, string> = { active: 'aktiv', done: 'abgeschlossen', cancelled: 'abgebrochen' }

export const percent = (todos: Todo[]) => (todos.length ? Math.round((100 * todos.filter((t) => t.done).length) / todos.length) : 0)

export function Progress({ todos }: { todos: Todo[] }) {
  const p = percent(todos)
  return (
    <div className="row" style={{ gap: 8 }}>
      <div className="progress grow"><div style={{ width: `${p}%` }} /></div>
      <span className="tiny num muted" style={{ width: 70, textAlign: 'right' }}>{p} % ({todos.filter((t) => t.done).length}/{todos.length})</span>
    </div>
  )
}

function ProjectForm({ project, onClose }: { project?: Project; onClose: (id?: number) => void }) {
  const [p, setP] = useState<Partial<Project>>(project ?? { name: '', description: '', startDate: todayKey() })
  const set = (patch: Partial<Project>) => setP((prev) => ({ ...prev, ...patch }))
  const save = async () => {
    if (!p.name?.trim()) return
    const data = { name: p.name.trim(), description: p.description?.trim() ?? '', startDate: p.startDate || todayKey(), endDate: p.endDate || undefined }
    if (project?.id != null) {
      await db.projects.update(project.id, data)
      onClose(project.id)
    } else {
      onClose(await db.projects.add({ ...data, status: 'active', createdAt: nowIso() }))
    }
  }
  return (
    <Sheet title={project ? 'Projekt bearbeiten' : 'Neues Projekt'} onClose={() => onClose()}>
      <div className="stack">
        <label className="field">Name<input type="text" autoFocus={!project} value={p.name ?? ''} onChange={(e) => set({ name: e.target.value })} /></label>
        <label className="field">Beschreibung<textarea style={{ minHeight: 80 }} value={p.description ?? ''} onChange={(e) => set({ description: e.target.value })} /></label>
        <div className="row">
          <label className="field grow">Start<input type="date" value={p.startDate ?? ''} onChange={(e) => set({ startDate: e.target.value })} /></label>
          <label className="field grow">Ende (optional)<input type="date" value={p.endDate ?? ''} onChange={(e) => set({ endDate: e.target.value || undefined })} /></label>
        </div>
      </div>
      <div className="sheet-actions">
        <button className="btn ghost" onClick={() => onClose()}>Abbrechen</button>
        <button className="btn primary" onClick={save} disabled={!p.name?.trim()}>Speichern</button>
      </div>
    </Sheet>
  )
}

/** Deletes the project with its to-dos and groups; notes and activities stay but lose the link. */
async function deleteProject(p: Project) {
  if (!window.confirm(`Projekt „${p.name}“ komplett löschen?\nZugehörige To-Dos werden ebenfalls gelöscht, Notizen und Aktivitäten bleiben ohne Projekt erhalten.`)) return false
  await db.transaction('rw', [db.projects, db.todos, db.projectGroups, db.notes, db.activities], async () => {
    await db.todos.where('projectId').equals(p.id!).delete()
    await db.projectGroups.where('projectId').equals(p.id!).delete()
    await db.notes.where('projectId').equals(p.id!).modify({ projectId: undefined })
    await db.activities.where('projectId').equals(p.id!).modify({ projectId: undefined })
    await db.projects.delete(p.id!)
  })
  return true
}

function useProjectsWithTodos(filter: (p: Project) => boolean) {
  return useLiveQuery(async () => {
    const [projects, todos] = await Promise.all([db.projects.toArray(), db.todos.filter((t) => t.projectId != null).toArray()])
    return projects.filter(filter).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((p) => ({ p, todos: todos.filter((t) => t.projectId === p.id) }))
  }) ?? []
}

export function ProjectList() {
  const navigate = useNavigate()
  const [adding, setAdding] = useState(false)
  const [deleteMode, setDeleteMode] = useState(false)
  const rows = useProjectsWithTodos((p) => p.status !== 'cancelled')
  const active = rows.filter((r) => r.p.status === 'active')
  const done = rows.filter((r) => r.p.status === 'done')

  const row = ({ p, todos }: (typeof rows)[number]) => (
    <div key={p.id} className={`item ${deleteMode ? 'deletable' : ''}`} role="button"
      onClick={async () => (deleteMode ? deleteProject(p) : navigate(`/projekte/${p.id}`))}>
      <div className="grow">
        <div className={`title ${p.status === 'done' ? 'done-text' : ''}`}>{p.name}</div>
        <div className="meta num" style={{ marginBottom: 6 }}>{fmtShort(p.startDate)}{p.endDate ? ` – ${fmtShort(p.endDate)}` : ''}</div>
        <Progress todos={todos} />
      </div>
      {!deleteMode && p.status === 'active' && (
        <div className="row" style={{ gap: 6 }}>
          <button className="icon-btn" aria-label="Abschließen" title="Abschließen" style={{ color: 'var(--mood-5)' }}
            onClick={(e) => { e.stopPropagation(); db.projects.update(p.id!, { status: 'done' }) }}><IconCheck /></button>
          <button className="icon-btn" aria-label="Abbrechen" title="Abbrechen" style={{ color: 'var(--red)' }}
            onClick={(e) => { e.stopPropagation(); if (window.confirm(`Projekt „${p.name}“ abbrechen?`)) db.projects.update(p.id!, { status: 'cancelled' }) }}><IconX /></button>
        </div>
      )}
    </div>
  )

  return (
    <div className="page">
      <TopBar title="Projekte" onAdd={() => setAdding(true)} deleteMode={deleteMode} onToggleDelete={() => setDeleteMode(!deleteMode)} />
      <DeleteHint active={deleteMode} />
      <Link to="/projekte/alle" className="btn ghost small" style={{ marginBottom: 12 }}>Gesamtliste aller Projekte →</Link>
      <div className="list">{active.map(row)}</div>
      {!active.length && <div className="empty">Keine aktiven Projekte. Mit + anlegen.</div>}
      {done.length > 0 && (
        <>
          <div className="section-title">Abgeschlossen</div>
          <div className="list">{done.map(row)}</div>
        </>
      )}
      {adding && <ProjectForm onClose={(id) => { setAdding(false); if (id) navigate(`/projekte/${id}`) }} />}
    </div>
  )
}

export function ProjectArchive() {
  const navigate = useNavigate()
  const rows = useProjectsWithTodos(() => true)
  return (
    <div className="page">
      <TopBar title="Alle Projekte" />
      <div className="list">
        {rows.map(({ p, todos }) => (
          <div key={p.id} className="item" role="button" onClick={() => navigate(`/projekte/${p.id}`)}>
            <div className="grow">
              <div className="title">{p.name}</div>
              <div className="meta">{STATUS_LABEL[p.status]} · <span className="num">{fmtShort(p.startDate)}{p.endDate ? ` – ${fmtShort(p.endDate)}` : ''}</span></div>
              <Progress todos={todos} />
            </div>
          </div>
        ))}
      </div>
      {!rows.length && <div className="empty">Noch keine Projekte.</div>}
    </div>
  )
}

export function ProjectDetail() {
  const { id } = useParams()
  const projectId = Number(id)
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [todoForm, setTodoForm] = useState<Todo | { groupId?: number }>()
  const [noteForm, setNoteForm] = useState(false)
  const [activityForm, setActivityForm] = useState<Activity | 'new'>()
  const [newGroup, setNewGroup] = useState('')
  const data = useLiveQuery(async () => {
    const [project, todos, groups, notes, activities] = await Promise.all([
      db.projects.get(projectId),
      db.todos.where('projectId').equals(projectId).toArray(),
      db.projectGroups.where('projectId').equals(projectId).sortBy('order'),
      db.notes.where('projectId').equals(projectId).reverse().sortBy('date'),
      db.activities.where('projectId').equals(projectId).reverse().sortBy('date'),
    ])
    return { project, todos, groups, notes, activities }
  }, [projectId])

  if (!data?.project) return <div className="page"><TopBar title="Projekt" /></div>
  const { project, todos, groups, notes, activities } = data

  const sortTodos = (list: Todo[]) => [...list].sort((a, b) => Number(a.done) - Number(b.done) || `${a.date ?? '9'}${a.time ?? ''}`.localeCompare(`${b.date ?? '9'}${b.time ?? ''}`))
  const todoList = (list: Todo[]) => (
    <div className="list">
      {sortTodos(list).map((t) => <TodoItem key={t.id} t={t} onEdit={() => setTodoForm(t)} />)}
    </div>
  )
  const ungrouped = todos.filter((t) => t.groupId == null || !groups.some((g) => g.id === t.groupId))

  const addGroup = async () => {
    if (!newGroup.trim()) return
    await db.projectGroups.add({ projectId, name: newGroup.trim(), order: Date.now() })
    setNewGroup('')
  }
  const removeGroup = async (gid: number, name: string) => {
    if (!window.confirm(`Gruppe „${name}“ löschen? Ihre To-Dos bleiben im Projekt (ohne Gruppe).`)) return
    await db.todos.where('groupId').equals(gid).modify({ groupId: undefined })
    await db.projectGroups.delete(gid)
  }

  return (
    <div className="page">
      <TopBar title={project.name}>
        <button className="btn small ghost" onClick={() => setEditing(true)}>Bearbeiten</button>
      </TopBar>
      <div className="card stack">
        <div className="small muted num">
          {STATUS_LABEL[project.status]} · {fmtShort(project.startDate)}{project.endDate ? ` – ${fmtShort(project.endDate)}` : ''}
        </div>
        {project.description && <div className="pre">{project.description}</div>}
        <Progress todos={todos} />
        <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
          {project.status !== 'active' && <button className="btn small" onClick={() => db.projects.update(projectId, { status: 'active' })}>Wieder aktivieren</button>}
          {project.status === 'active' && <button className="btn small" onClick={() => db.projects.update(projectId, { status: 'done' })}>Abschließen</button>}
          {project.status === 'active' && <button className="btn small ghost" onClick={() => window.confirm('Projekt abbrechen?') && db.projects.update(projectId, { status: 'cancelled' })}>Abbrechen</button>}
          <button className="btn small danger" onClick={async () => { if (await deleteProject(project)) navigate('/projekte', { replace: true }) }}>Löschen</button>
        </div>
      </div>

      <div className="section-title row" style={{ justifyContent: 'space-between' }}>
        <span>To-Dos</span>
        <button className="chip" onClick={() => setTodoForm({})}><IconPlus /> To-Do</button>
      </div>
      {ungrouped.length > 0 ? todoList(ungrouped) : !groups.length && <div className="small muted">Noch keine To-Dos.</div>}

      {groups.map((g) => {
        const list = todos.filter((t) => t.groupId === g.id)
        return (
          <div key={g.id} className="card" style={{ marginTop: 12 }}>
            <div className="row" style={{ marginBottom: 8 }}>
              <strong className="grow">{g.name}</strong>
              <button className="chip" onClick={() => setTodoForm({ groupId: g.id })}><IconPlus /></button>
              <button className="chip" aria-label="Gruppe löschen" onClick={() => removeGroup(g.id!, g.name)}><IconTrash /></button>
            </div>
            <div style={{ marginBottom: 8 }}><Progress todos={list} /></div>
            {list.length ? todoList(list) : <div className="small muted">Keine To-Dos in dieser Gruppe.</div>}
          </div>
        )
      })}
      <div className="row" style={{ marginTop: 12 }}>
        <input type="text" placeholder="Neue Gruppe" value={newGroup} onChange={(e) => setNewGroup(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addGroup()} />
        <button className="btn small" onClick={addGroup} disabled={!newGroup.trim()}><IconPlus /> Gruppe</button>
      </div>

      <div className="section-title row" style={{ justifyContent: 'space-between' }}>
        <span>Ideen & Notizen</span>
        <button className="chip" onClick={() => setNoteForm(true)}><IconPlus /> Notiz</button>
      </div>
      {notes.length ? (
        <div className="list">
          {notes.map((n) => (
            <Link key={n.id} to="/notizen" className="item" style={{ display: 'block' }}>
              <div className="meta">{n.kind === 'idea' ? 'Idee' : 'Notiz'} · <span className="num">{fmtShort(n.date)}</span></div>
              <div className="pre clamp">{n.text}</div>
            </Link>
          ))}
        </div>
      ) : <div className="small muted">Keine verknüpften Einträge.</div>}

      <div className="section-title row" style={{ justifyContent: 'space-between' }}>
        <span>Aktivitäten</span>
        <button className="chip" onClick={() => setActivityForm('new')}><IconPlus /> Aktivität</button>
      </div>
      {activities.length ? (
        <div className="list">
          {activities.map((a) => <ActivityItem key={a.id} a={a} onEdit={() => setActivityForm(a)} />)}
        </div>
      ) : <div className="small muted">Keine verknüpften Aktivitäten.</div>}

      {editing && <ProjectForm project={project} onClose={() => setEditing(false)} />}
      {todoForm && (
        'id' in todoForm
          ? <TodoForm todo={todoForm as Todo} onClose={() => setTodoForm(undefined)} />
          : <TodoForm initial={{ projectId, groupId: todoForm.groupId }} onClose={() => setTodoForm(undefined)} />
      )}
      {noteForm && <NoteForm initial={{ projectId }} onClose={() => setNoteForm(false)} />}
      {activityForm && <ActivityForm activity={activityForm === 'new' ? undefined : activityForm} initial={{ projectId }} onClose={() => setActivityForm(undefined)} />}
    </div>
  )
}
