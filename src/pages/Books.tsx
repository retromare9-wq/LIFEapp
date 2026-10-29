import { useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, nowIso, rememberTags, type Book, type BookStatus, type ReadingLog } from '../db'
import { fmtShort, todayKey } from '../lib/date'
import { DeleteHint, RewardToggle, Sheet, TagInput, TopBar, confirmDelete } from '../components/ui'
import { IconPlus } from '../components/Icons'
import { byOrder, currentPage, pageFromPercent, recomputeBook } from '../lib/reading'

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
  const [start, setStart] = useState<{ page?: number; percent?: number }>({ page: book?.startPage })
  const startPage = start.percent != null ? (b.totalPages ? Math.round((b.totalPages * start.percent) / 100) : undefined) : start.page
  const save = async () => {
    if (!b.title?.trim()) return
    const data = {
      title: b.title.trim(), author: b.author?.trim() ?? '', tags: b.tags ?? [], status: b.status ?? 'planned',
      startDate: b.startDate || undefined, endDate: b.endDate || undefined,
      totalPages: b.totalPages || undefined, rating: b.status === 'finished' ? b.rating : undefined, noReward: !!b.noReward,
      startPage: startPage || undefined,
    }
    if (book?.id != null) {
      await db.books.update(book.id, data)
      await recomputeBook(book.id)
    } else await db.books.add({ ...data, createdAt: nowIso() })
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
        <PositionInput label="Einstieg: schon gelesen bis … (optional)" totalPages={b.totalPages} value={start} onChange={setStart} />
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

type PositionMode = 'page' | 'percent'

/** Page or percentage (e-books); percent needs the book's page count to be converted. */
export function PositionInput({ label, totalPages, value, onChange, extraMode }: {
  label: string
  totalPages?: number
  value: { page?: number; percent?: number }
  onChange: (v: { page?: number; percent?: number }) => void
  extraMode?: { label: string; active: boolean; onSelect: () => void }
}) {
  const [mode, setMode] = useState<PositionMode>(value.percent != null ? 'percent' : 'page')
  const active = extraMode?.active ? null : mode
  const shown = mode === 'percent' ? value.percent : value.page
  return (
    <div className="field" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span className="small muted">{label}</span>
      <div className="row" style={{ gap: 6 }}>
        <button type="button" className={`btn small grow ${active === 'page' ? 'primary' : ''}`} onClick={() => { setMode('page'); onChange({ page: value.page }) }}>Seite</button>
        <button type="button" className={`btn small grow ${active === 'percent' ? 'primary' : ''}`} onClick={() => { setMode('percent'); onChange({ percent: value.percent }) }}>Prozent</button>
        {extraMode && <button type="button" className={`btn small grow ${extraMode.active ? 'primary' : ''}`} onClick={extraMode.onSelect}>{extraMode.label}</button>}
      </div>
      {!extraMode?.active && (
        <div className="row">
          <input type="number" inputMode="decimal" min={0} max={mode === 'percent' ? 100 : undefined} value={shown ?? ''}
            placeholder={mode === 'percent' ? 'z. B. 37' : 'z. B. 120'}
            onChange={(e) => {
              const n = e.target.value === '' ? undefined : Number(e.target.value)
              onChange(mode === 'percent' ? { percent: n } : { page: n })
            }} />
          <span className="muted">{mode === 'percent' ? '%' : totalPages ? `von ${totalPages}` : ''}</span>
        </div>
      )}
      {!extraMode?.active && mode === 'percent' && !totalPages && (
        <span className="tiny" style={{ color: 'var(--rel-mid)' }}>Für Prozent bitte beim Buch die Seitenzahl eintragen (Bearbeiten).</span>
      )}
    </div>
  )
}

export function ReadingLogForm({ book, log, initialDate, onClose }: { book: Book; log?: ReadingLog; initialDate?: string; onClose: (saved?: boolean) => void }) {
  const [date, setDate] = useState(log?.date ?? initialDate ?? todayKey())
  const [thoughts, setThoughts] = useState(log?.thoughts ?? '')
  const [countMode, setCountMode] = useState(log != null && log.position == null && log.pages > 0)
  const [pages, setPages] = useState<number | undefined>(log?.position == null ? log?.pages || undefined : undefined)
  const [pos, setPos] = useState<{ page?: number; percent?: number }>(
    log?.percent != null ? { percent: log.percent } : { page: log?.position },
  )
  const logs = useLiveQuery(() => db.readingLogs.where('bookId').equals(book.id!).toArray(), [book.id]) ?? []

  // Position before this session: everything ordered before it (a new entry goes last on its day).
  const others = logs.filter((l) => l.id !== log?.id)
  const before = others.filter((l) => byOrder(l, { ...(log ?? { createdAt: '\uffff' }), date } as ReadingLog) < 0)
  const prev = currentPage(book, before)
  const position = pos.percent != null ? pageFromPercent(book, pos.percent) : pos.page
  const read = countMode ? pages ?? 0 : position != null ? Math.max(0, position - prev) : 0
  const canSave = (countMode ? !!pages : position != null) || !!thoughts.trim()

  const save = async () => {
    if (!canSave) return
    const data = {
      bookId: book.id!, date, thoughts: thoughts.trim() || undefined,
      pages: read,
      position: countMode ? undefined : position,
      percent: countMode ? undefined : pos.percent,
    }
    if (log?.id != null) await db.readingLogs.update(log.id, data)
    else await db.readingLogs.add({ ...data, createdAt: nowIso() })
    await recomputeBook(book.id!)
    // Reading a wish-list book starts it.
    if (book.status === 'planned') await db.books.update(book.id!, { status: 'reading', startDate: book.startDate ?? date })
    onClose(true)
  }
  const remove = async () => {
    if (log?.id == null || !confirmDelete('Leseeintrag')) return
    await db.readingLogs.delete(log.id)
    await recomputeBook(book.id!)
    onClose()
  }
  return (
    <Sheet title={log ? 'Leseeintrag bearbeiten' : `Gelesen: ${book.title}`} onClose={onClose}>
      <div className="stack">
        <label className="field">Datum<input type="date" value={date} onChange={(e) => setDate(e.target.value || todayKey())} /></label>
        <PositionInput label={`Wo bist du jetzt? (bisher: Seite ${prev}${book.totalPages ? ` von ${book.totalPages}` : ''})`}
          totalPages={book.totalPages} value={pos} onChange={(v) => { setCountMode(false); setPos(v) }}
          extraMode={{ label: 'Anzahl Seiten', active: countMode, onSelect: () => setCountMode(true) }} />
        {countMode && (
          <label className="field">Gelesene Seiten
            <input type="number" inputMode="numeric" min={0} autoFocus value={pages ?? ''} onChange={(e) => setPages(Number(e.target.value) || undefined)} />
          </label>
        )}
        {!countMode && position != null && (
          <div className="small" style={{ color: position < prev ? 'var(--rel-mid)' : 'var(--mood-5)' }}>
            {position < prev ? `Seite ${position} liegt vor der bisherigen Seite ${prev} – es werden 0 Seiten gezählt.` : `= ${read} Seiten gelesen`}
          </div>
        )}
        <label className="field">Gedanken (optional)
          <textarea style={{ minHeight: 110 }} value={thoughts} onChange={(e) => setThoughts(e.target.value)} />
        </label>
      </div>
      <div className="sheet-actions">
        {log && <button className="btn danger" onClick={remove}>Löschen</button>}
        <button className="btn ghost" onClick={() => onClose()}>Abbrechen</button>
        <button className="btn primary" onClick={save} disabled={!canSave}>Speichern</button>
      </div>
    </Sheet>
  )
}

/** Entry point from a "Lesen" activity/to-do: pick the book, then log the progress. */
export function ReadingEntry() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const date = params.get('date') ?? todayKey()
  const books = useLiveQuery(() => db.books.filter((b) => b.status === 'reading' || b.status === 'planned').toArray())
  const [picked, setPicked] = useState<Book>()
  const reading = (books ?? []).filter((b) => b.status === 'reading')
  const planned = (books ?? []).filter((b) => b.status === 'planned')
  const [adding, setAdding] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  // With exactly one book in progress the form opens right away.
  const chosen = picked ?? (reading.length === 1 && !adding && !dismissed ? reading[0] : undefined)
  const pickBtn = (b: Book) => (
    <button key={b.id} className="item" onClick={() => setPicked(b)}>
      <div className="grow">{b.author && <div className="meta">{b.author}</div>}<div className="title">{b.title}</div></div>
    </button>
  )
  return (
    <div className="page">
      <TopBar title="Was hast du gelesen?" />
      <div className="section-title">Lese ich gerade</div>
      <div className="list">{reading.map(pickBtn)}</div>
      {books && !reading.length && <div className="small muted">Kein Buch in Arbeit.</div>}
      {planned.length > 0 && <div className="section-title">Von der Wunschliste beginnen</div>}
      <div className="list">{planned.map(pickBtn)}</div>
      <button className="btn ghost" style={{ width: '100%', marginTop: 14 }} onClick={() => setAdding(true)}><IconPlus /> Neues Buch</button>
      {chosen && !adding && <ReadingLogForm book={chosen} initialDate={date} onClose={(saved) => { if (saved) navigate(-1); else { setPicked(undefined); setDismissed(true) } }} />}
      {adding && <BookForm onClose={() => setAdding(false)} />}
    </div>
  )
}

