import { db, type MonthImage } from '../db'
import { SETTING_IMAGE_TAGS } from './settings'

export const MOSAIC_COLS = 12
export const MOSAIC_ROWS = 9
export const MOSAIC_TILES = MOSAIC_COLS * MOSAIC_ROWS

function shuffled(n: number) {
  const a = Array.from({ length: n }, (_, i) => i)
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

async function pickImage(month: string): Promise<number | null> {
  const images = await db.abstinenceImages.toArray()
  if (!images.length) return null
  const wanted = ((await db.settings.get(SETTING_IMAGE_TAGS))?.value as string[] | undefined) ?? []
  let pool = wanted.length ? images.filter((img) => img.tags.some((t) => wanted.includes(t))) : images
  if (!pool.length) pool = images
  // Avoid showing the same picture as in recent months when there is a choice.
  const recent = new Set(
    (await db.monthImages.where('month').below(month).reverse().limit(3).toArray()).map((m) => m.imageId),
  )
  const fresh = pool.filter((img) => !recent.has(img.id!))
  if (fresh.length) pool = fresh
  return pool[Math.floor(Math.random() * pool.length)].id!
}

/** Ensures a month has its surprise image; months without one get it as soon as images exist. */
export async function ensureMonthImage(month: string): Promise<MonthImage> {
  return db.transaction('rw', db.monthImages, db.abstinenceImages, db.settings, async () => {
    const existing = await db.monthImages.get(month)
    if (existing) {
      const stillValid =
        existing.imageId == null
          ? (await db.abstinenceImages.count()) === 0
          : (await db.abstinenceImages.get(existing.imageId)) != null
      if (stillValid) return existing
    }
    const entry: MonthImage = {
      month,
      imageId: await pickImage(month),
      order: existing?.order ?? shuffled(MOSAIC_TILES),
    }
    await db.monthImages.put(entry)
    return entry
  })
}

/** Picks a new random image for the month (keeps the reveal order). */
export async function rerollMonthImage(month: string) {
  const existing = await db.monthImages.get(month)
  await db.monthImages.put({
    month,
    imageId: await pickImage(month),
    order: existing?.order ?? shuffled(MOSAIC_TILES),
  })
}

export function revealedTiles(completeDays: number, daysInMonth: number) {
  return Math.min(MOSAIC_TILES, Math.round((MOSAIC_TILES * completeDays) / daysInMonth))
}
