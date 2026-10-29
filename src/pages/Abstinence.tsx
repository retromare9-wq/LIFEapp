import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, type MonthImage, type Substance } from '../db'
import { addMonths, daysBetween, fmtLong, fmtMonthYear, monthDayKeys, monthKey, shiftKey, todayKey } from '../lib/date'
import { currentStreak, isCompleteDay, logKey } from '../lib/stats'
import { MOSAIC_COLS, MOSAIC_ROWS, MOSAIC_TILES, ensureMonthImage, revealedTiles, rerollMonthImage } from '../lib/mosaic'
import { TopBar, useSwipe } from '../components/ui'
import { RECOVERY_DAYS, computeRelapses, daysToRecovery } from '../lib/relapse'
import { IconCheck, IconChevronLeft, IconChevronRight, IconSettings, IconShuffle, SubstanceGlyph } from '../components/Icons'
import { useBlobUrl } from '../components/Attachments'

// Fallback picture (synthwave sunset) until the user uploads own images in the settings.
const DEFAULT_ART = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">
<defs>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#05001a"/><stop offset="1" stop-color="#3a0a4a"/></linearGradient>
<linearGradient id="sun" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd23f"/><stop offset=".55" stop-color="#ff3b6b"/><stop offset="1" stop-color="#b0128f"/></linearGradient>
</defs>
<rect width="400" height="300" fill="url(#sky)"/>
<g fill="#fff" opacity=".7"><circle cx="40" cy="30" r="1"/><circle cx="120" cy="60" r="1.2"/><circle cx="330" cy="40" r="1"/><circle cx="270" cy="90" r=".8"/><circle cx="70" cy="110" r=".8"/><circle cx="360" cy="120" r="1.1"/></g>
<circle cx="200" cy="165" r="80" fill="url(#sun)"/>
<g fill="#3a0a4a"><rect x="110" y="170" width="180" height="5"/><rect x="110" y="186" width="180" height="7"/><rect x="110" y="203" width="180" height="9"/></g>
<path d="M0 205 L60 160 L110 190 L170 140 L230 185 L290 150 L340 180 L400 155 L400 210 L0 210Z" fill="#12002a"/>
<rect y="205" width="400" height="95" fill="#05000f"/>
<g stroke="#ff2f8a" stroke-width="1.2" opacity=".9">
<line x1="0" y1="205" x2="400" y2="205"/><line x1="0" y1="214" x2="400" y2="214"/><line x1="0" y1="226" x2="400" y2="226"/>
<line x1="0" y1="243" x2="400" y2="243"/><line x1="0" y1="266" x2="400" y2="266"/><line x1="0" y1="298" x2="400" y2="298"/>
<line x1="200" y1="205" x2="200" y2="300"/><line x1="170" y1="205" x2="110" y2="300"/><line x1="230" y1="205" x2="290" y2="300"/>
<line x1="140" y1="205" x2="20" y2="300"/><line x1="260" y1="205" x2="380" y2="300"/><line x1="110" y1="205" x2="-70" y2="300"/>
<line x1="290" y1="205" x2="470" y2="300"/>
</g>
</svg>`)}`

function Mosaic({ entry, revealed }: { entry: MonthImage; revealed: number }) {
  const image = useLiveQuery(() => (entry.imageId != null ? db.abstinenceImages.get(entry.imageId) : undefined), [entry.imageId])
  const url = useBlobUrl(image?.blob)
  const visible = new Set(entry.order.slice(0, revealed))
  const complete = revealed >= MOSAIC_TILES
  return (
    <div className={`mosaic ${complete ? 'complete' : ''}`}
      style={{ backgroundImage: `url("${entry.imageId != null ? url ?? '' : DEFAULT_ART}")`, gridTemplateColumns: `repeat(${MOSAIC_COLS}, 1fr)`, gridTemplateRows: `repeat(${MOSAIC_ROWS}, 1fr)` }}>
      {Array.from({ length: MOSAIC_TILES }, (_, i) => <div key={i} className={visible.has(i) ? 'open' : ''} />)}
    </div>
  )
}

