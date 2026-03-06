import type { ForecastDay, Accumulation } from '../hooks/useWeather'
import { generateInsights } from '../lib/weather/insights'

interface Props {
  forecast: ForecastDay[]
  accum: Accumulation | null
  prevAccum: Accumulation | null
  normalAccum?: Accumulation | null
}

export default function WeeklyOutlook({ forecast, accum, prevAccum, normalAccum }: Props) {
  if (forecast.length === 0) return null

  const insights = generateInsights(forecast, accum, prevAccum, normalAccum)
  if (insights.length === 0) return null

  return (
    <section className="card" style={{ padding: '10px 12px' }}>
      <h2 className="terminal-title mono" style={{ marginBottom: 6 }}>今週の見立て</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {insights.map((item, i) => (
          <div
            key={i}
            className="jp"
            style={{
              fontSize: 13,
              color: item.level === 'warn' ? 'var(--warn)' : 'var(--text)',
            }}
          >
            {item.level === 'warn' && (
              <span style={{ marginRight: 4, fontWeight: 700 }}>!!</span>
            )}
            {item.text}
          </div>
        ))}
      </div>
    </section>
  )
}
