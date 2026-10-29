import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, nowIso, rememberTags, type Book, type BookStatus, type ReadingLog } from '../db'
import { fmtShort, todayKey } from '../lib/date'
import { DeleteHint, RewardToggle, Sheet, TagInput, TopBar, confirmDelete } from '../components/ui'
import { IconPlus } from '../components/Icons'

const STATUS_LABEL: Record<BookStatus, string> = { planned: 'Wunschliste', reading: 'lese ich gerade', finished: 'gelesen', dnf: 'abgebrochen (DNF)' }

export function Stars({ value, onChange, size = 26 }: { value?: number; onChange?: (v: number) => void; size?: number }) {
  return (
    <span className="row" style={{ gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" disabled={!onChange} aria-label={`${n} Punkte`} onClick={() => onChange?.(n)}
          style={{ background: 'none', border: 'none', padding: 0, fontSize: size, lineHeight: 1, color: value && n <= value ? 'var(--mood-3)' : 'var(--faint)' }}>
          ★
        </button>
      ))}
    </span>
  )
}

export function BookForm({ book, initial, onClose }: { book?: Book; initial?: Partial<Book>; onClose: (saved?: boolean) => void }) {
  const [b, setB] = useState<Partial<Book>>(book ?? { title: '', author: '', tags: [], status: 'reading', startDate: todayKey(), ...initial })
  const set = (patch: Partial<Book>) => setB((prev) => ({ ...prev, ...patch }))
  const save = async () => {
    if (!b.title?.trim()) return
    const data = {
      title: b.title.trim(), author: b.author?.trim() ?? '', tags: b.tags ?? [], status: b.status ?? 'planned',
      startDate: b.startDate || undefined, endDate: b.endDate || undefined,
      totalPages: b.totalPages || undefined, rating: b.status === 'finished' ? b.rating : undefined, noReward: !!b.noReward,
    }
    if (book?.id != null) await db.books.update(book.id, data)
    else await db.books.add({ ...data, createdAt: nowIso() })
    await rememberTags('book', data.tags)
    onClose(true)
  }
  return (
    <Sheet title={book ? 'Buch bearbeiten' : 'Neues Buch'} onClose={onClose}>
      <div className="stack">
        {!book && (
          <div className="row">
            {(['reading', 'planned'] as BookStatus[]).map((s) => (
              <button key={s} type="button" className={`btn small grow ${b.status === s ? 'primary' : ''}`}
                onClick={() => set({ status: s, startDate: s === 'reading' ? b.startDate ?? todayKey() : undefined })}>
                {s === 'reading' ? 'Lese ich gerade' : 'Wunschliste'}
              </button>
            ))}
          </div>
        )}
        <label className="field">Titel<input type="text" autoFocus={!b.title} value={b.title ?? ''} onChange={(e) => set({ title: e.target.value })} /></label>
        <label className="field">Autor/in<input type="text" value={b.author ?? ''} onChange={(e) => set({ author: e.target.value })} /></label>
        <TagInput scope="book" value={b.tags ?? []} onChange={(tags) => set({ tags })} />
        <label className="field">Seitenzahl des Buchs (optional)
          <input type="number" inputMode="numeric" min={1} value={b.totalPages ?? ''} onChange={(e) => set({ totalPages: Number(e.target.value) || undefined })} />
        </label>
        <div className="row">
          <label className="field grow">Lesebeginn (optional)<input type="date" value={b.startDate ?? ''} onChange={(e) => set({ startDate: e.target.value || undefined })} /></label>
          <label className="field grow">Beendet am (optional)<input type="date" value={b.endDate ?? ''} onChange={(e) => set({ endDate: e.target.value || undefined })} /></label>
        </div>
        {book?.status === 'finished' && (
          <div className="field" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span className="small muted">Bewertung</span>
            <Stars value={b.rating} onChange={(rating) => set({ rating })} />
          </div>
        )}
        <RewardToggle noReward={b.noReward} onChange={(noReward) => set({ noReward })} />
      </div>
      <div className="sheet-actions">
        <button className="btn ghost" onClick={() => onClose()}>Abbrechen</button>
        <button className="btn primary" onClick={save} disabled={!b.title?.trim()}>Speichern</button>
      </div>
    </Sheet>
  )
}