function DayCircles({ s, days, logs, today, onToggle }: { s: Substance; days: string[]; logs: Set<string>; today: string; onToggle: (d: string) => void }) {
  return (
    <div className="day-circles">
      {days.map((d) => {
        const disabled = d > today || d < s.startDate
        return (
          <button key={d} disabled={disabled} aria-label={d} onClick={() => onToggle(d)}
            className={`circle ${logs.has(logKey(s.id!, d)) ? 'on' : ''} ${d === today ? 'today' : ''}`}
            style={{ opacity: disabled ? 0.25 : 1 }}>
            <span className="tiny num">{Number(d.slice(8))}</span>
          </button>
        )
      })}
    </div>
  )
}

async function toggleAbstinence(substanceId: number, date: string) {
  const existing = await db.abstinenceLogs.where('[substanceId+date]').equals([substanceId, date]).first()
  if (existing) await db.abstinenceLogs.delete(existing.id!)
  else await db.abstinenceLogs.add({ substanceId, date })
}

export function AbstinencePage() {
  const today = todayKey()
  const [day, setDay] = useState(today)
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1))
  const mKey = monthKey(month)
  const days = monthDayKeys(month)
  const swipe = useSwipe(() => setMonth((m) => addMonths(m, -1)), () => setMonth((m) => addMonths(m, 1)))
  const [entry, setEntry] = useState<MonthImage>()

  const data = useLiveQuery(async () => {
    const [substances, logs] = await Promise.all([db.substances.orderBy('order').toArray(), db.abstinenceLogs.toArray()])
    return { substances, logs: new Set(logs.map((l) => logKey(l.substanceId, l.date))) }
  })
  const imageCount = useLiveQuery(() => db.abstinenceImages.count()) ?? 0
  const storedEntry = useLiveQuery(() => db.monthImages.get(mKey), [mKey])

  useEffect(() => {
    ensureMonthImage(mKey).then(setEntry)
  }, [mKey, imageCount, storedEntry?.imageId])

  const [openReason, setOpenReason] = useState<number>()
  const substances = data?.substances ?? []
  const logs = data?.logs ?? new Set<string>()
  // Running relapse phase per substance → abstinent days still needed to leave it.
  const phaseBySubstance = new Map<number, number>()
  let totalRelapses = 0
  for (const s of substances) {
    const confirmed = new Set([...logs].filter((k) => k.startsWith(`${s.id}|`)).map((k) => k.split('|')[1]))
    const relapses = computeRelapses(s, confirmed, today)
    totalRelapses += relapses.length
    const running = relapses.find((r) => !r.phaseEnd)
    if (running) phaseBySubstance.set(s.id!, daysToRecovery(running, confirmed, today))
  }
  const activeOnDay = substances.filter((s) => s.startDate <= day)
  const completeDays = days.filter((d) => d <= today && isCompleteDay(substances, logs, d)).length

  return (
    <div className="page">
      <TopBar title="Abstinenz">
        <Link to="/einstellungen#abstinenz" className="icon-btn" aria-label="Substanzen einstellen"><IconSettings /></Link>
      </TopBar>

      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
        <button className="icon-btn" aria-label="Vortag" onClick={() => setDay(shiftKey(day, -1))}><IconChevronLeft /></button>
        <div style={{ textAlign: 'center' }}>
          <div className="small muted">Frei von:</div>
          <strong className="num">{day === today ? 'Heute' : fmtLong(day)}</strong>
        </div>
        <button className="icon-btn" aria-label="Folgetag" disabled={day >= today} onClick={() => setDay(shiftKey(day, 1))}><IconChevronRight /></button>
      </div>

      {!substances.length && (
        <div className="card small">Noch keine Substanzen festgelegt. <Link to="/einstellungen#abstinenz" style={{ color: 'var(--accent)' }}>In den Einstellungen anlegen →</Link></div>
      )}
      <div className="list">
        {activeOnDay.map((s) => {
          const on = logs.has(logKey(s.id!, day))
          const relapse = phaseBySubstance.get(s.id!)
          return (
            <div key={s.id} className={`abst-btn ${on ? 'on' : ''}`}>
              <div className="row" style={{ width: '100%', gap: 14 }}>
                <SubstanceGlyph icon={s.icon} size={30} />
                <button className="grow abst-name" onClick={() => setOpenReason(openReason === s.id ? undefined : s.id)} aria-expanded={openReason === s.id}>
                  {s.name}
                  {relapse && <span className="tiny" style={{ display: 'block', color: 'var(--rel-mid)' }}>Rückfallphase · noch {relapse} Tag{relapse === 1 ? '' : 'e'}</span>}
                  {s.reason && <span className="tiny muted" style={{ display: 'block' }}>{openReason === s.id ? '▴ Warum' : '▾ Warum'}</span>}
                </button>
                <button className="circle-big" aria-label={`Frei von ${s.name} bestätigen`} aria-pressed={on} onClick={() => toggleAbstinence(s.id!, day)}
                  style={on ? { background: 'var(--grad)', borderColor: 'transparent' } : undefined}>{on && <IconCheck />}</button>
              </div>
              {openReason === s.id && (
                <div className="pre small" style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--line)', fontWeight: 400 }}>
                  {s.reason || <span className="muted">Noch kein Text. In den Einstellungen bei der Substanz eintragen.</span>}
                </div>
              )}
            </div>
          )
        })}
        {substances.length > 0 && !activeOnDay.length && <div className="small muted">An diesem Tag lief noch kein Tracking.</div>}
      </div>

      <div className="section-title row" style={{ justifyContent: 'space-between' }}>
        <span>Gesamt – komplette Abstinenz</span>
      </div>
      <div {...swipe} style={{ touchAction: 'pan-y' }}>
        <div className="row" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
          <button className="icon-btn" aria-label="Vorheriger Monat" onClick={() => setMonth(addMonths(month, -1))}><IconChevronLeft /></button>
          <div style={{ textAlign: 'center' }}>
            <strong style={{ textTransform: 'capitalize' }}>{fmtMonthYear(month)}</strong>
            <div className="tiny muted num">{completeDays} / {days.length} Tage</div>
          </div>
          <button className="icon-btn" aria-label="Nächster Monat" onClick={() => setMonth(addMonths(month, 1))}><IconChevronRight /></button>
        </div>
        {entry && entry.month === mKey && <Mosaic entry={entry} revealed={revealedTiles(completeDays, days.length)} />}
        <div className="row" style={{ justifyContent: 'space-between', marginTop: 6 }}>
          <span className="tiny muted">{imageCount ? `${imageCount} eigene Bilder im Pool` : 'Eigene Bilder in den Einstellungen hochladen'}</span>
          {imageCount > 1 && (
            <button className="chip" onClick={() => rerollMonthImage(mKey).then(() => ensureMonthImage(mKey)).then(setEntry)}>
              <IconShuffle /> anderes Bild
            </button>
          )}
        </div>

        {substances.map((s) => {
          const dates = new Set([...logs].filter((k) => k.startsWith(`${s.id}|`)).map((k) => k.split('|')[1]))
          const inMonth = days.filter((d) => dates.has(d)).length
          return (
            <div key={s.id} className="card" style={{ marginTop: 14 }}>
              <div className="row" style={{ marginBottom: 10 }}>
                <SubstanceGlyph icon={s.icon} />
                <strong className="grow">{s.name}</strong>
                <span className="tiny muted num">Streak {currentStreak(dates, today)} · gesamt {dates.size}</span>
              </div>
              <DayCircles s={s} days={days} logs={logs} today={today} onToggle={(d) => toggleAbstinence(s.id!, d)} />
              <div className="row" style={{ justifyContent: 'space-between', marginTop: 10 }}>
                <span className="tiny muted num">{inMonth} / {days.length} in diesem Monat</span>
                <Link to={`/abstinenz/${s.id}/jahr`} className="chip">Jahresübersicht →</Link>
              </div>
            </div>
          )
        })}
      </div>
      {substances.length > 0 && (
        <Link to="/abstinenz/rueckfaelle" className="btn" style={{ width: '100%', marginTop: 20 }}>
          Rückfälle ansehen{totalRelapses ? ` (${totalRelapses})` : ''}
        </Link>
      )}
    </div>
  )
}

