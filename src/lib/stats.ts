import type { Substance } from '../db'
import { shiftKey } from './date'

/**
 * Current streak: consecutive tracked days ending today, or ending yesterday
 * while today is still open (so the streak doesn't drop to 0 in the morning).
 */
export function currentStreak(dates: Set<string>, today: string) {
  let day = dates.has(today) ? today : shiftKey(today, -1)
  let streak = 0
  while (dates.has(day)) {
    streak++
    day = shiftKey(day, -1)
  }
  return streak
}

/** Substances whose tracking had started on `day`. */
export function activeSubstances(substances: Substance[], day: string) {
  return substances.filter((s) => s.startDate <= day)
}

/** A day counts as completely abstinent when every substance tracked on that day is confirmed. */
export function isCompleteDay(substances: Substance[], logs: Set<string>, day: string) {
  const active = activeSubstances(substances, day)
  return active.length > 0 && active.every((s) => logs.has(`${s.id}|${day}`))
}

export const logKey = (substanceId: number, day: string) => `${substanceId}|${day}`
