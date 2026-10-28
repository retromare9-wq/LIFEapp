import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, nowIso, type Attachment, type OwnerType } from '../db'
import { IconCamera, IconMic, IconStop, IconX } from './Icons'

export interface DraftAttachment {
  id?: number
  kind: 'image' | 'audio'
  blob: Blob
}

export function useBlobUrl(blob?: Blob) {
  const [url, setUrl] = useState<string>()
  useEffect(() => {
    if (!blob) return
    const u = URL.createObjectURL(blob)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [blob])
  return url
}

function Preview({ a, onRemove }: { a: DraftAttachment; onRemove?: () => void }) {
  const url = useBlobUrl(a.blob)
  if (!url) return null
  return (
    <div style={{ position: 'relative' }}>
      {a.kind === 'image' ? (
        <img src={url} alt="" style={{ width: '100%', maxHeight: 320, objectFit: 'contain', borderRadius: 10, border: '1px solid var(--line)', display: 'block' }} />
      ) : (
        <audio src={url} controls style={{ width: '100%' }} />
      )}
      {onRemove && (
        <button type="button" className="icon-btn" aria-label="Anhang entfernen" onClick={onRemove}
          style={{ position: 'absolute', top: 6, right: 6, width: 32, height: 32 }}>
          <IconX />
        </button>
      )}
    </div>
  )
}

/** Photo (camera) + audio recording for an entry that is being edited. */
export function AttachmentEditor({ items, onChange }: { items: DraftAttachment[]; onChange: (v: DraftAttachment[]) => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const recorder = useRef<MediaRecorder | null>(null)
  const [recording, setRecording] = useState(false)
  const [error, setError] = useState<string>()
  const itemsRef = useRef(items)
  itemsRef.current = items

  const startRecording = async () => {
    setError(undefined)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const rec = new MediaRecorder(stream)
      const chunks: Blob[] = []
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data)
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        onChange([...itemsRef.current, { kind: 'audio', blob: new Blob(chunks, { type: rec.mimeType || 'audio/webm' }) }])
        setRecording(false)
      }
      rec.start()
      recorder.current = rec
      setRecording(true)
    } catch {
      setError('Mikrofon nicht verfügbar oder Zugriff verweigert.')
    }
  }

  useEffect(() => () => recorder.current?.stream.getTracks().forEach((t) => t.stop()), [])

  return (
    <div className="stack">
      <div className="row">
        <button type="button" className="btn small" onClick={() => fileRef.current?.click()}>
          <IconCamera /> Foto
        </button>
        {recording ? (
          <button type="button" className="btn small danger" onClick={() => recorder.current?.stop()}>
            <IconStop /> Aufnahme beenden
          </button>
        ) : (
          <button type="button" className="btn small" onClick={startRecording}>
            <IconMic /> Audio
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onChange([...items, { kind: 'image', blob: file }])
            e.target.value = ''
          }} />
      </div>
      {recording && <span className="small" style={{ color: 'var(--red)' }}>● Aufnahme läuft …</span>}
      {error && <span className="small" style={{ color: 'var(--red)' }}>{error}</span>}
      {items.map((a, i) => (
        <Preview key={a.id ?? `n${i}`} a={a} onRemove={() => onChange(items.filter((_, j) => j !== i))} />
      ))}
    </div>
  )
}

export function useAttachments(ownerType: OwnerType, ownerId?: number) {
  return useLiveQuery(
    () => (ownerId == null ? [] : db.attachments.where('[ownerType+ownerId]').equals([ownerType, ownerId]).toArray()),
    [ownerType, ownerId],
  )
}

/** Writes the edited attachment list: removes dropped ones, adds new ones. */
export async function saveAttachments(ownerType: OwnerType, ownerId: number, items: DraftAttachment[]) {
  const existing = await db.attachments.where('[ownerType+ownerId]').equals([ownerType, ownerId]).toArray()
  const keep = new Set(items.filter((a) => a.id != null).map((a) => a.id))
  await db.attachments.bulkDelete(existing.filter((a) => !keep.has(a.id)).map((a) => a.id!))
  const fresh: Attachment[] = items
    .filter((a) => a.id == null)
    .map((a) => ({ ownerType, ownerId, kind: a.kind, blob: a.blob, createdAt: nowIso() }))
  if (fresh.length) await db.attachments.bulkAdd(fresh)
}

export function AttachmentList({ ownerType, ownerId }: { ownerType: OwnerType; ownerId: number }) {
  const items = useAttachments(ownerType, ownerId) ?? []
  if (!items.length) return null
  return <div className="stack" style={{ marginTop: 8 }}>{items.map((a) => <Preview key={a.id} a={a} />)}</div>
}

export function AttachmentBadge({ ownerType, ownerId }: { ownerType: OwnerType; ownerId: number }) {
  const items = useAttachments(ownerType, ownerId) ?? []
  const images = items.filter((a) => a.kind === 'image').length
  const audios = items.length - images
  if (!items.length) return null
  return (
    <span className="tiny muted">
      {images > 0 && `📷 ${images}`} {audios > 0 && `🎙 ${audios}`}
    </span>
  )
}
