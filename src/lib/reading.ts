import { db, type Book, type ReadingLog } from '../db'

/** Activities/to-dos with "lesen" in the title lead into the reading log. */
export const isReadingTitle = (title: string) => /\blesen\b/i.test(title)

export const byOrder = (a: ReadingLog, b: ReadingLog) => `${a.date}${a.createdAt}`.localeCompare(`${b.date}${b.createdAt}`)

/** Page reached after all given sessions. */
export function currentPage(book: Book, logs: ReadingLog[]) {
  let pos = book.startPage ?? 0
  for (const l of [...logs].sort(byOrder)) pos = l.position ?? pos + (l.pages || 0)
  return pos
}

export const pageFromPercent = (book: Book, percent: number) =>
  book.totalPages ? Math.round((book.totalPages * percent) / 100) : undefined

/**
 * Re-derives the pages of every session from the reached positions, so editing or deleting
 * an earlier session keeps the following ones consistent.
 */
export async function recomputeBook(bookId: number) {
  const book = await db.books.get(bookId)
  if (!book) return
  const logs = (await db.readingLogs.where('bookId').equals(bookId).toArray()).sort(byOrder)
  let pos = book.startPage ?? 0
  for (const l of logs) {
    if (l.position == null) {
      pos += l.pages || 0
      continue
    }
    const pages = Math.max(0, l.position - pos)
    if (pages !== l.pages) await db.readingLogs.update(l.id!, { pages })
    pos = l.position
  }
}