export function SubstanceYear() {
  const { id } = useParams()
  const substanceId = Number(id)
  const today = todayKey()
  const [year, setYear] = useState(new Date().getFullYear())
  const swipe = useSwipe(() => setYear((y) => y - 1), () => setYear((y) => y + 1))
  const substance = useLiveQuery(() => db.substances.get(substanceId), [substanceId])
  const dates = useLiveQuery(async () => new Set((await db.abstinenceLogs.where('substanceId').equals(substanceId).toArray()).map((l) => l.date)), [substanceId]) ?? new Set<string>()
  const yearCount = [...dates].filter((d) => d.startsWith(`${year}-`)).length

  return (
    <div className="page" {...swipe}>
      <TopBar title={substance ? `Frei von ${substance.name}` : 'Jahresübersicht'} />
      <div className="row" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <button className="icon-btn" aria-label="Vorjahr" onClick={() => setYear(year - 1)}><IconChevronLeft /></button>
        <div style={{ textAlign: 'center' }}>
          <strong className="num">{year}</strong>
          <div className="tiny muted num">{yearCount} abstinente Tage</div>
        </div>
        <button className="icon-btn" aria-label="Folgejahr" onClick={() => setYear(year + 1)}><IconChevronRight /></button>
      </div>
      <div className="stack">
        {Array.from({ length: 12 }, (_, m) => {
          const keys = monthDayKeys(new Date(year, m, 1))
          return (
            <div key={m} className="year-row">
              <span className="tiny muted" style={{ textTransform: 'capitalize' }}>{fmtMonthYear(new Date(year, m, 1)).slice(0, 3)}</span>
              <div className="year-dots">
                {keys.map((d) => (
                  <span key={d} title={d} className={`ydot ${dates.has(d) ? 'on' : ''} ${d > today || (substance && d < substance.startDate) ? 'off' : ''}`} />
                ))}
              </div>
              <span className="tiny num muted" style={{ width: 22, textAlign: 'right' }}>{keys.filter((d) => dates.has(d)).length}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export function RelapsesPage() {
  const today = todayKey()
  const data = useLiveQuery(async () => {
    const [substances, logs] = await Promise.all([db.substances.orderBy('order').toArray(), db.abstinenceLogs.toArray()])
    return substances.map((s) => {
      const confirmed = new Set(logs.filter((l) => l.substanceId === s.id).map((l) => l.date))
      const relapses = computeRelapses(s, confirmed, today)
      const running = relapses.find((r) => !r.phaseEnd)
      return { s, relapses: [...relapses].reverse(), remaining: running ? daysToRecovery(running, confirmed, today) : 0 }
    })
  }) ?? []

  return (
    <div className="page">
      <TopBar title="Rückfälle" />
      <p className="small muted" style={{ marginTop: 0 }}>
        Jeder vergangene Tag ohne Bestätigung zählt als nicht abstinent. Ein Rückfall startet eine Rückfallphase, die nach
        {` ${RECOVERY_DAYS} `}abstinenten Tagen in Folge endet. Vergessene Tage kannst du im Abstinenz-Bereich nachtragen.
      </p>
      {data.map(({ s, relapses, remaining }) => (
        <div key={s.id} className="card" style={{ marginBottom: 14 }}>
          <div className="row" style={{ marginBottom: 8 }}>
            <SubstanceGlyph icon={s.icon} />
            <strong className="grow">{s.name}</strong>
            <span className="tiny muted num">{relapses.length} Rückfall{relapses.length === 1 ? '' : 'e'}</span>
          </div>
          {remaining > 0 && (
            <div className="small" style={{ color: 'var(--rel-mid)', marginBottom: 8 }}>
              In der Rückfallphase – noch {remaining} abstinente{remaining === 1 ? 'r' : ''} Tag{remaining === 1 ? '' : 'e'} bis zum Ende.
            </div>
          )}
          {!relapses.length && <div className="small muted">Kein Rückfall seit {fmtLong(s.startDate)}. 💪</div>}
          <div className="list">
            {relapses.map((r) => {
              const duration = daysBetween(r.start, r.lastMiss) + 1
              return (
                <div key={r.start} className="item" style={{ minHeight: 0 }}>
                  <span className="stripe" style={{ background: r.phaseEnd ? 'var(--faint)' : 'var(--rel-mid)' }} />
                  <div className="grow">
                    <div className="title num">{fmtLong(r.start)}{duration > 1 ? ` – ${fmtLong(r.lastMiss)}` : ''}</div>
                    <div className="meta num">
                      Dauer {duration} Tag{duration === 1 ? '' : 'e'}
                      {r.missedDays !== duration ? ` (${r.missedDays} nicht abstinent)` : ''}
                      {' · '}Rückfallphase {r.phaseEnd ? `bis ${fmtLong(r.phaseEnd)}` : 'läuft'} ({r.phaseDays} Tage)
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
