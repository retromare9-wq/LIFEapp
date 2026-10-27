import { useEffect, useState } from 'react'
import { db, deleteAttachments, nowIso, rememberTags, type Dream, type Mood, type MoodLevel, type Note, type NoteKind, type OwnerType } from '../db'
import { DateTimeFields, ProjectSelect, Sheet, TagInput, confirmDelete } from '../components/ui'
import { AttachmentEditor, saveAttachments, type DraftAttachment } from '../components/Attachments'
import { timeNow, todayKey } from '../lib/date'

export const MOODS: { value: MoodLevel; label: string }[] = [
  { value: 5, label: 'super' },
  { value: 4, label: 'gut' },
  { value: 3, label: 'okay' },
  { value: 2, label: 'schlecht' },
  { value: 1, label: 'sehr schlecht' },
]
export const moodLabel = (m: MoodLevel) => MOODS.find((x) => x.value === m)!.label

function useDraftAttachments(ownerType: OwnerType, ownerId?: number) {
  const [items, setItems] = useState<DraftAttachment[]>([])
  useEffect(() => {
    if (ownerId == null) return
    db.attachments.where('[ownerType+ownerId]').equals([ownerType, ownerId]).toArray()
      .then((rows) => setItems(rows.map((r) => ({ id: r.id, kind: r.kind, blob: r.blob }))))
  }, [ownerType, ownerId])
  return [items, setItems] as const
}

function Actions({ onDelete, onClose, onSave, canSave }: { onDelete?: () => void; onClose: () => void; onSave: () => void; canSave: boolean }) {
  return (
    <div className="sheet-actions">
      {onDelete && <button className="btn danger" onClick={onDelete}>Löschen</button>}
      <button className="btn ghost" onClick={() => onClose()}>Abbrechen</button>
      <button className="btn primary" onClick={onSave} disabled={!canSave}>Speichern</button>
    </div>
  )
}

export function NoteForm({ note, initial, onClose }: { note?: Note; initial?: Partial<Note>; onClose: (saved?: boolean) => void }) {
  const [n, setN] = useState<Partial<Note>>(note ?? { kind: 'note', text: '', tags: [], date: todayKey(), time: timeNow(), ...initial })
  const [files, setFiles] = useDraftAttachments('note', note?.id)
  const set = (patch: Partial<Note>) => setN((prev) => ({ ...prev, ...patch }))
  const canSave = !!n.text?.trim() || files.length > 0

  const save = async () => {
    if (!canSave) return
    const data = {
      kind: n.kind ?? 'note', text: n.text?.trim() ?? '', projectId: n.projectId,
      tags: n.tags ?? [], date: n.date ?? todayKey(), time: n.date ? n.time : undefined,
    }
    const id = note?.id ?? (await db.notes.add({ ...data, createdAt: nowIso() }))
    if (note?.id != null) await db.notes.update(note.id, data)
    await rememberTags('note', data.tags)
    await saveAttachments('note', id as number, files)
    onClose(true)
  }
  const remove = async () => {
    if (note?.id == null || !confirmDelete(note.kind === 'idea' ? 'Idee' : 'Notiz')) return
    await db.notes.delete(note.id)
    await deleteAttachments('note', note.id)
    onClose()
  }

  return (
    <Sheet title={note ? 'Eintrag bearbeiten' : n.kind === 'idea' ? 'Neue Idee' : 'Neue Notiz'} onClose={onClose}>
      <div className="stack">
        <div className="row">
          {(['note', 'idea'] as NoteKind[]).map((k) => (
            <button key={k} type="button" className={`btn small grow ${n.kind === k ? 'primary' : ''}`} onClick={() => set({ kind: k })}>
              {k === 'note' ? 'Notiz' : 'Idee'}
            </button>
          ))}
        </div>
        <textarea autoFocus={!n.text} style={{ minHeight: 160 }} placeholder="Text …" value={n.text ?? ''} onChange={(e) => set({ text: e.target.value })} />
        <ProjectSelect value={n.projectId} onChange={(projectId) => set({ projectId })} />
        <TagInput scope="note" value={n.tags ?? []} onChange={(tags) => set({ tags })} />
        <AttachmentEditor items={files} onChange={setFiles} />
        <DateTimeFields dateLabel="Datum" date={n.date} time={n.time} onDate={(date) => set({ date })} onTime={(time) => set({ time })} />
      </div>
      <Actions onDelete={note ? remove : undefined} onClose={onClose} onSave={save} canSave={canSave} />
    </Sheet>
  )
}

