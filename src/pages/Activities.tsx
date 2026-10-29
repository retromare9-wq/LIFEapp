import { useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type Activity } from '../db'
import { fmtDuration, fmtShort, fmtWeekdayShort, todayKey } from '../lib/date'
import { DeleteHint, TopBar, confirmDelete, useProjectNames } from '../components/ui'
import { ActivityForm } from '../forms/ActivityForm'

export function ActivityItem({ a, deleteMode, onEdit, projectName }: { a: Activity; deleteMode?: boolean; onEdit: () => void; projectName?: string }) {
  const planned = a.date > todayKey()
  const click = async () => {
    if (!deleteMode) return onEdit()
    if (confirmDelete(a.title)) await db.activities.delete(a.id!)
  }
  const meta = [
    [a.timeFrom, a.timeTo].filter(Boolean).join('–'),
    fmtDuration(a.durationMinutes),
    projectName,
  ].filter(Boolean).join(' · ')
  return (
    <div className={`item ${deleteMode ? 'deletable' : ''}`} onClick={click} role="button">
      <span className="stripe" style={{ background: 'var(--violet)' }} />
      <div className="grow">
        <div className={`title ${planned ? 'muted' : ''}`}>{a.title}</div>
        {(meta || a.note) && (
          <div className="meta">
            {meta && <span className="num">{meta}</span>}
            {a.note && <div className="clamp">{a.note}</div>}
          </div>
        )}
      </div>
    </div>
  )
}

export default function Activities() {
  const today = todayKey()
  const [editing, setEditing] = useState<Activity | 'new'>()
  const [deleteMode, setDeleteMode] = useState(false)
  const projects = useProjectNames()
  const all = useLiveQuery(() => db.activities.toArray()) ?? []
  const planned = all.filter((a) => a.date > today)
    .sort((a, b) => `${a.date}${a.timeFrom ?? ''}`.localeCompare(`${b.date}${b.timeFrom ?? ''}`))
  const past = all.filter((a) => a.date <= today)
    .sort((a, b) => `${b.date}${b.timeFrom ?? ''}`.localeCompare(`${a.date}${a.timeFrom ?? ''}`))

  const byDay = new Map<string, Activity[]>()
  past.forEach((a) => byDay.set(a.date, [...(byDay.get(a.date) ?? []), a]))

  const item = (a: Activity) => (
    <ActivityItem key={a.id} a={a} deleteMode={deleteMode} onEdit={() => setEditing(a)} projectName={a.projectId ? projects.get(a.projectId) : undefined} />
  )

  return (
    <div className="page">
      <TopBar title="Aktivitäten" onAdd={() => setEditing('new')} deleteMode={deleteMode} onToggleDelete={() => setDeleteMode(!deleteMode)} />
      <DeleteHint active={deleteMode} />
      {planned.length > 0 && (
        <>
          <div className="section-title">Geplant</div>
          <div className="list">
            {planned.map((a, i) => (
              <div key={a.id}>
                {(i === 0 || planned[i - 1].date !== a.date) && <div className="small muted num" style={{ margin: '6px 0 4px' }}>{fmtWeekdayShort(a.date)} {fmtShort(a.date)}</div>}
                {item(a)}
              </div>
            ))}
          </div>
        </>
      )}
      {[...byDay.entries()].map(([day, items]) => {
        const total = items.reduce((s, a) => s + (a.durationMinutes ?? 0), 0)
        return (
          <div key={day}>
            <div className="section-title num">
              {day === today ? 'Heute' : `${fmtWeekdayShort(day)} ${fmtShort(day)}`} · {items.length}{total ? ` · ${fmtDuration(total)}` : ''}
            </div>
            <div className="list">{items.map(item)}</div>
          </div>
        )
      })}
      {!all.length && <div className="empty">Noch keine Aktivitäten. Mit + eintragen.</div>}
      {editing && <ActivityForm activity={editing === 'new' ? undefined : editing} onClose={() => setEditing(undefined)} />}
    </div>
  )
}