function usePagesByBook() {
  return useLiveQuery(async () => {
    const map = new Map<number, number>()
    ;(await db.readingLogs.toArray()).forEach((l) => map.set(l.bookId, (map.get(l.bookId) ?? 0) + (l.pages || 0)))
    return map
  }) ?? new Map<number, number>()
}

function BookItem({ b, pages, deleteMode, onLog }: { b: Book; pages: number; deleteMode?: boolean; onLog?: () => void }) {
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
          {pages > 0 && <span className="num">{pages} Seiten gelesen</span>}
          {b.status === 'reading' && b.totalPages ? <span className="num">{pages > 0 ? ' · ' : ''}S. {(b.startPage ?? 0) + pages}/{b.totalPages}</span> : null}
          {b.tags.length > 0 && <span> · {b.tags.map((t) => `#${t}`).join(' ')}</span>}
        </div>
        {b.status === 'finished' && b.rating && <Stars value={b.rating} size={16} />}
      </div>
      {onLog && !deleteMode && (
        <button className="icon-btn" aria-label="Lesefortschritt eintragen" onClick={(e) => { e.stopPropagation(); onLog() }}><IconPlus /></button>
      )}
    </div>
  )
}

export function BooksPage() {
  const [adding, setAdding] = useState(false)
  const [deleteMode, setDeleteMode] = useState(false)
  const [logging, setLogging] = useState<Book>()
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
      <div className="list">{reading.map((b) => <BookItem key={b.id} b={b} pages={pages.get(b.id!) ?? 0} deleteMode={deleteMode} onLog={() => setLogging(b)} />)}</div>
      {!reading.length && <div className="small muted">Gerade kein Buch in Arbeit.</div>}
      <div className="section-title">Wunschliste</div>
      <div className="list">{planned.map((b) => <BookItem key={b.id} b={b} pages={pages.get(b.id!) ?? 0} deleteMode={deleteMode} />)}</div>
      {!planned.length && <div className="small muted">Noch nichts auf der Wunschliste.</div>}
      {adding && <BookForm onClose={() => setAdding(false)} />}
      {logging && <ReadingLogForm book={logging} onClose={() => setLogging(undefined)} />}
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
  const page = currentPage(book, logs)
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
        <div className="row" style={{ gap: 8, alignItems: 'baseline' }}>
          <span className="muted small">Seite</span>
          <span className="num" style={{ fontSize: 22 }}>{page}</span>
          {book.totalPages ? <span className="muted small">von {book.totalPages} ({Math.round((100 * page) / book.totalPages)} %)</span> : null}
        </div>
        {book.totalPages ? <div className="progress"><div style={{ width: `${Math.min(100, (100 * page) / book.totalPages)}%` }} /></div> : null}
        <div className="small muted num">{total} Seiten in der App erfasst{book.startPage ? ` · Einstieg bei Seite ${book.startPage}` : ''}</div>
        {(book.status === 'reading' || book.status === 'planned') && (
          <button className="btn primary" onClick={() => setLogForm('new')}><IconPlus /> Lesefortschritt eintragen</button>
        )}
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
              <div className="meta num">
                {fmtShort(l.date)}{l.pages ? ` · ${l.pages} Seiten` : ''}
                {l.percent != null ? ` · bis ${l.percent} %` : l.position != null ? ` · bis Seite ${l.position}` : ''}
              </div>
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
