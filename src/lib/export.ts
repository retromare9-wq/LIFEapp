import { zipSync, strToU8 } from 'fflate'
import { getISOWeek, getISOWeekYear } from 'date-fns'
import { ALL_TABLES, db, type Attachment, type OwnerType } from '../db'
import { fmtDateTime, fmtShort, fromKey, toKey, todayKey } from './date'
import { currentStreak } from './stats'

const MOOD_NAMES = ['', 'sehr schlecht', 'schlecht', 'okay', 'gut', 'super']
const REL_NAMES = { low: 'banal', mid: 'relevant', high: 'bedeutsam' } as const

const weekLabel = (key: string) => {
  const d = fromKey(key)
  return `KW ${String(getISOWeek(d)).padStart(2, '0')}/${getISOWeekYear(d)}`
}

/** Groups dated entries (oldest first) under calendar-week headings. */
function byWeek<T extends { date: string; time?: string }>(items: T[], render: (item: T) => string) {
  const sorted = [...items].sort((a, b) => `${a.date}${a.time ?? ''}`.localeCompare(`${b.date}${b.time ?? ''}`))
  let current = ''
  const out: string[] = []
  for (const item of sorted) {
    const w = weekLabel(item.date)
    if (w !== current) {
      out.push(`\n==================== ${w} ====================\n`)
      current = w
    }
    out.push(render(item))
  }
  return out.join('\n')
}

const extOf = (blob: Blob, kind: Attachment['kind']) => {
  const sub = blob.type.split('/')[1]?.split(';')[0]
  return sub ? (sub === 'jpeg' ? 'jpg' : sub) : kind === 'image' ? 'jpg' : 'webm'
}

/** All areas as readable text files (+ media folder), packed into one ZIP. */
export async function exportTextZip() {
  const files: Record<string, Uint8Array> = {}
  const today = todayKey()
  const [todos, activities, habits, habitLogs, substances, absLogs, notes, moods, dreams, projects, groups, attachments] =
    await Promise.all([
      db.todos.toArray(), db.activities.toArray(), db.habits.orderBy('order').toArray(), db.habitLogs.toArray(),
      db.substances.orderBy('order').toArray(), db.abstinenceLogs.toArray(), db.notes.toArray(), db.moods.toArray(),
      db.dreams.toArray(), db.projects.toArray(), db.projectGroups.toArray(), db.attachments.toArray(),
    ])
  const projectName = (id?: number) => (id == null ? '' : projects.find((p) => p.id === id)?.name ?? '')

  const media = (ownerType: OwnerType, ownerId: number) => {
    const list = attachments.filter((a) => a.ownerType === ownerType && a.ownerId === ownerId)
    return list.map((a) => {
      const name = `medien/${ownerType}-${ownerId}-${a.id}.${extOf(a.blob, a.kind)}`
      return `  [${a.kind === 'image' ? 'Foto' : 'Audio'}: ${name}]`
    }).join('\n')
  }
  for (const a of attachments) {
    files[`medien/${a.ownerType}-${a.ownerId}-${a.id}.${extOf(a.blob, a.kind)}`] = new Uint8Array(await a.blob.arrayBuffer())
  }

  const todoLine = (t: (typeof todos)[number]) =>
    `[${t.done ? 'x' : ' '}] ${t.title}  (${REL_NAMES[t.relevance]}${t.isAppointment ? ', Termin' : ''}${t.date ? `, ${fmtDateTime(t.date, t.time)}` : ''}${t.projectId ? `, Projekt: ${projectName(t.projectId)}` : ''})`
  files['todos.txt'] = strToU8([
    'TO-DOS – OFFEN', '', ...todos.filter((t) => !t.done).map(todoLine), '',
    'TO-DOS – ERLEDIGT', '',
    ...todos.filter((t) => t.done).sort((a, b) => (a.doneAt ?? '').localeCompare(b.doneAt ?? ''))
      .map((t) => `${t.doneAt ? fmtShort(toKey(new Date(t.doneAt))) : ''}  ${todoLine(t)}`),
  ].join('\n'))

  files['aktivitaeten.txt'] = strToU8('AKTIVITÄTEN\n' + byWeek(activities, (a) =>
    `${fmtShort(a.date)} ${[a.timeFrom, a.timeTo].filter(Boolean).join('–')}  ${a.title}${a.done ? '' : ' (geplant)'}${a.projectId ? `  [Projekt: ${projectName(a.projectId)}]` : ''}${a.note ? `\n  ${a.note}` : ''}`))

  files['habits.txt'] = strToU8('HABITS\n\n' + habits.map((h) => {
    const dates = new Set(habitLogs.filter((l) => l.habitId === h.id).map((l) => l.date))
    return `${h.name}\n  eingetragen: ${fmtShort(h.createdAt)} | gesamt: ${dates.size} | Streak: ${currentStreak(dates, today)}\n  Tage: ${[...dates].sort().map(fmtShort).join(', ')}`
  }).join('\n\n'))

  files['abstinenz.txt'] = strToU8('ABSTINENZ\n\n' + substances.map((s) => {
    const dates = new Set(absLogs.filter((l) => l.substanceId === s.id).map((l) => l.date))
    return `Frei von ${s.name}\n  Start: ${fmtShort(s.startDate)} | abstinente Tage: ${dates.size} | Streak: ${currentStreak(dates, today)}\n  Tage: ${[...dates].sort().map(fmtShort).join(', ')}`
  }).join('\n\n'))

  const noteText = (n: (typeof notes)[number]) =>
    `--- ${fmtDateTime(n.date, n.time)}${n.projectId ? ` | Projekt: ${projectName(n.projectId)}` : ''}${n.tags.length ? ` | ${n.tags.map((t) => `#${t}`).join(' ')}` : ''}\n${n.text}\n${media('note', n.id!)}`
  files['notizen.txt'] = strToU8('NOTIZEN\n' + byWeek(notes.filter((n) => n.kind === 'note'), noteText))
  files['ideen.txt'] = strToU8('IDEEN\n' + byWeek(notes.filter((n) => n.kind === 'idea'), noteText))

  files['gefuehlsbuch.txt'] = strToU8('GEFÜHLSBUCH\n' + byWeek(moods, (m) =>
    `--- ${fmtDateTime(m.date, m.time)} | Stimmung: ${MOOD_NAMES[m.mood]}\n${m.text}\n${media('mood', m.id!)}`))

  files['traumbuch.txt'] = strToU8('TRAUMBUCH\n' + byWeek(dreams, (d) =>
    `--- ${fmtDateTime(d.date, d.time)}${d.tags.length ? ` | ${d.tags.map((t) => `#${t}`).join(' ')}` : ''}\n${d.text}\n${media('dream', d.id!)}`))

  files['projekte.txt'] = strToU8('PROJEKTE\n\n' + projects.map((p) => {
    const pt = todos.filter((t) => t.projectId === p.id)
    const pct = pt.length ? Math.round((100 * pt.filter((t) => t.done).length) / pt.length) : 0
    const lines = [`${p.name}  [${{ active: 'aktiv', done: 'abgeschlossen', cancelled: 'abgebrochen' }[p.status]}, ${pct} %]`,
      `  ${fmtShort(p.startDate)}${p.endDate ? ` – ${fmtShort(p.endDate)}` : ''}`]
    if (p.description) lines.push(`  ${p.description}`)
    const pg = groups.filter((g) => g.projectId === p.id)
    pt.filter((t) => !pg.some((g) => g.id === t.groupId)).forEach((t) => lines.push(`  ${todoLine(t)}`))
    pg.forEach((g) => {
      lines.push(`  # ${g.name}`)
      pt.filter((t) => t.groupId === g.id).forEach((t) => lines.push(`    ${todoLine(t)}`))
    })
    return lines.join('\n')
  }).join('\n\n'))

  download(new Blob([zipSync(files) as BlobPart], { type: 'application/zip' }), `lifeapp-export-${today}.zip`)
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(r.result as string)
    r.onerror = () => reject(r.error)
    r.readAsDataURL(blob)
  })
}