export function MoodForm({ mood, initial, onClose }: { mood?: Mood; initial?: Partial<Mood>; onClose: (saved?: boolean) => void }) {
  const [m, setM] = useState<Partial<Mood>>(mood ?? { text: '', date: todayKey(), time: timeNow(), ...initial })
  const [files, setFiles] = useDraftAttachments('mood', mood?.id)
  const set = (patch: Partial<Mood>) => setM((prev) => ({ ...prev, ...patch }))
  const canSave = m.mood != null

  const save = async () => {
    if (!canSave) return
    const data = { text: m.text?.trim() ?? '', mood: m.mood!, date: m.date ?? todayKey(), time: m.date ? m.time : undefined }
    const id = mood?.id ?? (await db.moods.add({ ...data, createdAt: nowIso() }))
    if (mood?.id != null) await db.moods.update(mood.id, data)
    await saveAttachments('mood', id as number, files)
    onClose(true)
  }
  const remove = async () => {
    if (mood?.id == null || !confirmDelete('Gefühlseintrag')) return
    await db.moods.delete(mood.id)
    await deleteAttachments('mood', mood.id)
    onClose()
  }

  return (
    <Sheet title={mood ? 'Gefühl bearbeiten' : 'Neuer Gefühlseintrag'} onClose={onClose}>
      <div className="stack">
        <div className="field" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="small muted">Stimmung</span>
          <div className="row" style={{ gap: 6 }}>
            {MOODS.map((x) => (
              <button key={x.value} type="button" className={`grow mood-${x.value}`} aria-pressed={m.mood === x.value}
                onClick={() => set({ mood: x.value })}
                style={{
                  minHeight: 54, borderRadius: 10, border: '2px solid var(--mood)', fontSize: 12, padding: 2,
                  background: m.mood === x.value ? 'var(--mood)' : 'transparent', color: m.mood === x.value ? '#000' : 'var(--mood)',
                  fontWeight: 600,
                }}>
                {x.label}
              </button>
            ))}
          </div>
        </div>
        <textarea autoFocus={!m.text} style={{ minHeight: 160 }} placeholder="Wie fühlst du dich?" value={m.text ?? ''} onChange={(e) => set({ text: e.target.value })} />
        <AttachmentEditor items={files} onChange={setFiles} />
        <DateTimeFields dateLabel="Datum" date={m.date} time={m.time} onDate={(date) => set({ date })} onTime={(time) => set({ time })} />
      </div>
      <Actions onDelete={mood ? remove : undefined} onClose={onClose} onSave={save} canSave={canSave} />
    </Sheet>
  )
}

export function DreamForm({ dream, initial, onClose }: { dream?: Dream; initial?: Partial<Dream>; onClose: (saved?: boolean) => void }) {
  const [d, setD] = useState<Partial<Dream>>(dream ?? { text: '', tags: [], date: todayKey(), ...initial })
  const [files, setFiles] = useDraftAttachments('dream', dream?.id)
  const set = (patch: Partial<Dream>) => setD((prev) => ({ ...prev, ...patch }))
  const canSave = !!d.text?.trim() || files.length > 0

  const save = async () => {
    if (!canSave) return
    const data = { text: d.text?.trim() ?? '', tags: d.tags ?? [], date: d.date ?? todayKey(), time: d.date ? d.time : undefined }
    const id = dream?.id ?? (await db.dreams.add({ ...data, createdAt: nowIso() }))
    if (dream?.id != null) await db.dreams.update(dream.id, data)
    await rememberTags('dream', data.tags)
    await saveAttachments('dream', id as number, files)
    onClose(true)
  }
  const remove = async () => {
    if (dream?.id == null || !confirmDelete('Traum')) return
    await db.dreams.delete(dream.id)
    await deleteAttachments('dream', dream.id)
    onClose()
  }

  return (
    <Sheet title={dream ? 'Traum bearbeiten' : 'Neuer Traum'} onClose={onClose}>
      <div className="stack">
        <textarea autoFocus={!d.text} style={{ minHeight: 180 }} placeholder="Was hast du geträumt?" value={d.text ?? ''} onChange={(e) => set({ text: e.target.value })} />
        <TagInput scope="dream" value={d.tags ?? []} onChange={(tags) => set({ tags })} />
        <AttachmentEditor items={files} onChange={setFiles} />
        <DateTimeFields dateLabel="Datum" date={d.date} time={d.time} onDate={(date) => set({ date })} onTime={(time) => set({ time })} />
      </div>
      <Actions onDelete={dream ? remove : undefined} onClose={onClose} onSave={save} canSave={canSave} />
    </Sheet>
  )
}
