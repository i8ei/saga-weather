import { memo } from "react"
import type { ForecastDay } from "../hooks/useWeather"

interface Props {
  forecast: ForecastDay[]
}

export default memo(function AlertBar({ forecast }: Props) {
  if (forecast.length === 0) return null

  const today = forecast[0]
  const frostDays = forecast.slice(0, 2).filter((d) => d.temp_min <= 3)
  const frostWarning = frostDays.length > 0
  const frostMin = frostWarning ? Math.min(...frostDays.map((d) => d.temp_min)) : null
  const frostLabel = frostDays[0]?.date === today.date ? "本日" : "明日"

  const sprayOk = today.wind_max < 4

  const badge = (warn: boolean, text: string) => (
    <span
      className="mono"
      style={{
        padding: "4px 10px",
        fontSize: 12,
        border: `1px solid ${warn ? "var(--warn)" : "var(--ok)"}`,
        color: warn ? "var(--warn)" : "var(--ok)",
      }}
    >
      {text}
    </span>
  )

  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
      {frostWarning
        ? badge(true, `霜注意 ${frostLabel} ${frostMin?.toFixed(1)}°C`)
        : badge(false, "霜リスク低")}
      {sprayOk
        ? badge(false, "散布OK")
        : badge(true, `散布注意 風${today.wind_max.toFixed(1)}m/s`)}
    </div>
  )
})