async function dataUrlToBlob(url: string) {
  return (await fetch(url)).blob()
}

/** Complete backup of all data (including photos/audio) as one JSON file. */
export async function exportBackup() {
  const out: Record<string, unknown[]> = {}
  for (const name of ALL_TABLES) {
    const rows = await db.table(name).toArray()
    out[name] = await Promise.all(rows.map(async (r: Record<string, unknown>) =>
      r.blob instanceof Blob ? { ...r, blob: await blobToDataUrl(r.blob) } : r))
  }
  const json = JSON.stringify({ app: 'lifeapp', version: 1, exportedAt: new Date().toISOString(), data: out })
  download(new Blob([json], { type: 'application/json' }), `lifeapp-backup-${todayKey()}.json`)
}

/** Replaces all data with the content of a backup file. */
export async function importBackup(file: File) {
  const parsed = JSON.parse(await file.text())
  if (parsed?.app !== 'lifeapp' || !parsed.data) throw new Error('Keine gültige LIFEapp-Sicherung.')
  const data = parsed.data as Record<string, Record<string, unknown>[]>
  const prepared: Record<string, Record<string, unknown>[]> = {}
  for (const name of ALL_TABLES) {
    prepared[name] = await Promise.all((data[name] ?? []).map(async (r) =>
      typeof r.blob === 'string' ? { ...r, blob: await dataUrlToBlob(r.blob) } : r))
  }
  await db.transaction('rw', ALL_TABLES.map((n) => db.table(n)), async () => {
    for (const name of ALL_TABLES) {
      await db.table(name).clear()
      if (prepared[name].length) await db.table(name).bulkAdd(prepared[name])
    }
  })
}

function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}
