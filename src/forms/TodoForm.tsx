import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, nowIso, type Relevance, type Todo } from '../db'
import { DateTimeFields, ProjectSelect, Sheet, confirmDelete } from '../components/ui'

export const RELEVANCE: { value: Relevance; label: string }[] = [
  { value: 'low', label: 'banal' },
  { value: 'mid', label: 'relevant' },
  { value: 'high', label: 'bedeutsam' },
]

export function TodoForm({ todo, initial, onClose }: { todo?: Todo; initial?: Partial<Todo>; onClose: (saved?: boolean) => void }) {
  const [t, setT] = useState<Partial<Todo>>(
    todo ?? { title: '', relevance: 'low', isAppointment: false, logAsActivity: false, ...initial },
  )
  const set = (patch: Partial<Todo>) => setT((prev) => ({ ...prev, ...patch }))
  const groups = useLiveQuery(
    () => (t.projectId ? db.projectGroups.where('projectId').equals(t.projectId).sortBy('order') : []),
    [t.projectId],
  ) ?? []

  const save = async () => {
    if (!t.title?.trim()) return
    const data = {
      title: t.title.trim(),
      relevance: t.relevance ?? 'low',
      projectId: t.projectId,
      groupId: t.projectId ? t.groupId : undefined,
      date: t.date,
      time: t.date ? t.time : undefined,
      isAppointment: !!t.isAppointment,
      logAsActivity: !!t.logAsActivity,
    }
    if (todo?.id != null) await db.todos.update(todo.id, data)
    else await db.todos.add({ ...data, done: false, createdAt: nowIso() })
    onClose(true)
  }

  const remove = async () => {
    if (todo?.id == null || !confirmDelete(todo.title)) return
    await db.todos.delete(todo.id)
    onClose()
  }

  return (
    <Sheet title={todo ? 'To-Do bearbeiten' : 'Neues To-Do'} onClose={onClose}>
      <div className="stack">
        <label className="field">
          Bezeichnung
          <textarea style={{ minHeight: 60 }} autoFocus={!t.title} value={t.title ?? ''} onChange={(e) => set({ title: e.target.value })} />
        </label>
        <div className="field" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="small muted">Relevanz</span>
          <div className="row">
            {RELEVANCE.map((r) => (
              <button key={r.value} type="button" className={`btn small grow rel-${r.value}`}
                style={{ borderColor: 'var(--rel)', background: t.relevance === r.value ? 'var(--rel)' : 'transparent', color: t.relevance === r.value ? '#000' : 'var(--rel)' }}
                onClick={() => set({ relevance: r.value })}>
                {r.label}
              </button>
            ))}
          </div>
        </div>
        <ProjectSelect value={t.projectId} onChange={(projectId) => set({ projectId, groupId: undefined })} />
        {groups.length > 0 && (
          <label className="field">
            Gruppe im Projekt
            <select value={t.groupId ?? ''} onChange={(e) => set({ groupId: e.target.value ? Number(e.target.value) : undefined })}>
              <option value="">— keine Gruppe —</option>
              {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </label>
        )}
        <DateTimeFields date={t.date} time={t.time} onDate={(date) => set({ date })} onTime={(time) => set({ time })} />
        <label className="check">
          <input type="checkbox" checked={!!t.isAppointment} onChange={(e) => set({ isAppointment: e.target.checked })} />
          Ist ein Termin
        </label>
        <label className="check">
          <input type="checkbox" checked={!!t.logAsActivity} onChange={(e) => set({ logAsActivity: e.target.checked })} />
          Bei Erledigung in die Aktivitätenliste aufnehmen
        </label>
      </div>
      <div className="sheet-actions">
        {todo && <button className="btn danger" onClick={remove}>Löschen</button>}
        <button className="btn ghost" onClick={() => onClose()}>Abbrechen</button>
        <button className="btn primary" onClick={save} disabled={!t.title?.trim()}>Speichern</button>
      </div>
    </Sheet>
  )
}
