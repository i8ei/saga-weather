import { useMemo } from 'react'
import type { DailyWeather } from '../hooks/useWeather'

type Metric = "temp" | "sunshine" | "precip" | "water" | "wind"

interface MetricDef {
  label: string
  unit: string
  getValue: (d: DailyWeather) => number | null
  overlay?: { label: string; color: string; getValue: (d: DailyWeather) => number | null }
  allowNegativeMin?: boolean
  thresholds?: { value: number; label: string }[]
  clampScale?: boolean  // use 95th percentile for y-axis max to avoid spike compression
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
    clampScale: true,
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
    clampScale: true,
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

const W = 100
const H = 55
const PAD_LEFT = 10
const PAD_TOP = 4
const PAD_BOT = 2

interface Props {
  data: DailyWeather[]
  prevData?: DailyWeather[]
  normalData?: DailyWeather[]
  metric: Metric
  rangeLabel?: string
}

export default function WeatherChart({ data, prevData, normalData, metric, rangeLabel }: Props) {
  const config = METRIC_CONFIG[metric]

  const prevSufficient = prevData && prevData.length >= data.length * 0.8
  const normalSufficient = normalData && normalData.length >= data.length * 0.5

  const chartData = useMemo(() => {
    if (data.length === 0) return null

    // Parse dates once and cache timestamps
    const dataTimestamps = data.map((d) => new Date(d.date + "T00:00:00").getTime())

    const values = data.map((d) => config.getValue(d) ?? 0)
    const overlayValues = config.overlay ? data.map((d) => config.overlay!.getValue(d) ?? 0) : null

    // Map previous year data by day offset from range start (leap-year safe)
    const prevMap = new Map<number, number>()
    if (prevSufficient && prevData) {
      const prevStart = new Date(prevData[0].date + "T00:00:00").getTime()
      for (const d of prevData) {
        const offset = Math.round((new Date(d.date + "T00:00:00").getTime() - prevStart) / 86400000)
        prevMap.set(offset, config.getValue(d) ?? 0)
      }
    }
    const dataStart = dataTimestamps[0]
    const prevValues = dataTimestamps.map((ts) => {
      const offset = Math.round((ts - dataStart) / 86400000)
      return prevMap.get(offset) ?? null
    })

    const prevNonNull = prevSufficient ? prevValues.filter((v): v is number => v !== null) : []
    const allValues = [...values, ...(overlayValues ?? []), ...prevNonNull]
    if (allValues.length === 0) return null
    const thresholdValues = config.thresholds?.map((t) => t.value) ?? []
    const combined = [...allValues, ...thresholdValues]
    let rawMax = Math.max(...combined, 0.1)
    const rawMin = config.allowNegativeMin ? Math.min(...combined, 0) : 0

    // Clamp y-axis max to 95th percentile to prevent spike compression
    if (config.clampScale && allValues.length >= 10) {
      const sorted = [...allValues].sort((a, b) => a - b)
      const p95 = sorted[Math.floor(sorted.length * 0.95)]
      if (p95 > 0 && rawMax > p95 * 1.5) {
        rawMax = p95 * 1.5
      }
    }
    const padding = (rawMax - rawMin) * 0.08
    const max = rawMax + padding
    const min = rawMin - (config.allowNegativeMin ? padding : 0)
    const range = max - min || 1

    const chartW = W - PAD_LEFT
    const n = values.length
    const barW = chartW / n

    const toY = (v: number) => {
      const clamped = Math.max(min, Math.min(max, v))
      return PAD_TOP + (1 - (clamped - min) / range) * (H - PAD_TOP - PAD_BOT)
    }
    const toX = (i: number) => PAD_LEFT + i * barW
    const zeroY = toY(0)

    // Build combined <path> d-strings for positive and negative bars
    let posPath = ""
    let negPath = ""
    for (let i = 0; i < values.length; i++) {
      const x = toX(i)
      const y = toY(values[i])
      const barH = zeroY - y
      const rectY = barH >= 0 ? y : zeroY
      const rectH = Math.max(Math.abs(barH), 0.15)
      const rx = x + barW * 0.1
      const rw = barW * 0.8
      const seg = `M${rx},${rectY}h${rw}v${rectH}h${-rw}Z`
      if (barH < 0) {
        negPath += seg
      } else {
        posPath += seg
      }
    }

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

    // Month labels + 目盛り線（期間に応じて間引き） — uses cached timestamps
    const allMonths: { x: number; month: number; year: number }[] = []
    const dateTicks: { x: number; label: string }[] = []
    let lastMonth = -1
    for (let i = 0; i < data.length; i++) {
      const dt = new Date(dataTimestamps[i])
      const m = dt.getMonth()
      const day = dt.getDate()
      if (m !== lastMonth) {
        allMonths.push({ x: toX(i), month: m, year: dt.getFullYear() })
        lastMonth = m
      }
      if (day === 1 || day === 15) {
        dateTicks.push({ x: toX(i), label: `${day}` })
      }
    }

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

    // 7-day moving average line helper
    function smoothLine(rawValues: (number | null)[]): string | null {
      const WINDOW = 7
      const half = Math.floor(WINDOW / 2)
      const smoothed: (number | null)[] = rawValues.map((_, i) => {
        let sum = 0, count = 0
        for (let j = Math.max(0, i - half); j <= Math.min(rawValues.length - 1, i + half); j++) {
          if (rawValues[j] !== null) { sum += rawValues[j]!; count++ }
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
      return segments.length > 1 ? segments.join(" ") : null
    }

    // Previous year: 7-day moving average line
    const prevPath = (prevSufficient && prevData) ? smoothLine(prevValues) : null

    // Normal (multi-year average): 7-day moving average line
    let normalPath: string | null = null
    if (normalSufficient && normalData) {
      const normalDateMap = new Map(normalData.map(d => [d.date, config.getValue(d) ?? 0]))
      const normalValues = data.map(d => normalDateMap.get(d.date) ?? null)
      normalPath = smoothLine(normalValues)
    }

    return {
      posPath, negPath, overlayPath, thLines, yTicks, dateTicks, months,
      zeroY, rawMin, prevPath, normalPath,
    }
  }, [data, prevData, normalData, metric, config])

  if (!chartData) return null

  const { posPath, negPath, overlayPath, thLines, yTicks, dateTicks, months,
    zeroY, rawMin, prevPath, normalPath } = chartData

  return (
    <section className="card">
      <h2 className="terminal-title mono">
        この{rangeLabel ?? "期間"}の{config.label}
        {(prevSufficient || normalSufficient) && (
          <span style={{ fontSize: 10, color: "var(--text-sub)", letterSpacing: 0 }}>
            （棒=今年{prevSufficient ? " / 橙線=前年" : ""}{normalSufficient ? " / 紫線=平年" : ""}）
          </span>
        )}
      </h2>

      <svg
        viewBox={`0 0 ${W} ${H + 6}`}
        style={{ width: "100%", height: "auto", marginTop: 8, display: "block" }}
        preserveAspectRatio="none"
        role="img"
        aria-label={`${config.label}チャート（${rangeLabel ?? "期間"}）`}
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

        {/* Main bars: combined into 2 path elements */}
        {posPath && <path d={posPath} fill="var(--accent)" opacity={0.75} />}
        {negPath && <path d={negPath} fill="var(--warn)" opacity={0.75} />}

        {/* Previous year: 7-day moving average line */}
        {prevPath && (
          <path d={prevPath} fill="none"
            stroke="#f59e0b" strokeWidth={0.3} opacity={0.8} />
        )}

        {/* Normal (multi-year average): 7-day moving average line */}
        {normalPath && (
          <path d={normalPath} fill="none"
            stroke="#a78bfa" strokeWidth={0.3} opacity={0.8} />
        )}

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
      {(prevSufficient || normalSufficient || config.overlay) && (
        <div className="row mono muted" style={{
          fontSize: 12, marginTop: 4, gap: 12,
          background: "rgba(255,255,255,0.03)",
          border: "1px solid var(--line)",
          padding: "4px 8px",
        }}>
          {(prevSufficient || normalSufficient) && (
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ display: "inline-block", width: 10, height: 8, background: "var(--accent)" }} /> 今年
            </span>
          )}
          {prevSufficient && prevData && (
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ display: "inline-block", width: 14, borderTop: "2px solid #f59e0b" }} /> 前年(7日平均)
            </span>
          )}
          {normalSufficient && normalData && (
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ display: "inline-block", width: 14, borderTop: "2px solid #a78bfa" }} /> 平年(7日平均)
            </span>
          )}
          {config.overlay && (
            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
              <span style={{ display: "inline-block", width: 14, borderTop: "2px solid " + config.overlay.color }} /> {config.overlay.label}
            </span>
          )}
        </div>
      )}
    </section>
  )
}

export type { Metric }
