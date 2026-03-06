import type { Accumulation } from '../../hooks/useWeather'

function Diff({ curr, prev, unit, invert }: { curr: number; prev: number; unit: string; invert?: boolean }) {
  const diff = curr - prev
  if (diff === 0) return null
  const sign = diff > 0 ? "+" : ""
  // invert: for wind days, more = worse, so positive diff is warn color
  const color = invert
    ? (diff > 0 ? "var(--warn)" : "#f59e0b")
    : (diff > 0 ? "#f59e0b" : "#f59e0b")
  return (
    <span style={{ color, fontSize: 12, marginLeft: 6 }}>
      {sign}{diff.toLocaleString()} {unit}
    </span>
  )
}

export default function AccumulationCards({ data, prevData, rangeLabel }: { data: Accumulation | null; prevData?: Accumulation | null; rangeLabel?: string }) {
  if (!data) return null

  // 前年データの日数が今年の80%未満なら比較に使わない（データ不足）
  const hasPrev = prevData != null && data.days > 0 && prevData.days >= data.days * 0.8

  const rows: { label: string; value: string; unit: string; sub?: string; diffKey?: keyof Accumulation; diffUnit?: string; invert?: boolean }[] = [
    {
      label: "積算温度",
      value: data.temp_sum.toLocaleString(),
      unit: "°C",
      diffKey: "temp_sum",
      diffUnit: "°C",
    },
    {
      label: "有効積算温度",
      value: data.effective_temp_sum.toLocaleString(),
      unit: `°C`,
      sub: `>${data.base_temp}°C`,
      diffKey: "effective_temp_sum",
      diffUnit: "°C",
    },
    {
      label: "積算日照",
      value: data.sunshine_sum.toLocaleString(),
      unit: "h",
      diffKey: "sunshine_sum",
      diffUnit: "h",
    },
    {
      label: "積算降水量",
      value: data.precip_sum.toLocaleString(),
      unit: "mm",
      diffKey: "precip_sum",
      diffUnit: "mm",
    },
    {
      label: "水収支",
      value: (data.water_balance >= 0 ? "+" : "") + data.water_balance.toLocaleString(),
      unit: "mm",
      sub: `雨${data.precip_sum} − ET₀${data.et0_sum}`,
      diffKey: "water_balance",
      diffUnit: "mm",
    },
    {
      label: "強風日数",
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
      <h2 className="terminal-title mono">この{rangeLabel ?? "期間"}のまとめ</h2>
      <div className="terminal-block mono" style={{ marginTop: 10 }}>
        {rows.map((r) => (
          <div key={r.label} style={{ padding: "4px 0", borderBottom: "1px solid var(--line)" }}>
            <div className="row" style={{ alignItems: "baseline" }}>
              <span className="jp">{r.label}</span>
              <span className="mono muted" style={{ flex: 1, overflow: "hidden", whiteSpace: "nowrap" }}>
                ................................................................
              </span>
              <span className="mono" style={{ color: "var(--accent)" }}>{r.value} {r.unit}</span>
              {hasPrev && prevData && r.diffKey && (
                <Diff
                  curr={Number(data[r.diffKey])}
                  prev={Number(prevData[r.diffKey])}
                  unit={r.diffUnit ?? r.unit}
                  invert={r.invert}
                />
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
