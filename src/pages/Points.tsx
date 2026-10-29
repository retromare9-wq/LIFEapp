import { useLiveQuery } from 'dexie-react-hooks'
import { Link } from 'react-router-dom'
import { computeRewards } from '../lib/rewards'
import { TopBar } from '../components/ui'

export default function Points() {
  const score = useLiveQuery(computeRewards)
  return (
    <div className="page">
      <TopBar title="km & Credits" />
      <div className="row" style={{ gap: 8, marginBottom: 14 }}>
        <div className="card grow"><div className="tiny muted">Kilometer</div><div className="num score-big">{score?.km ?? 0}</div></div>
        <div className="card grow"><div className="tiny muted">Credits</div><div className="num score-big">{score?.credits ?? 0}</div></div>
      </div>
      <div className="card">
        <div className="reward-row tiny muted"><span /><span style={{ textAlign: 'right' }}>km</span><span style={{ textAlign: 'right' }}>Credits</span></div>
        {score?.lines.map((l) => (
          <div key={l.key} className="reward-row" style={{ opacity: l.count ? 1 : 0.45 }}>
            <span className="small">{l.label} <span className="muted num">× {l.count}</span></span>
            <span className="num" style={{ textAlign: 'right', color: l.km < 0 ? 'var(--red)' : undefined }}>{l.km}</span>
            <span className="num" style={{ textAlign: 'right', color: l.credits < 0 ? 'var(--red)' : undefined }}>{l.credits}</span>
          </div>
        ))}
      </div>
      <p className="tiny muted" style={{ marginTop: 12 }}>
        Alles wird aus deinen Einträgen berechnet. Die Werte pro Kategorie änderst du in den <Link to="/einstellungen" style={{ color: 'var(--accent)' }}>Einstellungen</Link>.
      </p>
    </div>
  )
}
