import Dexie, { type EntityTable } from 'dexie'

// Dates are stored as local 'YYYY-MM-DD' strings, times as 'HH:mm'.

export type Relevance = 'low' | 'mid' | 'high'
export type TodoKind = 'todo' | 'appointment' | 'event'

export interface ChecklistItem {
  id: string
  text: string
  done: boolean
}

export interface Todo {
  id?: number
  title: string
  /** Only decides the km/credits reward. */
  relevance: Relevance
  kind: TodoKind
  color: string
  projectId?: number
  groupId?: number
  date?: string
  /** start time */
  time?: string
  /** end time (on endDate for multi-day events) */
  timeTo?: string
  /** last day of a multi-day event */
  endDate?: string
  budgetMinutes?: number
  checklist: ChecklistItem[]
  /** When completed, also log it as an activity of that day. */
  logAsActivity: boolean
  noReward?: boolean
  done: boolean
  doneAt?: string
  activityId?: number
  createdAt: string
  /** @deprecated replaced by kind (v1 data) */
  isAppointment?: boolean
}

export interface Activity {
  id?: number
  title: string
  date: string
  timeFrom?: string
  timeTo?: string
  durationMinutes?: number
  projectId?: number
  note?: string
  /** @deprecated activities count as done once their date has come (v1 data) */
  done?: boolean
  noReward?: boolean
  fromTodoId?: number
  createdAt: string
}

export interface Habit {
  id?: number
  name: string
  description?: string
  /** target completions per week (1–7) */
  weeklyTarget: number
  createdAt: string
  order: number
}

export interface HabitLog {
  id?: number
  habitId: number
  date: string
}

export type SubstanceIcon = 'cannabis' | 'smoking' | 'alcohol' | 'pill' | 'generic'

export interface Substance {
  id?: number
  name: string
  icon: SubstanceIcon
  startDate: string
  /** why staying abstinent matters */
  reason?: string
  order: number
}

export interface AbstinenceLog {
  id?: number
  substanceId: number
  date: string
}

export interface AbstinenceImage {
  id?: number
  blob: Blob
  tags: string[]
  createdAt: string
}

/** Image picked for a month plus the random order in which its tiles get uncovered. */
export interface MonthImage {
  month: string
  imageId: number | null
  order: number[]
}

export type NoteKind = 'note' | 'idea'

export interface Note {
  id?: number
  kind: NoteKind
  text: string
  projectId?: number
  tags: string[]
  date: string
  time?: string
  createdAt: string
}

export type OwnerType = 'note' | 'mood' | 'dream'

export interface Attachment {
  id?: number
  ownerType: OwnerType
  ownerId: number
  kind: 'image' | 'audio'
  blob: Blob
  createdAt: string
}

/** 1 = sehr schlecht … 5 = super */
export type MoodLevel = 1 | 2 | 3 | 4 | 5

export interface Mood {
  id?: number
  text: string
  mood: MoodLevel
  date: string
  time?: string
  createdAt: string
}

export interface Dream {
  id?: number
  text: string
  tags: string[]
  date: string
  time?: string
  createdAt: string
}

export type ProjectStatus = 'active' | 'done' | 'cancelled'

export interface Project {
  id?: number
  name: string
  description: string
  startDate: string
  endDate?: string
  status: ProjectStatus
  createdAt: string
}

export interface ProjectGroup {
  id?: number
  projectId: number
  name: string
  order: number
}

export type BookStatus = 'planned' | 'reading' | 'finished' | 'dnf'

export interface Book {
  id?: number
  title: string
  author: string
  tags: string[]
  status: BookStatus
  startDate?: string
  endDate?: string
  totalPages?: number
  /** 1–5, only for finished books */
  rating?: number
  noReward?: boolean
  createdAt: string
}

export interface ReadingLog {
  id?: number
  bookId: number
  date: string
  pages: number
  thoughts?: string
  createdAt: string
}

export type TagScope = 'note' | 'dream' | 'image' | 'book'

export interface Tag {
  id?: number
  scope: TagScope
  name: string
}

export interface Setting {
  key: string
  value: unknown
}

