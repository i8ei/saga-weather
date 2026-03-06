import type { DailyWeather } from '../hooks/useWeather'

type Metric = "temp" | "sunshine" | "precip" | "water" | "wind"

interface MetricDef {
  label: string
  unit: string
  getValue: (d: DailyWeather) => number | null
  overlay?: { label: string; color: string; getValue: (d: DailyWeather) => number | null }
  allowNegativeMin?: boolean
  thresholds?: { value: number; label: string }[]
}

const METRIC_CONFIG: Record<Metric, MetricDef> = {
  temp: {
    label: "気温",
    unit: "°C",
    getValue: (d) => d.temp_mean,
    allowNegativeMin: true,
  },
  sunshine: {
    label: "日照",
    unit: "h",
    getValue: (d) => d.sunshine_h,
  },
  precip: {
    label: "降水量",
    unit: "mm",
    getValue: (d) => d.precip_sum,
  },
  water: {
    label: "水収支",
    unit: "mm",
    getValue: (d) => d.precip_sum - (d.et0 ?? 0),
    overlay: {
      label: "ET₀",
      color: "var(--warn)",
      getValue: (d) => d.et0,
    },
    allowNegativeMin: true,
  },
  wind: {
    label: "風速",
    unit: "m/s",
    getValue: (d) => d.wind_max,
    thresholds: [
      { value: 4, label: "散布限界" },
      { value: 8, label: "強風" },
    ],
  },
}

