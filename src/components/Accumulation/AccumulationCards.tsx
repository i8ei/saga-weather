import type { Accumulation } from '../../hooks/useWeather'
import Tooltip from '../Tooltip'
import { evaluateAccum } from '../../lib/weather/evaluators'

function Diff({ curr, prev, unit, color: fixedColor }: { curr: number; prev: number; unit: string; color?: string }) {
  const diff = curr - prev
  if (diff === 0) return null
  const sign = diff > 0 ? "+" : ""
  const c = fixedColor ?? "#f59e0b"
  return (
    <span style={{ color: c, fontSize: 12, marginLeft: 6 }}>
      {sign}{diff.toLocaleString()} {unit}
    </span>
  )
}

interface Props {
  data: Accumulation | null
  prevData?: Accumulation | null
  normalData?: Accumulation | null
  rangeLabel?: string
  defaultFrom: string
  defaultTo: string
  customFrom: string | null
  customTo: string | null
  minDate: string | null
  onFromChange: (v: string | null) => void
  onToChange: (v: string | null) => void
}

const dateInputStyle: React.CSSProperties = {
  background: "var(--bg)",
  border: "1px solid var(--line)",
  color: "var(--accent)",
  fontSize: 12,
  padding: "4px 6px",
  fontFamily: "inherit",
  colorScheme: "dark",
}

export default function AccumulationCards({ data, prevData, normalData, rangeLabel, defaultFrom, defaultTo, customFrom, customTo, minDate, onFromChange, onToChange }: Props) {
  const isCustom = customFrom !== null || customTo !== null
  const activeFrom = customFrom ?? defaultFrom
  const activeTo = customTo ?? defaultTo

  if (!data) return null

  // 前年データの日数が今年の80%未満なら比較に使わない（データ不足）
  const hasPrev = prevData != null && data.days > 0 && prevData.days >= data.days * 0.8
  const hasNormal = normalData != null && data.days > 0 && normalData.days >= data.days * 0.5

  const rows: { label: string; desc: string; value: string; unit: string; sub?: string; diffKey?: keyof Accumulation; diffUnit?: string; invert?: boolean }[] = [
    {
      label: "積算温度",
      desc: "日平均気温の合計。生育速度の目安",
      value: data.temp_sum.toLocaleString(),
      unit: "°C",
      diffKey: "temp_sum",
      diffUnit: "°C",
    },
    {
      label: "有効積算温度",
      desc: "基準温度超過分の合計。発芽・開花予測に使用",
      value: data.effective_temp_sum.toLocaleString(),
      unit: `°C`,
      sub: `>${data.base_temp}°C`,
      diffKey: "effective_temp_sum",
      diffUnit: "°C",
    },
    {
      label: "積算日照",
      desc: "日照時間の合計。光合成量の目安",
      value: data.sunshine_sum.toLocaleString(),
      unit: "h",
      diffKey: "sunshine_sum",
      diffUnit: "h",
    },
    {
      label: "積算降水量",
      desc: "降水量の合計",
      value: data.precip_sum.toLocaleString(),
      unit: "mm",
      diffKey: "precip_sum",
      diffUnit: "mm",
    },
    {
      label: "水収支",
      desc: "降水 − 蒸発散(ET0)。+は湿り、−は乾き",
      value: (data.water_balance >= 0 ? "+" : "") + data.water_balance.toLocaleString(),
      unit: "mm",
      sub: `雨${data.precip_sum} − ET₀${data.et0_sum}`,
      diffKey: "water_balance",
      diffUnit: "mm",
    },
    {
      label: "強風日数",
      desc: "最大風速8m/s以上の日数",
      value: String(data.strong_wind_days),
      unit: `日/${data.days}日`,
      sub: `≥8 m/s  最大${data.wind_max_peak.toFixed(1)} m/s`,
      diffKey: "strong_wind_days",
      diffUnit: "日",
      invert: true,
    },
  ]

  return (
    <section className="card">
      <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
        <h2 className="terminal-title mono" style={{ marginRight: "auto" }}>
          {isCustom ? "期間指定" : `この${rangeLabel ?? "期間"}の`}まとめ
        </h2>
        <div className="row mono" style={{ gap: 4, fontSize: 12 }}>
          <input
            type="date"
            value={activeFrom}
            min={minDate ?? undefined}
            max={activeTo}
            onChange={(e) => onFromChange(e.target.value || null)}
            style={dateInputStyle}
          />
          <span className="muted">〜</span>
          <input
            type="date"
            value={activeTo}
            min={activeFrom}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(e) => onToChange(e.target.value || null)}
            style={dateInputStyle}
          />
          {isCustom && (
            <button
              onClick={() => { onFromChange(null); onToChange(null) }}
              style={{ fontSize: 11, padding: "4px 8px", color: "var(--text-sub)", minHeight: 0 }}
            >
              ↩
            </button>
          )}
        </div>
      </div>
      <div className="terminal-block mono" style={{ marginTop: 10 }}>
        {rows.map((r) => (
          <div key={r.label} style={{ padding: "4px 0", borderBottom: "1px solid var(--line)" }}>
            <div className="row" style={{ alignItems: "baseline" }}>
              <Tooltip text={r.desc}><span className="jp">{r.label}</span></Tooltip>
              <span className="mono muted" style={{ flex: 1, overflow: "hidden", whiteSpace: "nowrap" }}>
                ................................................................
              </span>
              <span className="mono" style={{ color: "var(--accent)" }}>{r.value} {r.unit}</span>
              {hasPrev && prevData && r.diffKey && (
                <>
                  <Diff
                    curr={Number(data[r.diffKey])}
                    prev={Number(prevData[r.diffKey])}
                    unit={r.diffUnit ?? r.unit}

                  />
                  {(() => {
                    const ev = evaluateAccum(r.diffKey, data, prevData)
                    return ev ? <span className="jp" style={{ fontSize: 11, marginLeft: 6, color: ev.level === 'neutral' ? 'var(--text-sub)' : '#f59e0b' }}>{ev.text}</span> : null
                  })()}
                </>
              )}
              {hasNormal && normalData && r.diffKey && (
                <>
                  <Diff
                    curr={Number(data[r.diffKey])}
                    prev={Number(normalData[r.diffKey])}
                    unit={r.diffUnit ?? r.unit}

                    color="#a78bfa"
                  />
                  {(() => {
                    const ev = evaluateAccum(r.diffKey, data, normalData)
                    return ev ? <span className="jp" style={{ fontSize: 11, marginLeft: 6, color: ev.level === 'neutral' ? 'var(--text-sub)' : '#a78bfa' }}>{ev.text}</span> : null
                  })()}
                </>
              )}
            </div>
            {r.sub && (
              <div className="jp muted" style={{ marginTop: 1, fontSize: 12 }}>{r.sub}</div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
