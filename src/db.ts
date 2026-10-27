import Dexie, { type EntityTable } from 'dexie'

// Dates are stored as local 'YYYY-MM-DD' strings, times as 'HH:mm'.

export type Relevance = 'low' | 'mid' | 'high'

export interface Todo {
  id?: number
  title: string
  relevance: Relevance
  projectId?: number
  groupId?: number
  date?: string
  time?: string
  isAppointment: boolean
  /** When completed, also log it as an activity of that day. */
  logAsActivity: boolean
  done: boolean
  doneAt?: string
  activityId?: number
  createdAt: string
}

export interface Activity {
  id?: number
  title: string
  date: string
  timeFrom?: string
  timeTo?: string
  projectId?: number
  note?: string
  /** false = planned and not yet done */
  done: boolean
  fromTodoId?: number
  createdAt: string
}

export interface Habit {
  id?: number
  name: string
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

export type TagScope = 'note' | 'dream' | 'image'

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

export const ALL_TABLES = [
  'todos', 'activities', 'habits', 'habitLogs', 'substances', 'abstinenceLogs',
  'abstinenceImages', 'monthImages', 'notes', 'attachments', 'moods', 'dreams',
  'projects', 'projectGroups', 'tags', 'settings',
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
export async function setTodoDone(todo: Todo, done: boolean, today: string) {
  if (todo.id == null) return
  await db.transaction('rw', db.todos, db.activities, async () => {
    if (done) {
      let activityId = todo.activityId
      if (todo.logAsActivity && activityId == null) {
        activityId = await db.activities.add({
          title: todo.title,
          date: todo.date && todo.date < today ? todo.date : today,
          timeFrom: todo.time,
          projectId: todo.projectId,
          done: true,
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
