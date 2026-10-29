import { useEffect, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, nowIso, rememberTags, type AbstinenceImage, type Substance } from '../db'
import { todayKey } from '../lib/date'
import { DAY_SHEET_FIELDS, SETTING_DAY_SHEET, SETTING_IMAGE_TAGS, saveSetting, useDaySheetConfig, useSetting } from '../lib/settings'
import { exportBackup, exportTextZip, importBackup } from '../lib/export'
import { Sheet, TagInput, TopBar, confirmDelete } from '../components/ui'
import { IconDownload, IconPlus, SUBSTANCE_ICONS, SubstanceGlyph } from '../components/Icons'
import { useBlobUrl } from '../components/Attachments'
import { DEFAULT_REWARDS, REWARD_RULES, SETTING_REWARDS, type RewardKey, type RewardValues } from '../lib/rewards'

function RewardSettings() {
  const stored = useSetting<Partial<RewardValues>>(SETTING_REWARDS, {})
  const values = { ...DEFAULT_REWARDS, ...stored }
  const update = (key: RewardKey, field: 'km' | 'credits', raw: string) =>
    saveSetting(SETTING_REWARDS, { ...values, [key]: { ...values[key], [field]: Number(raw) || 0 } })
  return (
    <div className="card">
      <div className="reward-row tiny muted"><span /><span>km</span><span>Credits</span></div>
      {REWARD_RULES.map((r) => (
        <div key={r.key} className="reward-row">
          <span className="small">{r.label}</span>
          <input type="number" inputMode="numeric" value={values[r.key].km} onChange={(e) => update(r.key, 'km', e.target.value)} />
          <input type="number" inputMode="numeric" value={values[r.key].credits} onChange={(e) => update(r.key, 'credits', e.target.value)} />
        </div>
      ))}
      <button className="btn ghost small" style={{ marginTop: 10 }} onClick={() => window.confirm('Alle Werte auf die Standardwerte zurücksetzen?') && saveSetting(SETTING_REWARDS, {})}>
        Standardwerte wiederherstellen
      </button>
    </div>
  )
}

/** Scales photos down before storing them, so the on-device database stays small. */
async function downscale(file: File, max = 1600): Promise<Blob> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b ?? file), 'image/jpeg', 0.85))
}

function SubstanceSheet({ substance, onClose }: { substance?: Substance; onClose: () => void }) {
  const [s, setS] = useState<Partial<Substance>>(substance ?? { name: '', icon: 'generic', startDate: todayKey() })
  const save = async () => {
    if (!s.name?.trim()) return
    const data = { name: s.name.trim(), icon: s.icon ?? 'generic', startDate: s.startDate || todayKey(), reason: s.reason?.trim() || undefined }
    if (substance?.id != null) await db.substances.update(substance.id, data)
    else await db.substances.add({ ...data, order: Date.now() })
    onClose()
  }
  const remove = async () => {
    if (substance?.id == null || !confirmDelete(substance.name)) return
    await db.abstinenceLogs.where('substanceId').equals(substance.id).delete()
    await db.substances.delete(substance.id)
    onClose()
  }
  return (
    <Sheet title={substance ? 'Substanz bearbeiten' : 'Neue Substanz'} onClose={onClose}>
      <div className="stack">
        <label className="field">Frei von …<input type="text" autoFocus={!substance} placeholder="z. B. Alkohol" value={s.name ?? ''} onChange={(e) => setS({ ...s, name: e.target.value })} /></label>
        <div className="field" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span className="small muted">Symbol</span>
          <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
            {SUBSTANCE_ICONS.map((i) => (
              <button key={i.value} type="button" className={`btn small ${s.icon === i.value ? 'primary' : ''}`} onClick={() => setS({ ...s, icon: i.value })}>
                <SubstanceGlyph icon={i.value} size={20} /> {i.label}
              </button>
            ))}
          </div>
        </div>
        <label className="field">Beginn der Abstinenz<input type="date" value={s.startDate ?? ''} onChange={(e) => setS({ ...s, startDate: e.target.value })} /></label>
        <label className="field">Warum ich abstinent bleiben möchte – was es mir bringt (optional)
          <textarea style={{ minHeight: 110 }} value={s.reason ?? ''} onChange={(e) => setS({ ...s, reason: e.target.value })} />
        </label>
      </div>
      <div className="sheet-actions">
        {substance && <button className="btn danger" onClick={remove}>Löschen</button>}
        <button className="btn ghost" onClick={onClose}>Abbrechen</button>
        <button className="btn primary" onClick={save} disabled={!s.name?.trim()}>Speichern</button>
      </div>
    </Sheet>
  )
}

