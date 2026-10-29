import type { Substance } from '../db'
import { daysBetween, shiftKey } from './date'

export const RECOVERY_DAYS = 7

export interface Relapse {
  /** first non-abstinent day */
  start: string
  /** last non-abstinent day of this relapse */
  lastMiss: string
  /** number of non-abstinent days within the relapse phase */
  missedDays: number
  /** day the 7th abstinent day after the last slip was reached; undefined = phase still running */
  phaseEnd?: string
  /** days spent in the relapse phase so far */
  phaseDays: number
  /** additional full weeks in the phase beyond the first one (for penalties) */
  extraWeeks: number
}

/**
 * Every past day (from the start date up to yesterday) without a confirmation counts as
 * not abstinent. A slip outside a relapse phase starts a new relapse; the phase ends after
 * 7 consecutive abstinent days. Further slips inside the phase belong to the same relapse.
 * Today only counts once it has been confirmed.
 */
export function computeRelapses(substance: Substance, confirmed: Set<string>, today: string): Relapse[] {
  const out: Relapse[] = []
  let current: Relapse | null = null
  let clean = 0
  for (let d = substance.startDate; d <= today; d = shiftKey(d, 1)) {
    const ok = confirmed.has(d)
    if (!ok && d === today) break
    if (!ok) {
      if (!current) {
        current = { start: d, lastMiss: d, missedDays: 0, phaseDays: 0, extraWeeks: 0 }
        out.push(current)
      }
      current.lastMiss = d
      current.missedDays++
      clean = 0
    } else if (current) {
      clean++
      if (clean >= RECOVERY_DAYS) {
        current.phaseEnd = d
        current = null
        clean = 0
      }
    }
  }
  for (const r of out) {
    r.phaseDays = daysBetween(r.start, r.phaseEnd ?? today) + 1
    r.extraWeeks = Math.max(0, Math.floor(r.phaseDays / 7) - 1)
  }
  return out
}

/** Abstinent days still needed to leave a running relapse phase. */
export function daysToRecovery(relapse: Relapse, confirmed: Set<string>, today: string) {
  let clean = 0
  for (let d = shiftKey(relapse.lastMiss, 1); d <= today; d = shiftKey(d, 1)) {
    if (confirmed.has(d)) clean++
  }
  return Math.max(0, RECOVERY_DAYS - clean)
}
