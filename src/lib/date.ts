import { addDays, format, parseISO, startOfWeek, getDaysInMonth } from 'date-fns'
import { de } from 'date-fns/locale'

export const toKey = (d: Date) => format(d, 'yyyy-MM-dd')
export const fromKey = (key: string) => parseISO(key)
export const todayKey = () => toKey(new Date())
export const shiftKey = (key: string, days: number) => toKey(addDays(fromKey(key), days))
export const monthKey = (d: Date) => format(d, 'yyyy-MM')

/** TT.MM.JJ */
export const fmtShort = (key: string) => format(fromKey(key), 'dd.MM.yy')
/** TT.MM.JJJJ */
export const fmtLong = (key: string) => format(fromKey(key), 'dd.MM.yyyy')
/** TT.MM. */
export const fmtDayMonth = (key: string) => format(fromKey(key), 'dd.MM.')
export const fmtWeekday = (key: string) => format(fromKey(key), 'EEEE', { locale: de })
export const fmtWeekdayShort = (key: string) => format(fromKey(key), 'EEEEEE', { locale: de })
export const fmtMonthYear = (d: Date) => format(d, 'LLLL yyyy', { locale: de })

export const WEEKDAYS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

/** Keys Monday…Sunday of the week containing `key`. */
export function weekKeys(key: string) {
  const start = startOfWeek(fromKey(key), { weekStartsOn: 1 })
  return Array.from({ length: 7 }, (_, i) => toKey(addDays(start, i)))
}

/** All day keys of the month of `d`. */
export function monthDayKeys(d: Date) {
  const first = new Date(d.getFullYear(), d.getMonth(), 1)
  return Array.from({ length: getDaysInMonth(first) }, (_, i) => toKey(addDays(first, i)))
}

/** Calendar grid for a month: leading nulls so the first day lands on its weekday (Mo first). */
export function monthGrid(d: Date): (string | null)[] {
  const days = monthDayKeys(d)
  const lead = (fromKey(days[0]).getDay() + 6) % 7
  const cells: (string | null)[] = [...Array(lead).fill(null), ...days]
  while (cells.length % 7) cells.push(null)
  return cells
}

export function addMonths(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth() + n, 1)
}

export function timeNow() {
  return format(new Date(), 'HH:mm')
}

/** "TT.MM.JJ, HH:mm" with optional time */
export function fmtDateTime(date?: string, time?: string) {
  if (!date) return ''
  return time ? `${fmtShort(date)}, ${time}` : fmtShort(date)
}