export const db = new Dexie('lifeapp') as Dexie & {
  todos: EntityTable<Todo, 'id'>
  activities: EntityTable<Activity, 'id'>
  habits: EntityTable<Habit, 'id'>
  habitLogs: EntityTable<HabitLog, 'id'>
  substances: EntityTable<Substance, 'id'>
  abstinenceLogs: EntityTable<AbstinenceLog, 'id'>
  abstinenceImages: EntityTable<AbstinenceImage, 'id'>
  monthImages: EntityTable<MonthImage, 'month'>
  notes: EntityTable<Note, 'id'>
  attachments: EntityTable<Attachment, 'id'>
  moods: EntityTable<Mood, 'id'>
  dreams: EntityTable<Dream, 'id'>
  projects: EntityTable<Project, 'id'>
  projectGroups: EntityTable<ProjectGroup, 'id'>
  tags: EntityTable<Tag, 'id'>
  settings: EntityTable<Setting, 'key'>
  books: EntityTable<Book, 'id'>
  readingLogs: EntityTable<ReadingLog, 'id'>
}

db.version(1).stores({
  todos: '++id, date, done, projectId, groupId, doneAt',
  activities: '++id, date, title, projectId',
  habits: '++id, order',
  habitLogs: '++id, habitId, date, &[habitId+date]',
  substances: '++id, order',
  abstinenceLogs: '++id, substanceId, date, &[substanceId+date]',
  abstinenceImages: '++id, *tags',
  monthImages: 'month',
  notes: '++id, date, kind, projectId, *tags',
  attachments: '++id, [ownerType+ownerId]',
  moods: '++id, date, mood',
  dreams: '++id, date, *tags',
  projects: '++id, status',
  projectGroups: '++id, projectId',
  tags: '++id, scope, &[scope+name]',
  settings: 'key',
})

const RELEVANCE_COLOR: Record<Relevance, string> = { low: 'lightblue', mid: 'orange', high: 'red' }

db.version(2).stores({
  books: '++id, status, *tags',
  readingLogs: '++id, bookId, date',
}).upgrade(async (tx) => {
  await tx.table('todos').toCollection().modify(normalizeTodo)
  await tx.table('habits').toCollection().modify(normalizeHabit)
  await tx.table('activities').toCollection().modify(normalizeActivity)
})

/** Brings rows written by app version 1 (database or backup file) into the current shape. Idempotent. */
export function normalizeTodo(t: Todo) {
  if (!t.kind) t.kind = t.isAppointment ? 'appointment' : 'todo'
  if (!t.color) t.color = RELEVANCE_COLOR[t.relevance] ?? 'lightblue'
  if (!t.checklist) t.checklist = []
  delete t.isAppointment
}
export function normalizeHabit(h: Habit) {
  if (!h.weeklyTarget) h.weeklyTarget = 7
}
export function normalizeActivity(a: Activity) {
  delete a.done
}

export const ALL_TABLES = [
  'todos', 'activities', 'habits', 'habitLogs', 'substances', 'abstinenceLogs',
  'abstinenceImages', 'monthImages', 'notes', 'attachments', 'moods', 'dreams',
  'projects', 'projectGroups', 'tags', 'settings', 'books', 'readingLogs',
] as const

export function nowIso() {
  return new Date().toISOString()
}

/** Adds tags to the suggestion list of a scope (ignores ones that already exist). */
export async function rememberTags(scope: TagScope, names: string[]) {
  for (const name of names) {
    const exists = await db.tags.where('[scope+name]').equals([scope, name]).first()
    if (!exists) await db.tags.add({ scope, name })
  }
}

export async function deleteAttachments(ownerType: OwnerType, ownerId: number) {
  await db.attachments.where('[ownerType+ownerId]').equals([ownerType, ownerId]).delete()
}

/** Marks a to-do done/undone and keeps the linked activity in sync. */
export async function setTodoDone(todo: Todo, done: boolean, today: string, durationMinutes?: number) {
  if (todo.id == null) return
  await db.transaction('rw', db.todos, db.activities, async () => {
    if (done) {
      let activityId = todo.activityId
      if (todo.logAsActivity && activityId == null) {
        activityId = await db.activities.add({
          title: todo.title,
          date: todo.date && todo.date < today ? todo.date : today,
          timeFrom: todo.time,
          timeTo: todo.timeTo,
          durationMinutes,
          projectId: todo.projectId,
          fromTodoId: todo.id,
          createdAt: nowIso(),
        })
      }
      await db.todos.update(todo.id!, { done: true, doneAt: nowIso(), activityId })
    } else {
      if (todo.activityId != null) await db.activities.delete(todo.activityId)
      await db.todos.update(todo.id!, { done: false, doneAt: undefined, activityId: undefined })
    }
  })
}