function ReadingLogForm({ book, log, onClose }: { book: Book; log?: ReadingLog; onClose: () => void }) {
  const [l, setL] = useState<Partial<ReadingLog>>(log ?? { date: todayKey() })
  const save = async () => {
    if (!l.pages && !l.thoughts?.trim()) return
    const data = { bookId: book.id!, date: l.date || todayKey(), pages: l.pages ?? 0, thoughts: l.thoughts?.trim() || undefined }
    if (log?.id != null) await db.readingLogs.update(log.id, data)
    else await db.readingLogs.add({ ...data, createdAt: nowIso() })
    // Reading a wish-list book starts it.
    if (book.status === 'planned') await db.books.update(book.id!, { status: 'reading', startDate: book.startDate ?? data.date })
    onClose()
  }
  const remove = async () => {
    if (log?.id == null || !confirmDelete('Leseeintrag')) return
    await db.readingLogs.delete(log.id)
    onClose()
  }
  return (
    <Sheet title={log ? 'Leseeintrag bearbeiten' : 'Gelesen'} onClose={onClose}>
      <div className="stack">
        <div className="row">
          <label className="field grow">Datum<input type="date" value={l.date ?? ''} onChange={(e) => setL({ ...l, date: e.target.value })} /></label>
          <label className="field" style={{ width: 130 }}>Seiten
            <input type="number" inputMode="numeric" min={0} autoFocus value={l.pages ?? ''} onChange={(e) => setL({ ...l, pages: Number(e.target.value) || undefined })} />
          </label>
        </div>
        <label className="field">Gedanken (optional)
          <textarea style={{ minHeight: 120 }} value={l.thoughts ?? ''} onChange={(e) => setL({ ...l, thoughts: e.target.value })} />
        </label>
      </div>
      <div className="sheet-actions">
        {log && <button className="btn danger" onClick={remove}>Löschen</button>}
        <button className="btn ghost" onClick={onClose}>Abbrechen</button>
        <button className="btn primary" onClick={save} disabled={!l.pages && !l.thoughts?.trim()}>Speichern</button>
      </div>
    </Sheet>
  )
}

function usePagesByBook() {
  return useLiveQuery(async () => {
    const map = new Map<number, number>()
    ;(await db.readingLogs.toArray()).forEach((l) => map.set(l.bookId, (map.get(l.bookId) ?? 0) + (l.pages || 0)))
    return map
  }) ?? new Map<number, number>()
}

function BookItem({ b, pages, deleteMode }: { b: Book; pages: number; deleteMode?: boolean }) {
  const navigate = useNavigate()
  const click = async () => {
    if (!deleteMode) return navigate(`/lesen/${b.id}`)
    if (!confirmDelete(b.title)) return
    await db.readingLogs.where('bookId').equals(b.id!).delete()
    await db.books.delete(b.id!)
  }
  return (
    <div className={`item ${deleteMode ? 'deletable' : ''}`} role="button" onClick={click}>
      <span className="stripe" style={{ background: b.status === 'reading' ? 'var(--magenta)' : b.status === 'finished' ? 'var(--mood-5)' : b.status === 'dnf' ? 'var(--faint)' : 'var(--blue)' }} />
      <div className="grow">
        {b.author && <div className="meta">{b.author}</div>}
        <div className="title">{b.title}</div>
        <div className="meta">
          {b.status === 'reading' && b.startDate && <span className="num">seit {fmtShort(b.startDate)} · </span>}
          {(b.status === 'finished' || b.status === 'dnf') && b.endDate && <span className="num">{b.status === 'dnf' ? 'DNF ' : ''}{fmtShort(b.endDate)} · </span>}
          {pages > 0 && <span className="num">{pages}{b.totalPages ? ` / ${b.totalPages}` : ''} Seiten</span>}
          {b.tags.length > 0 && <span> · {b.tags.map((t) => `#${t}`).join(' ')}</span>}
        </div>
        {b.status === 'finished' && b.rating && <Stars value={b.rating} size={16} />}
      </div>
    </div>
  )
}

export function BooksPage() {
  const [adding, setAdding] = useState(false)
  const [deleteMode, setDeleteMode] = useState(false)
  const books = useLiveQuery(() => db.books.toArray()) ?? []
  const pages = usePagesByBook()
  const reading = books.filter((b) => b.status === 'reading').sort((a, b) => (b.startDate ?? '').localeCompare(a.startDate ?? ''))
  const planned = books.filter((b) => b.status === 'planned').sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  const doneCount = books.filter((b) => b.status === 'finished' || b.status === 'dnf').length

  return (
    <div className="page">
      <TopBar title="Lesen" onAdd={() => setAdding(true)} deleteMode={deleteMode} onToggleDelete={() => setDeleteMode(!deleteMode)} />
      <DeleteHint active={deleteMode} />
      <Link to="/lesen/gelesen" className="btn ghost small" style={{ marginBottom: 12 }}>Gelesene Bücher ({doneCount}) →</Link>
      <div className="section-title">Lese ich gerade</div>
      <div className="list">{reading.map((b) => <BookItem key={b.id} b={b} pages={pages.get(b.id!) ?? 0} deleteMode={deleteMode} />)}</div>
      {!reading.length && <div className="small muted">Gerade kein Buch in Arbeit.</div>}
      <div className="section-title">Wunschliste</div>
      <div className="list">{planned.map((b) => <BookItem key={b.id} b={b} pages={pages.get(b.id!) ?? 0} deleteMode={deleteMode} />)}</div>
      {!planned.length && <div className="small muted">Noch nichts auf der Wunschliste.</div>}
      {adding && <BookForm onClose={() => setAdding(false)} />}
    </div>
  )
}

