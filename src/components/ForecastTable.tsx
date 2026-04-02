import React, { useMemo } from "react"
import type { ForecastDay } from "../hooks/useWeather"
import { wmoToIcon } from "../lib/weather-icons"
import { getKoIndex, KO_72, getMoonPhase, moonPhaseIcon } from "../lib/sekki-data"
import { startOfLocalDay } from "../lib/time"

const DAY_NAMES = ["日", "月", "火", "水", "木", "金", "土"]

interface Props {
  forecast: ForecastDay[]
  now: Date
}

export default function ForecastTable({ forecast, now }: Props) {
  const days = forecast.slice(0, 5)
  const todayStr = useMemo(() => {
    const d = startOfLocalDay(now)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
  }, [now])

  if (days.length === 0) return null

  // 各日の候indexを計算し、変わり目を検出
  const rows = days.map((d, i) => {
    const dt = new Date(d.date + "T12:00:00")
    const koIdx = getKoIndex(dt)
    const prevKoIdx = i > 0
      ? getKoIndex(new Date(days[i - 1].date + "T12:00:00"))
      : getKoIndex(new Date(dt.getTime() - 86400000))
    return { day: d, dt, koIdx, transition: koIdx !== prevKoIdx }
  })

  return (
    <section className="card" style={{ padding: 0, overflow: "hidden" }}>
      <table className="mono" style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
        <tbody>
          {rows.map(({ day, dt, koIdx, transition }) => {
            const isToday = day.date === todayStr
            const dayIdx = dt.getDay()
            const isWeekend = dayIdx === 0 || dayIdx === 6
            return (
              <React.Fragment key={day.date}>
                {transition && (
                  <tr>
                    <td
                      colSpan={7}
                      style={{
                        padding: "4px 10px",
                        fontSize: 11,
                        color: "var(--text-sub)",
                        borderTop: "1px dashed var(--line)",
                        background: "var(--bg-sub, transparent)",
                      }}
                    >
                      <span className="mono muted" style={{ marginRight: 6 }}>七十二候</span>
                      <span className="jp">{KO_72[koIdx].name}</span>
                      <span className="mono muted" style={{ marginLeft: 6 }}>{KO_72[koIdx].reading}</span>
                    </td>
                  </tr>
                )}
                <tr
                  style={{
                    borderBottom: "1px solid var(--line)",
                    background: isToday ? "var(--accent-bg, rgba(100,200,255,0.08))" : "transparent",
                  }}
                >
                  <td style={{
                    padding: "8px 4px 8px 10px",
                    width: 14,
                    color: "var(--accent)",
                    fontSize: 10,
                  }}>
                    {isToday ? "▶" : ""}
                  </td>
                  <td style={{
                    padding: "8px 6px",
                    width: 28,
                    color: isWeekend ? "var(--accent)" : "var(--text)",
                  }}>
                    {DAY_NAMES[dayIdx]}
                  </td>
                  <td style={{ padding: "8px 6px", width: 50 }}>{day.date.slice(5)}</td>
                  <td style={{ padding: "8px 6px", width: 30 }}>{wmoToIcon(day.weather_code)}</td>
                  <td style={{ padding: "8px 6px" }}>
                    {Math.round(day.temp_max)}°/{Math.round(day.temp_min)}°
                  </td>
                  <td style={{ padding: "8px 6px", textAlign: "right", color: "var(--text-sub)" }}>
                    {day.wind_max != null ? `最大${day.wind_max.toFixed(0)}m/s` : ""}
                  </td>
                  <td style={{ padding: "8px 6px", width: 24, textAlign: "center" }}>
                    {moonPhaseIcon(getMoonPhase(dt))}
                  </td>
                </tr>
              </React.Fragment>
            )
          })}
        </tbody>
      </table>
    </section>
  )
}
