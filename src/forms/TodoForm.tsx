import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, nowIso, setTodoDone, type ChecklistItem, type Relevance, type Todo, type TodoKind } from '../db'
import { ColorPicker, DurationInput, ProjectSelect, RewardToggle, Sheet, confirmDelete } from '../components/ui'
import { IconX } from '../components/Icons'
import { KIND_LABEL } from '../lib/todo'
import { todayKey } from '../lib/date'

export const RELEVANCE: { value: Relevance; label: string }[] = [
  { value: 'low', label: 'banal' },
  { value: 'mid', label: 'relevant' },
  { value: 'high', label: 'bedeutsam' },
]

const newId = () => Math.random().toString(36).slice(2, 10)

export function ChecklistEditor({ items, onChange }: { items: ChecklistItem[]; onChange: (v: ChecklistItem[]) => void }) {
  const [draft, setDraft] = useState('')
  const add = () => {
    const lines = draft.split('\n').map((l) => l.trim()).filter(Boolean)
    if (!lines.length) return
    onChange([...items, ...lines.map((text) => ({ id: newId(), text, done: false }))])
    setDraft('')
  }
  return (
    <div className="field" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span className="small muted">Checkliste (optional)</span>
      {items.map((item, i) => (
        <div key={item.id} className="row" style={{ gap: 8 }}>
          <input type="checkbox" checked={item.done} style={{ width: 20, height: 20, accentColor: 'var(--accent)' }}
            onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, done: e.target.checked } : x)))} />
          <input type="text" value={item.text} onChange={(e) => onChange(items.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))}
            style={{ minHeight: 38, padding: '6px 10px' }} />
          <button type="button" className="icon-btn" style={{ width: 36, height: 36 }} aria-label="Punkt entfernen"
            onClick={() => onChange(items.filter((_, j) => j !== i))}><IconX /></button>
        </div>
      ))}
      <div className="row">
        <input type="text" placeholder="Neuer Punkt" value={draft} onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }} />
        <button type="button" className="btn small" onClick={add} disabled={!draft.trim()}>+</button>
      </div>
    </div>
  )
}