function ImageTile({ img, onEdit }: { img: AbstinenceImage; onEdit: () => void }) {
  const url = useBlobUrl(img.blob)
  return (
    <button className="img-tile" onClick={onEdit} style={{ backgroundImage: url ? `url("${url}")` : undefined }}>
      {img.tags.length > 0 && <span className="tiny">{img.tags.map((t) => `#${t}`).join(' ')}</span>}
    </button>
  )
}

function ImageSheet({ img, onClose }: { img: AbstinenceImage; onClose: () => void }) {
  const [tags, setTags] = useState(img.tags)
  const url = useBlobUrl(img.blob)
  return (
    <Sheet title="Bild" onClose={onClose}>
      {url && <img src={url} alt="" style={{ width: '100%', borderRadius: 10, marginBottom: 12 }} />}
      <TagInput scope="image" value={tags} onChange={setTags} />
      <div className="sheet-actions">
        <button className="btn danger" onClick={async () => { if (confirmDelete('Bild')) { await db.abstinenceImages.delete(img.id!); onClose() } }}>Löschen</button>
        <button className="btn primary" onClick={async () => { await db.abstinenceImages.update(img.id!, { tags }); await rememberTags('image', tags); onClose() }}>Speichern</button>
      </div>
    </Sheet>
  )
}

