import { useMemo } from "react"
import { SEKKI_24, getSekkiIndex, getMoonPhase, moonPhaseIcon } from "../lib/sekki-data"

const SYNODIC_MONTH = 29.530588

export default function SekkiHeader({ now }: { now: Date }) {
  const sekkiIdx = useMemo(() => getSekkiIndex(now), [now])
  const moonPhase = useMemo(() => getMoonPhase(now), [now])

  const sekki = SEKKI_24[sekkiIdx]
  const moonAge = moonPhase * SYNODIC_MONTH

  const dayNames = ["日", "月", "火", "水", "木", "金", "土"]
  const dateStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日(${dayNames[now.getDay()]})`

  return (
    <header className="card" style={{ padding: "10px 16px" }}>
      <div className="row mono" style={{ flexWrap: "wrap", alignItems: "baseline", gap: "4px 12px" }}>
        <span style={{ fontSize: 13 }}>{dateStr}</span>
        <span className="muted" style={{ fontSize: 10 }}>二十四節気</span>
        <span className="jp" style={{ fontSize: 18, fontWeight: 700, color: "var(--accent)" }}>
          {sekki.name}
        </span>
        <span style={{ fontSize: 13, color: "var(--text-sub)", whiteSpace: "nowrap" }}>
          {moonPhaseIcon(moonPhase)} 月齢 {moonAge.toFixed(1)}
        </span>
      </div>
    </header>
  )
}
