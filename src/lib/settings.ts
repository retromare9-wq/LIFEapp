import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db'

export const DAY_SHEET_FIELDS = [
  { key: 'todos', label: 'To-Dos (mit Erledigt-Markierung)' },
  { key: 'appointments', label: 'Termine & Events' },
  { key: 'activities', label: 'Anzahl Aktivitäten' },
  { key: 'activityList', label: 'Liste der Aktivitäten' },
  { key: 'habits', label: 'Anzahl erfüllter Habits' },
  { key: 'abstinence', label: 'Abstinenz ja/nein' },
  { key: 'mood', label: 'Gefühlsbuch-Eintrag ja/nein' },
  { key: 'dream', label: 'Traumbuch-Eintrag ja/nein' },
  { key: 'reading', label: 'Gelesene Seiten' },
  { key: 'notes', label: 'Ideen & Notizen des Tages' },
  { key: 'money', label: 'Geld ausgegeben (Finanzbuch folgt)' },
] as const

export type DaySheetField = (typeof DAY_SHEET_FIELDS)[number]['key']

export const DEFAULT_DAY_SHEET: Record<DaySheetField, boolean> = {
  todos: true,
  appointments: true,
  activities: true,
  activityList: false,
  habits: true,
  abstinence: true,
  mood: true,
  dream: true,
  reading: true,
  notes: false,
  money: false,
}

export const SETTING_DAY_SHEET = 'daySheet'
/** Tags that decide which uploaded image gets picked for a new month. */
export const SETTING_IMAGE_TAGS = 'imageTags'

export function useSetting<T>(key: string, fallback: T): T {
  const row = useLiveQuery(() => db.settings.get(key), [key])
  return (row?.value as T | undefined) ?? fallback
}

export function saveSetting(key: string, value: unknown) {
  return db.settings.put({ key, value })
}

export function useDaySheetConfig() {
  const stored = useSetting<Partial<Record<DaySheetField, boolean>>>(SETTING_DAY_SHEET, {})
  return { ...DEFAULT_DAY_SHEET, ...stored }
}
