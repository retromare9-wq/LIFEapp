import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, nowIso, type Activity } from '../db'
import { DurationInput, ProjectSelect, RewardToggle, Sheet, confirmDelete } from '../components/ui'
import { todayKey } from '../lib/date'

export function ActivityForm({ activity, initial, onClose }: { activity?: Activity; initial?: Partial<Activity>; onClose: (saved?: boolean) => void }) {
  const today = todayKey()
  const [a, setA] = useState<Partial<Activity>>(activity ?? { title: '', ...initial })
  const set = (patch: Partial<Activity>) => setA((prev) => ({ ...prev, ...patch }))
  const names = useLiveQuery(async () => (await db.activities.orderBy('title').uniqueKeys()) as string[]) ?? []
  const habitExists = useLiveQuery(
    async () => !!a.title?.trim() && (await db.habits.filter((h) => h.name === a.title!.trim()).count()) > 0,
    [a.title],
  )
  // Without a date the activity counts for today; a future date makes it a planned activity.
  const date = a.date ?? today

  const save = async () => {
    if (!a.title?.trim()) return
    const data = {
      title: a.title.trim(),
      date,
      timeFrom: a.timeFrom,
      timeTo: a.timeTo,
      durationMinutes: a.durationMinutes,
      projectId: a.projectId,
      note: a.note?.trim() || undefined,
      noReward: !!a.noReward,
    }
    if (activity?.id != null) await db.activities.update(activity.id, data)
    else await db.activities.add({ ...data, createdAt: nowIso() })
    onClose(true)
  }

  const remove = async () => {
    if (activity?.id == null || !confirmDelete(activity.title)) return
    await db.activities.delete(activity.id)
    if (activity.fromTodoId != null) await db.todos.update(activity.fromTodoId, { activityId: undefined })
    onClose()
  }

  const makeHabit = async () => {
    const name = a.title?.trim()
    if (!name) return
    const habitId = (await db.habits.add({ name, weeklyTarget: 7, createdAt: today, order: Date.now() })) as number
    // Earlier activities with the same name count as fulfilled days of the new habit.
    const days = new Set((await db.activities.where('title').equals(name).toArray()).filter((x) => x.date <= today).map((x) => x.date))
    if (date <= today) days.add(date)
    await db.habitLogs.bulkAdd([...days].map((d) => ({ habitId, date: d })))
    window.alert(`„${name}“ ist jetzt ein Habit (${days.size} bisherige Tage übernommen).`)
  }

  return (
    <Sheet title={activity ? 'Aktivität bearbeiten' : 'Neue Aktivität'} onClose={onClose}>
      <div className="stack">
        <label className="field">
          Aktivität
          <input type="text" list="activity-names" autoFocus={!a.title} value={a.title ?? ''} onChange={(e) => set({ title: e.target.value })} />
          <datalist id="activity-names">{names.map((n) => <option key={n} value={n} />)}</datalist>
        </label>
        {names.length > 0 && !activity && (
          <div className="chips">
            {names.slice(0, 30).map((n) => (
              <button key={n} type="button" className={`chip ${a.title === n ? 'on' : ''}`} onClick={() => set({ title: n })}>{n}</button>
            ))}
          </div>
        )}
        <DurationInput label="Dauer (optional)" value={a.durationMinutes} onChange={(durationMinutes) => set({ durationMinutes })} />
        <ProjectSelect value={a.projectId} onChange={(projectId) => set({ projectId })} />
        <label className="field">
          Datum (leer = heute, Zukunft = geplant)
          <input type="date" value={a.date ?? ''} onChange={(e) => set({ date: e.target.value || undefined })} />
        </label>
        <div className="row">
          <label className="field grow">
            Von (optional)
            <input type="time" value={a.timeFrom ?? ''} onChange={(e) => set({ timeFrom: e.target.value || undefined })} />
          </label>
          <label className="field grow">
            Bis (optional)
            <input type="time" value={a.timeTo ?? ''} onChange={(e) => set({ timeTo: e.target.value || undefined })} />
          </label>
        </div>
        <label className="field">
          Notiz (optional)
          <textarea style={{ minHeight: 60 }} value={a.note ?? ''} onChange={(e) => set({ note: e.target.value })} />
        </label>
        {a.fromTodoId == null && <RewardToggle noReward={a.noReward} onChange={(noReward) => set({ noReward })} />}
        {a.title?.trim() && !habitExists && (
          <button type="button" className="btn ghost small" onClick={makeHabit}>
            Als Habit etablieren →
          </button>
        )}
      </div>
      <div className="sheet-actions">
        {activity && <button className="btn danger" onClick={remove}>Löschen</button>}
        <button className="btn ghost" onClick={() => onClose()}>Abbrechen</button>
        <button className="btn primary" onClick={save} disabled={!a.title?.trim()}>Speichern</button>
      </div>
    </Sheet>
  )
}
