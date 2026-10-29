import { getISOWeek, getISOWeekYear } from 'date-fns'
import { db } from '../db'
import { fromKey, todayKey } from './date'
import { computeRelapses } from './relapse'

export const REWARD_RULES = [
  { key: 'todo_low', label: 'To-Do/Termin/Event – banal', km: 1, credits: 1 },
  { key: 'todo_mid', label: 'To-Do/Termin/Event – relevant', km: 5, credits: 5 },
  { key: 'todo_high', label: 'To-Do/Termin/Event – bedeutsam', km: 10, credits: 10 },
  { key: 'activity', label: 'Pro Aktivität', km: 1, credits: 1 },
  { key: 'pages10', label: 'Pro 10 gelesene Seiten', km: 5, credits: 5 },
  { key: 'book_finished', label: 'Buch zu Ende gelesen', km: 50, credits: 50 },
  { key: 'habit_done', label: 'Pro erledigtes Habit', km: 1, credits: 1 },
  { key: 'habit_week', label: 'Habit-Wochenziel erreicht', km: 5, credits: 5 },
  { key: 'abstinence_day', label: 'Pro Abstinenztag und Substanz', km: 5, credits: 5 },
  { key: 'relapse', label: 'Pro Rückfall und Substanz', km: -100, credits: -100 },
  { key: 'relapse_week', label: 'Jede weitere Woche in der Rückfallphase', km: -50, credits: -50 },
] as const

export type RewardKey = (typeof REWARD_RULES)[number]['key']
export type RewardValues = Record<RewardKey, { km: number; credits: number }>
export const SETTING_REWARDS = 'rewards'

export const DEFAULT_REWARDS = Object.fromEntries(
  REWARD_RULES.map((r) => [r.key, { km: r.km, credits: r.credits }]),
) as RewardValues

export const weekId = (day: string) => {
  const d = fromKey(day)
  return `${getISOWeekYear(d)}-${getISOWeek(d)}`
}

export interface RewardLine {
  key: RewardKey
  label: string
  count: number
  km: number
  credits: number
}

/** Everything is computed from the stored data, so past entries count as well. */
export async function computeRewards(): Promise<{ lines: RewardLine[]; km: number; credits: number }> {
  const today = todayKey()
  const stored = ((await db.settings.get(SETTING_REWARDS))?.value ?? {}) as Partial<RewardValues>
  const values = { ...DEFAULT_REWARDS, ...stored }
  const [todos, activities, books, readingLogs, habits, habitLogs, substances, absLogs] = await Promise.all([
    db.todos.filter((t) => t.done && !t.noReward).toArray(),
    db.activities.filter((a) => !a.noReward && a.fromTodoId == null && a.date <= today).toArray(),
    db.books.toArray(),
    db.readingLogs.toArray(),
    db.habits.toArray(),
    db.habitLogs.toArray(),
    db.substances.toArray(),
    db.abstinenceLogs.toArray(),
  ])

  const counts: Record<RewardKey, number> = Object.fromEntries(REWARD_RULES.map((r) => [r.key, 0])) as Record<RewardKey, number>
  for (const t of todos) counts[`todo_${t.relevance}` as RewardKey]++
  counts.activity = activities.length

  const rewardBooks = new Set(books.filter((b) => !b.noReward).map((b) => b.id))
  const pages = readingLogs.filter((l) => rewardBooks.has(l.bookId)).reduce((sum, l) => sum + (l.pages || 0), 0)
  counts.pages10 = Math.floor(pages / 10)
  counts.book_finished = books.filter((b) => b.status === 'finished' && !b.noReward).length

  const habitIds = new Set(habits.map((h) => h.id))
  const validHabitLogs = habitLogs.filter((l) => habitIds.has(l.habitId))
  counts.habit_done = validHabitLogs.length
  for (const h of habits) {
    const perWeek = new Map<string, number>()
    validHabitLogs.filter((l) => l.habitId === h.id).forEach((l) => perWeek.set(weekId(l.date), (perWeek.get(weekId(l.date)) ?? 0) + 1))
    counts.habit_week += [...perWeek.values()].filter((n) => n >= (h.weeklyTarget || 7)).length
  }

  for (const s of substances) {
    const confirmed = new Set(absLogs.filter((l) => l.substanceId === s.id && l.date >= s.startDate).map((l) => l.date))
    counts.abstinence_day += confirmed.size
    const relapses = computeRelapses(s, confirmed, today)
    counts.relapse += relapses.length
    counts.relapse_week += relapses.reduce((sum, r) => sum + r.extraWeeks, 0)
  }

  const lines = REWARD_RULES.map((r) => ({
    key: r.key, label: r.label, count: counts[r.key],
    km: counts[r.key] * values[r.key].km, credits: counts[r.key] * values[r.key].credits,
  }))
  return {
    lines,
    km: lines.reduce((s, l) => s + l.km, 0),
    credits: lines.reduce((s, l) => s + l.credits, 0),
  }
}