export function BooksFinished() {
  const books = useLiveQuery(() => db.books.filter((b) => b.status === 'finished' || b.status === 'dnf').toArray()) ?? []
  const pages = usePagesByBook()
  const sorted = [...books].sort((a, b) => (b.endDate ?? '').localeCompare(a.endDate ?? ''))
  return (
    <div className="page">
      <TopBar title="Gelesene Bücher" />
      <div className="list">{sorted.map((b) => <BookItem key={b.id} b={b} pages={pages.get(b.id!) ?? 0} />)}</div>
      {!sorted.length && <div className="empty">Noch kein Buch beendet.</div>}
    </div>
  )
}

export function BookDetail() {
  const { id } = useParams()
  const bookId = Number(id)
  const [editing, setEditing] = useState(false)
  const [logForm, setLogForm] = useState<ReadingLog | 'new'>()
  const [finishing, setFinishing] = useState(false)
  const [rating, setRating] = useState<number>()
  const book = useLiveQuery(() => db.books.get(bookId), [bookId])
  const logs = useLiveQuery(() => db.readingLogs.where('bookId').equals(bookId).toArray(), [bookId]) ?? []
  if (!book) return <div className="page"><TopBar title="Buch" /></div>

  const total = logs.reduce((s, l) => s + (l.pages || 0), 0)
  const sorted = [...logs].sort((a, b) => `${b.date}${b.createdAt}`.localeCompare(`${a.date}${a.createdAt}`))
  const today = todayKey()
  const finish = async () => {
    await db.books.update(bookId, { status: 'finished', endDate: book.endDate ?? today, rating, startDate: book.startDate ?? logs[0]?.date })
    setFinishing(false)
  }
  const dnf = async () => {
    if (window.confirm(`„${book.title}“ abbrechen (DNF)?`)) await db.books.update(bookId, { status: 'dnf', endDate: today })
  }

  return (
    <div className="page">
      <TopBar title={book.title}>
        <button className="btn small ghost" onClick={() => setEditing(true)}>Bearbeiten</button>
      </TopBar>
      <div className="card stack">
        {book.author && <div className="muted">{book.author}</div>}
        <div className="small muted num">
          {STATUS_LABEL[book.status]}
          {book.startDate && ` · Beginn ${fmtShort(book.startDate)}`}
          {book.endDate && ` · Ende ${fmtShort(book.endDate)}`}
        </div>
        {book.tags.length > 0 && <div className="chips">{book.tags.map((t) => <span key={t} className="chip">#{t}</span>)}</div>}
        <div className="row" style={{ gap: 8 }}>
          <span className="num" style={{ fontSize: 22 }}>{total}</span>
          <span className="muted small">{book.totalPages ? `von ${book.totalPages} Seiten` : 'Seiten gelesen'}</span>
        </div>
        {book.totalPages ? <div className="progress"><div style={{ width: `${Math.min(100, (100 * total) / book.totalPages)}%` }} /></div> : null}
        {book.status === 'finished' && <Stars value={book.rating} onChange={(r) => db.books.update(bookId, { rating: r })} />}
        <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
          {book.status === 'planned' && <button className="btn small primary" onClick={() => db.books.update(bookId, { status: 'reading', startDate: book.startDate ?? today })}>Lesen beginnen</button>}
          {(book.status === 'reading' || book.status === 'planned') && <button className="btn small" onClick={() => { setRating(undefined); setFinishing(true) }}>Lesen beenden</button>}
          {(book.status === 'reading' || book.status === 'planned') && <button className="btn small ghost" onClick={dnf}>DNF</button>}
          {(book.status === 'finished' || book.status === 'dnf') && <button className="btn small ghost" onClick={() => db.books.update(bookId, { status: 'reading', endDate: undefined })}>Wieder lesen</button>}
        </div>
      </div>

      <div className="section-title row" style={{ justifyContent: 'space-between' }}>
        <span>Verlauf</span>
        <button className="chip" onClick={() => setLogForm('new')}><IconPlus /> Gelesen</button>
      </div>
      <div className="list">
        {sorted.map((l) => (
          <div key={l.id} className="item" role="button" onClick={() => setLogForm(l)} style={{ alignItems: 'flex-start' }}>
            <div className="grow">
              <div className="meta num">{fmtShort(l.date)}{l.pages ? ` · ${l.pages} Seiten` : ''}</div>
              {l.thoughts && <div className="pre">{l.thoughts}</div>}
            </div>
          </div>
        ))}
      </div>
      {!sorted.length && <div className="small muted">Noch keine Einträge. Trage täglich gelesene Seiten und Gedanken ein.</div>}

      {editing && <BookForm book={book} onClose={() => setEditing(false)} />}
      {logForm && <ReadingLogForm book={book} log={logForm === 'new' ? undefined : logForm} onClose={() => setLogForm(undefined)} />}
      {finishing && (
        <Sheet title="Buch beendet 🎉" onClose={() => setFinishing(false)}>
          <p className="small muted" style={{ marginTop: 0 }}>Wie viele Punkte gibst du „{book.title}“?</p>
          <Stars value={rating} onChange={setRating} size={36} />
          <div className="sheet-actions">
            <button className="btn ghost" onClick={() => setFinishing(false)}>Abbrechen</button>
            <button className="btn primary" onClick={finish}>Beenden</button>
          </div>
        </Sheet>
      )}
    </div>
  )
}