export default function Settings() {
  const cfg = useDaySheetConfig()
  const substances = useLiveQuery(() => db.substances.orderBy('order').toArray()) ?? []
  const images = useLiveQuery(() => db.abstinenceImages.toArray()) ?? []
  const imageTags = useLiveQuery(async () => (await db.tags.where('scope').equals('image').toArray()).map((t) => t.name).sort()) ?? []
  const wantedTags = useSetting<string[]>(SETTING_IMAGE_TAGS, [])
  const [substanceSheet, setSubstanceSheet] = useState<Substance | 'new'>()
  const [imageSheet, setImageSheet] = useState<AbstinenceImage>()
  const [uploadTags, setUploadTags] = useState<string[]>([])
  const [busy, setBusy] = useState<string>()
  const [persisted, setPersisted] = useState<boolean>()
  const fileRef = useRef<HTMLInputElement>(null)
  const restoreRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted)
    if (location.hash.includes('abstinenz')) document.getElementById('abstinenz')?.scrollIntoView()
  }, [])

  const upload = async (files: FileList | null) => {
    if (!files?.length) return
    setBusy('Bilder werden gespeichert …')
    try {
      for (const f of Array.from(files)) {
        await db.abstinenceImages.add({ blob: await downscale(f), tags: uploadTags, createdAt: nowIso() })
      }
      await rememberTags('image', uploadTags)
    } finally {
      setBusy(undefined)
    }
  }

  const run = async (label: string, fn: () => Promise<void>) => {
    setBusy(label)
    try { await fn() } catch (e) { window.alert(`Fehler: ${(e as Error).message}`) } finally { setBusy(undefined) }
  }

  return (
    <div className="page">
      <TopBar title="Einstellungen" />

      <div className="section-title">Tagesblatt – angezeigte Infos</div>
      <div className="card">
        {DAY_SHEET_FIELDS.map((f) => (
          <label key={f.key} className="check">
            <input type="checkbox" checked={cfg[f.key]} onChange={(e) => saveSetting(SETTING_DAY_SHEET, { ...cfg, [f.key]: e.target.checked })} />
            {f.label}
          </label>
        ))}
      </div>

      <div className="section-title" id="abstinenz">Abstinenz – Substanzen</div>
      <div className="list">
        {substances.map((s) => (
          <button key={s.id} className="item" onClick={() => setSubstanceSheet(s)}>
            <SubstanceGlyph icon={s.icon} />
            <div className="grow"><div className="title">{s.name}</div><div className="meta num">seit {s.startDate.split('-').reverse().join('.')}</div></div>
          </button>
        ))}
        <button className="btn" onClick={() => setSubstanceSheet('new')}><IconPlus /> Substanz hinzufügen</button>
      </div>

      <div className="section-title">Abstinenz – Bilder für das Monats-Mosaik</div>
      <div className="card stack">
        <p className="small muted" style={{ margin: 0 }}>
          Für jeden Monat wird zufällig ein Bild aus deinem Pool gewählt und mit jedem komplett abstinenten Tag weiter aufgedeckt.
          Gib Bildern Tags (z. B. Pazifik, Kanada) und wähle unten, aus welchen Tags gezogen wird.
        </p>
        <TagInput scope="image" value={uploadTags} onChange={setUploadTags} />
        <button className="btn" onClick={() => fileRef.current?.click()}><IconPlus /> Bilder hochladen{uploadTags.length ? ` (mit ${uploadTags.length} Tag${uploadTags.length > 1 ? 's' : ''})` : ''}</button>
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => { upload(e.target.files); e.target.value = '' }} />
        {images.length > 0 && <div className="img-grid">{images.map((img) => <ImageTile key={img.id} img={img} onEdit={() => setImageSheet(img)} />)}</div>}
        {imageTags.length > 0 && (
          <div className="stack" style={{ gap: 6 }}>
            <span className="small muted">Für neue Monate ziehen aus (keine Auswahl = alle Bilder):</span>
            <div className="chips">
              {imageTags.map((t) => {
                const on = wantedTags.includes(t)
                return <button key={t} className={`chip ${on ? 'on' : ''}`} onClick={() => saveSetting(SETTING_IMAGE_TAGS, on ? wantedTags.filter((x) => x !== t) : [...wantedTags, t])}>#{t}</button>
              })}
            </div>
          </div>
        )}
      </div>

      <div className="section-title">km & Credits – Werte</div>
      <RewardSettings />

      <div className="section-title">Daten</div>
      <div className="card stack">
        <p className="small muted" style={{ margin: 0 }}>
          Alle Daten liegen nur auf diesem Gerät (im Browser-Speicher der App). Lege regelmäßig eine Sicherung an –
          z. B. in deinem Cloud-Speicher –, damit beim Gerätewechsel oder Löschen der Browserdaten nichts verloren geht.
        </p>
        <button className="btn" onClick={() => run('Export wird erstellt …', exportTextZip)}><IconDownload /> Alle Bereiche als Textdateien (ZIP)</button>
        <button className="btn" onClick={() => run('Sicherung wird erstellt …', exportBackup)}><IconDownload /> Vollständige Sicherung (JSON)</button>
        <button className="btn ghost" onClick={() => restoreRef.current?.click()}>Sicherung wiederherstellen …</button>
        <input ref={restoreRef} type="file" accept="application/json,.json" hidden onChange={(e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (f && window.confirm('Alle aktuellen Daten werden durch die Sicherung ersetzt. Fortfahren?')) {
            run('Sicherung wird eingespielt …', async () => { await importBackup(f); window.alert('Sicherung wiederhergestellt.') })
          }
        }} />
        {persisted === false && (
          <button className="btn ghost small" onClick={() => navigator.storage.persist().then(setPersisted)}>
            Speicher als dauerhaft markieren (schützt vor automatischem Löschen)
          </button>
        )}
        {persisted && <span className="tiny muted">✓ Speicher ist als dauerhaft markiert.</span>}
      </div>

      <p className="tiny muted" style={{ marginTop: 24, textAlign: 'center' }}>LIFEapp · Version 0.1</p>

      {substanceSheet && <SubstanceSheet substance={substanceSheet === 'new' ? undefined : substanceSheet} onClose={() => setSubstanceSheet(undefined)} />}
      {imageSheet && <ImageSheet img={imageSheet} onClose={() => setImageSheet(undefined)} />}
      {busy && <div className="toast">{busy}</div>}
    </div>
  )
}
