import type { CSSProperties } from 'react'
import type { Todo, TodoKind } from '../db'
import { DONE_GREEN, colorValue } from './colors'
import { fmtDayMonth, fmtDuration, fmtShort } from './date'

export const KIND_LABEL: Record<TodoKind, string> = { todo: 'To-Do', appointment: 'Termin', event: 'Event' }
export const KIND_MARK: Record<TodoKind, string> = { todo: '', appointment: '◆ ', event: '▰ ' }

export const lastDay = (t: Todo) => (t.kind === 'event' && t.endDate && t.date && t.endDate > t.date ? t.endDate : t.date)

/** Whether a dated to-do shows up on `day` (multi-day events on every day of their span). */
export const coversDay = (t: Todo, day: string) => !!t.date && t.date <= day && lastDay(t)! >= day

/** Done appointments/events turn green, done to-dos are struck through. */
export function doneStyle(t: Todo): { className: string; style: CSSProperties } {
  if (!t.done) return { className: '', style: {} }
  if (t.kind === 'todo') return { className: 'done-text', style: {} }
  return { className: '', style: { color: DONE_GREEN } }
}

export const todoColor = (t: Todo) => (t.done && t.kind !== 'todo' ? DONE_GREEN : colorValue(t.color))

/** "27.10.26, 10:00–11:30" / "27.10.–30.10.26" / "Budget 30 min" */
export function todoWhen(t: Todo) {
  const parts: string[] = []
  if (t.date) {
    const end = lastDay(t)
    if (end && end !== t.date) {
      parts.push(`${fmtDayMonth(t.date)}${t.time ? ` ${t.time}` : ''} – ${fmtShort(end)}${t.timeTo ? ` ${t.timeTo}` : ''}`)
    } else {
      parts.push(`${fmtShort(t.date)}${t.time ? `, ${t.time}` : ''}${t.timeTo ? `–${t.timeTo}` : ''}`)
    }
  }
  if (t.budgetMinutes) parts.push(`⏱ ${fmtDuration(t.budgetMinutes)}`)
  return parts.join(' · ')
}

/** Time label inside a day column for `day`. */
export function timeOnDay(t: Todo, day: string) {
  const end = lastDay(t)
  if (end && end !== t.date) {
    if (day === t.date) return t.time ? `ab ${t.time}` : undefined
    if (day === end) return t.timeTo ? `bis ${t.timeTo}` : undefined
    return undefined
  }
  if (t.time && t.timeTo) return `${t.time}–${t.timeTo}`
  return t.time
}