export function TodoForm({ todo, initial, onClose }: { todo?: Todo; initial?: Partial<Todo>; onClose: (saved?: boolean) => void }) {
  const [t, setT] = useState<Partial<Todo>>(
    todo ?? { title: '', relevance: 'low', kind: 'todo', color: 'lightblue', checklist: [], logAsActivity: false, ...initial },
  )
  const set = (patch: Partial<Todo>) => setT((prev) => ({ ...prev, ...patch }))
  const groups = useLiveQuery(
    () => (t.projectId ? db.projectGroups.where('projectId').equals(t.projectId).sortBy('order') : []),
    [t.projectId],
  ) ?? []
  const isEvent = t.kind === 'event'

  const save = async () => {
    if (!t.title?.trim()) return
    const data = {
      title: t.title.trim(),
      relevance: t.relevance ?? 'low',
      kind: t.kind ?? 'todo',
      color: t.color ?? 'lightblue',
      projectId: t.projectId,
      groupId: t.projectId ? t.groupId : undefined,
      date: t.date,
      time: t.date ? t.time : undefined,
      timeTo: t.date ? t.timeTo : undefined,
      endDate: isEvent && t.date && t.endDate && t.endDate > t.date ? t.endDate : undefined,
      budgetMinutes: t.budgetMinutes,
      checklist: (t.checklist ?? []).filter((c) => c.text.trim()),
      logAsActivity: !!t.logAsActivity,
      noReward: !!t.noReward,
    }
    if (todo?.id != null) await db.todos.update(todo.id, data)
    else await db.todos.add({ ...data, done: false, createdAt: nowIso() })
    onClose(true)
  }

  const remove = async () => {
    if (todo?.id == null || !confirmDelete(todo.title)) return
    if (todo.activityId != null) await db.activities.delete(todo.activityId)
    await db.todos.delete(todo.id)
    onClose()
  }

  return (
    <Sheet title={todo ? `${KIND_LABEL[t.kind ?? 'todo']} bearbeiten` : `Neues ${KIND_LABEL[t.kind ?? 'todo']}`} onClose={onClose}>
      <div className="stack">
        <div className="row">
          {(['todo', 'appointment', 'event'] as TodoKind[]).map((k) => (
            <button key={k} type="button" className={`btn small grow ${t.kind === k ? 'primary' : ''}`} onClick={() => set({ kind: k })}>
              {KIND_LABEL[k]}
            </button>
          ))}
        </div>
        <label className="field">
          Bezeichnung
          <textarea style={{ minHeight: 60 }} autoFocus={!t.title} value={t.title ?? ''} onChange={(e) => set({ title: e.target.value })} />
        </label>
        <ColorPicker value={t.color} onChange={(color) => set({ color })} />
        <ChecklistEditor items={t.checklist ?? []} onChange={(checklist) => set({ checklist })} />
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

        <div className="row" style={{ alignItems: 'flex-end' }}>
          <label className="field grow">
            {isEvent ? 'Beginn (optional)' : 'Datum (optional)'}
            <input type="date" value={t.date ?? ''} onChange={(e) => set(e.target.value ? { date: e.target.value } : { date: undefined, time: undefined, timeTo: undefined, endDate: undefined })} />
          </label>
          <label className="field" style={{ width: 120 }}>
            Von
            <input type="time" value={t.time ?? ''} disabled={!t.date} onChange={(e) => set({ time: e.target.value || undefined })} />
          </label>
        </div>
        <div className="row" style={{ alignItems: 'flex-end' }}>
          {isEvent && (
            <label className="field grow">
              Ende (optional, mehrtägig)
              <input type="date" value={t.endDate ?? ''} min={t.date} disabled={!t.date} onChange={(e) => set({ endDate: e.target.value || undefined })} />
            </label>
          )}
          {!isEvent && <span className="grow" />}
          <label className="field" style={{ width: 120 }}>
            Bis
            <input type="time" value={t.timeTo ?? ''} disabled={!t.date} onChange={(e) => set({ timeTo: e.target.value || undefined })} />
          </label>
        </div>
        <DurationInput label="Zeitbudget (optional)" value={t.budgetMinutes} onChange={(budgetMinutes) => set({ budgetMinutes })} />

        <div className="field" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="small muted">Gewichtung (für km/Credits)</span>
          <div className="row">
            {RELEVANCE.map((r) => (
              <button key={r.value} type="button" className={`btn small grow ${t.relevance === r.value ? 'primary' : ''}`}
                onClick={() => set({ relevance: r.value })}>{r.label}</button>
            ))}
          </div>
        </div>
        <RewardToggle noReward={t.noReward} onChange={(noReward) => set({ noReward })} />
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

/**
 * Completing a to-do that gets logged as activity first asks (optionally) how long it took.
 * Returns the toggle function plus the sheet element to render.
 */
export function useTodoCompletion() {
  const [pending, setPending] = useState<Todo>()
  const [duration, setDuration] = useState<number>()
  const today = todayKey()

  const toggle = (todo: Todo) => {
    if (!todo.done && todo.logAsActivity) {
      setDuration(todo.budgetMinutes)
      setPending(todo)
    } else {
      setTodoDone(todo, !todo.done, today)
    }
  }
  const finish = async (withDuration: boolean) => {
    if (pending) await setTodoDone(pending, true, today, withDuration ? duration : undefined)
    setPending(undefined)
  }

  const sheet = pending ? (
    <Sheet title="Erledigt – wie lange hat es gedauert?" onClose={() => setPending(undefined)}>
      <p className="small muted" style={{ marginTop: 0 }}>„{pending.title}“ wird in die Aktivitätenliste aufgenommen. Die Dauer ist optional.</p>
      <DurationInput label="Dauer" value={duration} onChange={setDuration} />
      <div className="sheet-actions">
        <button className="btn ghost" onClick={() => finish(false)}>Ohne Dauer</button>
        <button className="btn primary" onClick={() => finish(true)}>Speichern</button>
      </div>
    </Sheet>
  ) : null

  return { toggle, sheet }
}
