import { useEffect, useMemo, useState } from "react"
import { useWeatherBundle, useForecast, useMunicipalities } from "./hooks/useWeather"
import SekkiHeader from "./components/SekkiHeader"
import ForecastTable from "./components/ForecastTable"
import AccumulationCards from "./components/Accumulation/AccumulationCards"
import WeatherChart, { type Metric } from "./components/WeatherChart"

type Range = "1y" | "6m" | "3m" | "1m"

const RANGE_STEPS: { key: Range; label: string }[] = [
  { key: "1m", label: "1ヶ月" },
  { key: "3m", label: "3ヶ月" },
  { key: "6m", label: "6ヶ月" },
  { key: "1y", label: "1年" },
]

const METRICS: { key: Metric; label: string }[] = [
  { key: "temp", label: "気温" },
  { key: "sunshine", label: "日照" },
  { key: "precip", label: "降水" },
  { key: "water", label: "水分" },
  { key: "wind", label: "風" },
]

const DEFAULT_MC = "41441" // 太良町

function toLocalDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

function computeRange(range: Range): { from: string; to: string } {
  const now = new Date()
  const to = toLocalDate(now)
  const d = new Date(now)
  switch (range) {
    case "1y": d.setFullYear(d.getFullYear() - 1); break
    case "6m": d.setMonth(d.getMonth() - 6); break
    case "3m": d.setMonth(d.getMonth() - 3); break
    case "1m": d.setMonth(d.getMonth() - 1); break
  }
  return { from: toLocalDate(d), to }
}