function toMMDD(d: Date): string {
  return `${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

const W = 100
const H = 55
const PAD_LEFT = 10
const PAD_TOP = 4
const PAD_BOT = 2

interface Props {
  data: DailyWeather[]
  prevData?: DailyWeather[]
  metric: Metric
  rangeLabel?: string
}

export default function WeatherChart({ data, prevData, metric, rangeLabel }: Props) {
  if (data.length === 0) return null

  const config = METRIC_CONFIG[metric]
  const values = data.map((d) => config.getValue(d) ?? 0)
  const overlayValues = config.overlay ? data.map((d) => config.overlay!.getValue(d) ?? 0) : null

  // Skip prev data if coverage is less than 80% of current range
  const prevSufficient = prevData && prevData.length >= data.length * 0.8

  // Map previous year data to current year dates (month-day alignment)
  const prevMap = new Map<string, number>()
  if (prevSufficient && prevData) {
    for (const d of prevData) {
      const dt = new Date(d.date + "T00:00:00")
      // Shift to current year equivalent: add 1 year
      dt.setFullYear(dt.getFullYear() + 1)
      const key = toMMDD(dt)
      prevMap.set(key, config.getValue(d) ?? 0)
    }
  }
  const prevValues = data.map((d) => {
    const dt = new Date(d.date + "T00:00:00")
    return prevMap.get(toMMDD(dt)) ?? null
  })

  const prevNonNull = prevSufficient ? prevValues.filter((v): v is number => v !== null) : []
  const allValues = [...values, ...(overlayValues ?? []), ...prevNonNull]
  const thresholdValues = config.thresholds?.map((t) => t.value) ?? []
  const rawMax = Math.max(...allValues, ...thresholdValues, 0.1)
  const rawMin = config.allowNegativeMin ? Math.min(...allValues, 0) : 0
  const padding = (rawMax - rawMin) * 0.08
  const max = rawMax + padding
  const min = rawMin - (config.allowNegativeMin ? padding : 0)
  const range = max - min || 1

  const chartW = W - PAD_LEFT
  const n = values.length
  const barW = chartW / n

  const toY = (v: number) => PAD_TOP + (1 - (v - min) / range) * (H - PAD_TOP - PAD_BOT)
  const toX = (i: number) => PAD_LEFT + i * barW
  const zeroY = toY(0)

  // Build SVG bar path for main values
  const bars = values.map((v, i) => {
    const x = toX(i)
    const y = toY(v)
    const barH = zeroY - y
    return { x, y: barH >= 0 ? y : zeroY, h: Math.abs(barH), neg: barH < 0 }
  })

  // Build line path for overlay
  let overlayPath = ""
  if (overlayValues) {
    overlayPath = overlayValues
      .map((v, i) => `${i === 0 ? "M" : "L"}${toX(i) + barW / 2},${toY(v)}`)
      .join(" ")
  }

  // Threshold lines
  const thLines = config.thresholds?.map((th) => ({
    y: toY(th.value),
    label: th.label,
    value: th.value,
  })) ?? []

  // Y-axis ticks (3〜5本)
  const yTickCount = 4
  const yStep = range / yTickCount
  const yTicks: { y: number; label: string }[] = []
  for (let i = 0; i <= yTickCount; i++) {
    const v = min + yStep * i
    yTicks.push({ y: toY(v), label: Math.round(v).toString() })
  }

  // Month labels + 目盛り線（期間に応じて間引き）
  const allMonths: { x: number; month: number; year: number }[] = []
  const dateTicks: { x: number; label: string }[] = []
  let lastMonth = -1
  data.forEach((d, i) => {
    const dt = new Date(d.date + "T00:00:00")
    const m = dt.getMonth()
    const day = dt.getDate()
    if (m !== lastMonth) {
      allMonths.push({ x: toX(i), month: m, year: dt.getFullYear() })
      lastMonth = m
    }
    if (day === 1 || day === 15) {
      dateTicks.push({ x: toX(i), label: `${day}` })
    }
  })

  // 期間の長さに応じてラベル間隔を決定（最大約15ラベル）
  const totalMonths = allMonths.length
  const monthStep = totalMonths <= 15 ? 1 : totalMonths <= 30 ? 3 : 6
  const showYear = totalMonths > 12

  const months: { x: number; label: string }[] = allMonths
    .filter((_, i) => i % monthStep === 0)
    .map((m) => {
      const ml = `${m.month + 1}月`
      return {
        x: m.x,
        label: showYear ? (m.month === 0 ? `'${String(m.year % 100).padStart(2, "0")}` : ml) : ml,
      }
    })

  return (
    <section className="card">
      <h2 className="terminal-title mono">この{rangeLabel ?? "期間"}の{config.label}</h2>

      <svg
        viewBox={`0 0 ${W} ${H + 6}`}
        style={{ width: "100%", height: "auto", marginTop: 8, display: "block" }}
        preserveAspectRatio="none"
      >
        {/* Y-axis grid + labels */}
        {yTicks.map((t, i) => (
          <g key={`y-${i}`}>
            <line x1={PAD_LEFT} y1={t.y} x2={W} y2={t.y}
              stroke="var(--line)" strokeWidth={0.1} />
            <text x={PAD_LEFT - 1} y={t.y + 0.8} textAnchor="end"
              fill="var(--text-sub)" fontSize={1.8}>
              {t.label}
            </text>
          </g>
        ))}

        {/* Date tick lines (1日・15日) */}
        {dateTicks.map((t, i) => (
          <line key={`dt-${i}`} x1={t.x} y1={PAD_TOP} x2={t.x} y2={H - PAD_BOT}
            stroke="var(--line)" strokeWidth={0.1} />
        ))}

        {/* Zero line */}
        {config.allowNegativeMin && rawMin < 0 && (
          <line x1={PAD_LEFT} y1={zeroY} x2={W} y2={zeroY}
            stroke="var(--text-sub)" strokeWidth={0.15} strokeDasharray="0.5,0.5" />
        )}

        {/* Threshold lines */}
        {thLines.map((th) => (
          <g key={th.label}>
            <line x1={PAD_LEFT} y1={th.y} x2={W} y2={th.y}
              stroke="var(--warn)" strokeWidth={0.15} strokeDasharray="0.8,0.4" opacity={0.6} />
            <text x={W - 0.5} y={th.y - 0.5} textAnchor="end"
              fill="var(--warn)" fontSize={2.2} opacity={0.7}>
              {th.label} {th.value}{config.unit}
            </text>
          </g>
        ))}

        {/* Main bars (always full-width) */}
        {bars.map((b, i) => (
          <rect key={i}
            x={b.x + barW * 0.1}
            y={b.y}
            width={barW * 0.8}
            height={Math.max(b.h, 0.15)}
            fill={b.neg ? "var(--warn)" : "var(--accent)"}
            opacity={0.75}
          />
        ))}

        {/* Previous year: 7-day moving average line */}
        {prevSufficient && prevData && (() => {
          const WINDOW = 7
          const smoothed: (number | null)[] = prevValues.map((_, i) => {
            let sum = 0, count = 0
            for (let j = Math.max(0, i - Math.floor(WINDOW / 2)); j <= Math.min(prevValues.length - 1, i + Math.floor(WINDOW / 2)); j++) {
              if (prevValues[j] !== null) { sum += prevValues[j]!; count++ }
            }
            return count >= 3 ? sum / count : null
          })
          const segments: string[] = []
          let cmd = "M"
          for (let i = 0; i < smoothed.length; i++) {
            const v = smoothed[i]
            if (v === null) { cmd = "M"; continue }
            segments.push(`${cmd}${toX(i) + barW / 2},${toY(v)}`)
            cmd = "L"
          }
          return segments.length > 1 ? (
            <path d={segments.join(" ")} fill="none"
              stroke="#f59e0b" strokeWidth={0.3} opacity={0.8} />
          ) : null
        })()}

        {/* Overlay line */}
        {overlayPath && (
          <path d={overlayPath} fill="none"
            stroke={config.overlay!.color} strokeWidth={0.4} opacity={0.7} />
        )}

        {/* Month labels */}
        {months.map((m, i) => (
          <text key={i} x={m.x + 0.5} y={H + 4}
            fill="var(--text-sub)" fontSize={2.2}>
            {m.label}
          </text>
        ))}
      </svg>

      {/* Legend */}
      {(prevSufficient || config.overlay) && (
        <div className="row mono muted" style={{ fontSize: 11, marginTop: 4, gap: 12 }}>
          {prevSufficient && prevData && (
            <>
              <span><span style={{ color: "var(--accent)" }}>■</span> 今年</span>
              <span><span style={{ color: "#f59e0b" }}>─</span> 前年</span>
            </>
          )}
          {config.overlay && (
            <span><span style={{ color: config.overlay.color }}>─</span> {config.overlay.label}</span>
          )}
        </div>
      )}
    </section>
  )
}

export type { Metric }