function getMunicipalityNameFromPath(): string | null {
  try {
    const path = decodeURIComponent(window.location.pathname).replace(/^\//, "")
    return path || null
  } catch {
    return null
  }
}

export default function App() {
  const { data: municipalities, minDate, loading: muniLoading } = useMunicipalities()
  const [mc, setMc] = useState<string | null>(null)
  const [muniName, setMuniName] = useState<string>("")
  const [realNow, setRealNow] = useState(() => new Date())
  const [range, setRange] = useState<Range>("3m")
  const [metric, setMetric] = useState<Metric>("temp")
  const [showPrev, setShowPrev] = useState(true)
  const [accumFrom, setAccumFrom] = useState<string | null>(null)
  const [accumTo, setAccumTo] = useState<string | null>(null)

  // Resolve municipality from URL path
  useEffect(() => {
    if (municipalities.length === 0) return

    const pathName = getMunicipalityNameFromPath()

    if (!pathName) {
      // / → redirect to /太良町
      const tara = municipalities.find((m) => m.code === DEFAULT_MC)
      if (tara) {
        window.location.replace(`/${tara.name}`)
      }
      return
    }

    const found = municipalities.find((m) => m.name === pathName)
    if (found) {
      setMc(found.code)
      setMuniName(found.name)
    } else {
      // Unknown municipality → fallback to 太良町
      const tara = municipalities.find((m) => m.code === DEFAULT_MC)
      if (tara) {
        window.location.replace(`/${tara.name}`)
      }
    }
  }, [municipalities])

  // Handle popstate (browser back/forward)
  useEffect(() => {
    const handler = () => {
      const pathName = getMunicipalityNameFromPath()
      if (pathName && municipalities.length > 0) {
        const found = municipalities.find((m) => m.name === pathName)
        if (found) {
          setMc(found.code)
          setMuniName(found.name)
        }
      }
    }
    window.addEventListener("popstate", handler)
    return () => window.removeEventListener("popstate", handler)
  }, [municipalities])

  useEffect(() => {
    const id = window.setInterval(() => setRealNow(new Date()), 60_000)
    return () => window.clearInterval(id)
  }, [])

  const { from, to } = useMemo(() => computeRange(range), [range])

  // 積算で期間指定されたらグラフもそれに追従
  const effFrom = accumFrom ?? from
  const effTo = accumTo ?? to
  const isCustomRange = accumFrom !== null || accumTo !== null
  const { prevFrom: effPrevFrom, prevTo: effPrevTo } = useMemo(() => {
    const pf = new Date(effFrom + "T00:00:00")
    const pt = new Date(effTo + "T00:00:00")
    pf.setFullYear(pf.getFullYear() - 1)
    pt.setFullYear(pt.getFullYear() - 1)
    return { prevFrom: toLocalDate(pf), prevTo: toLocalDate(pt) }
  }, [effFrom, effTo])

  // 1年超の期間では前年比を無効化（比較が意味をなさないため）
  const rangeExceeds1y = useMemo(() => {
    const ms = new Date(effTo + "T00:00:00").getTime() - new Date(effFrom + "T00:00:00").getTime()
    return ms > 366 * 86400000
  }, [effFrom, effTo])
  const prevEnabled = showPrev && !rangeExceeds1y

  const { daily, accum, loading, error: bundleError } = useWeatherBundle(effFrom, effTo, mc ?? undefined)
  const { daily: prevDaily, accum: prevAccum } = useWeatherBundle(prevEnabled ? effPrevFrom : undefined, prevEnabled ? effPrevTo : undefined, mc ?? undefined)
  const { data: forecast, error: forecastError } = useForecast(mc ?? undefined)

  const error = forecastError || bundleError

  const handleMuniChange = (code: string) => {
    const found = municipalities.find((m) => m.code === code)
    if (found) {
      setMc(found.code)
      setMuniName(found.name)
      history.pushState(null, "", `/${found.name}`)
      document.title = `${found.name}のお天道さん`
    }
  }

  // Update title on mount
  useEffect(() => {
    if (muniName) {
      document.title = `${muniName}のお天道さん`
    }
  }, [muniName])

  const pillBtn = (active: boolean, onClick: () => void, label: string) => (
    <button
      className="mono"
      onClick={onClick}
      style={{
        flex: 1,
        padding: "8px 0",
        fontSize: 12,
        color: active ? "var(--accent)" : "var(--text-muted)",
        background: "transparent",
        border: active ? "1px solid var(--accent)" : "1px solid var(--line)",
      }}
    >
      {label}
    </button>
  )

  if (muniLoading || !mc) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span className="mono muted">読込中...</span>
      </div>
    )
  }

  return (
    <div style={{ minHeight: "100vh", padding: 16, maxWidth: 980, margin: "0 auto" }}>
      <div style={{ margin: "0 0 14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <h1 className="jp" style={{ fontSize: 20, fontWeight: 700, margin: 0, color: "var(--text)" }}>
            <select
              className="jp"
              value={mc}
              onChange={(e) => handleMuniChange(e.target.value)}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--text)",
                fontSize: 20,
                fontWeight: 700,
                cursor: "pointer",
                padding: 0,
                appearance: "auto",
                width: `${muniName.length + 1}em`,
              }}
            >
              {municipalities.map((m) => (
                <option key={m.code} value={m.code}>{m.name}</option>
              ))}
            </select>
            のお天道さん
          </h1>
          <span className="jp muted" style={{ fontSize: 12, fontWeight: 400 }}>あめつちのあいだで</span>
        </div>
        <div className="jp muted" style={{ fontSize: 11 }}>佐賀県20市町から選べます</div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {error && (
          <div className="mono" style={{
            border: "1px solid var(--warn)",
            padding: "10px 14px",
            fontSize: 12,
            color: "var(--warn)",
          }}>
            !! ｴﾗｰ: {error}
          </div>
        )}

        <SekkiHeader now={realNow} />
        <ForecastTable forecast={forecast} now={realNow} />
        <div style={{ display: "flex", gap: 4 }}>
          <button
            className="mono"
            onClick={() => !rangeExceeds1y && setShowPrev((p) => !p)}
            disabled={rangeExceeds1y}
            style={{
              padding: "8px 12px",
              fontSize: 12,
              color: rangeExceeds1y ? "var(--text-muted)" : prevEnabled ? "#1a1a1a" : "var(--text-sub)",
              background: prevEnabled ? "#f59e0b" : "transparent",
              border: prevEnabled ? "1px solid #f59e0b" : "1px solid var(--line)",
              opacity: rangeExceeds1y ? 0.4 : 1,
              cursor: rangeExceeds1y ? "not-allowed" : "pointer",
            }}
          >
            前年比
          </button>
          {RANGE_STEPS.map((r) => pillBtn(range === r.key && !isCustomRange, () => { setRange(r.key); setAccumFrom(null); setAccumTo(null) }, r.label))}
        </div>

        <AccumulationCards
          data={accum}
          prevData={prevEnabled ? prevAccum : undefined}
          rangeLabel={RANGE_STEPS.find((r) => r.key === range)?.label}
          defaultFrom={from}
          defaultTo={to}
          customFrom={accumFrom}
          customTo={accumTo}
          minDate={minDate}
          onFromChange={setAccumFrom}
          onToChange={setAccumTo}
        />

        <div style={{ display: "flex", gap: 4 }}>
          {METRICS.map((m) => pillBtn(metric === m.key, () => setMetric(m.key), m.label))}
        </div>

        {loading ? (
          <div className="card mono" style={{ textAlign: "center", color: "var(--text-sub)", fontSize: 13, padding: 30 }}>
            読込中...
          </div>
        ) : (
          <WeatherChart data={daily} prevData={prevEnabled ? prevDaily : undefined} metric={metric} rangeLabel={isCustomRange ? "指定期間" : RANGE_STEPS.find((r) => r.key === range)?.label} />
        )}
      </div>

      <footer className="mono muted" style={{ textAlign: "center", fontSize: 10, padding: "20px 0 10px" }}>
        気象データ提供: <a href="https://open-meteo.com/" target="_blank" rel="noopener noreferrer" style={{ color: "var(--text-sub)" }}>Open-Meteo.com</a>
      </footer>
    </div>
  )
}
