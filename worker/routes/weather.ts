import { Hono } from "hono"
import type { Env, DailyWeatherRow } from "../lib/types"

const DEFAULT_MC = "41441" // 太良町

const app = new Hono<{ Bindings: Env }>()

function getMc(c: { req: { query: (k: string) => string | undefined } }): string {
  return c.req.query("mc") || DEFAULT_MC
}

function convertWind(rows: DailyWeatherRow[]) {
  return rows.map((r) => ({
    ...r,
    wind_max: r.wind_max != null ? Math.round(r.wind_max / 3.6 * 10) / 10 : null,
  }))
}

// GET /latest?mc=
app.get("/latest", async (c) => {
  const mc = getMc(c)
  const today = new Date()
  const weekAgo = new Date(today)
  weekAgo.setDate(weekAgo.getDate() - 7)
  const toStr = today.toISOString().slice(0, 10)
  const fromStr = weekAgo.toISOString().slice(0, 10)
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM daily_weather WHERE municipality_code = ? AND date >= ? AND date <= ? ORDER BY date"
  ).bind(mc, fromStr, toStr).all<DailyWeatherRow>()
  return c.json(convertWind(results))
})

// GET /daily?mc=&from=&to=
app.get("/daily", async (c) => {
  const mc = getMc(c)
  const from = c.req.query("from")
  const to = c.req.query("to")
  let results: DailyWeatherRow[]
  if (from && to) {
    const r = await c.env.DB.prepare(
      "SELECT * FROM daily_weather WHERE municipality_code = ? AND date >= ? AND date <= ? ORDER BY date"
    ).bind(mc, from, to).all<DailyWeatherRow>()
    results = r.results
  } else {
    const r = await c.env.DB.prepare(
      "SELECT * FROM daily_weather WHERE municipality_code = ? ORDER BY date DESC LIMIT 30"
    ).bind(mc).all<DailyWeatherRow>()
    results = r.results
  }
  return c.json(convertWind(results))
})

// GET /accumulation?mc=&from=&to=&base_temp=
app.get("/accumulation", async (c) => {
  const mc = getMc(c)
  const today = new Date().toISOString().slice(0, 10)
  const year = new Date().getFullYear()
  const end = c.req.query("to") || today
  const start = c.req.query("from") || `${year}-01-01`
  const baseTemp = parseFloat(c.req.query("base_temp") || "10")
  const strongWindThKmh = 28.8

  const row = await c.env.DB.prepare(`
    SELECT
      COALESCE(SUM(temp_mean), 0) as temp_sum,
      COALESCE(SUM(sunshine_h), 0) as sunshine_sum,
      COALESCE(SUM(precip_sum), 0) as precip_sum,
      COALESCE(SUM(CASE WHEN temp_mean > ?1 THEN temp_mean - ?1 ELSE 0 END), 0) as effective_temp_sum,
      COALESCE(SUM(et0), 0) as et0_sum,
      COALESCE(MAX(wind_max), 0) as wind_max_peak,
      COALESCE(AVG(wind_max), 0) as wind_max_avg,
      COALESCE(SUM(CASE WHEN wind_max >= ?2 THEN 1 ELSE 0 END), 0) as strong_wind_days,
      COUNT(*) as days
    FROM daily_weather
    WHERE municipality_code = ?3 AND date >= ?4 AND date <= ?5
  `).bind(baseTemp, strongWindThKmh, mc, start, end).first<Record<string, number>>()

  if (!row) return c.json({ error: "No data" }, 404)

  return c.json({
    temp_sum: Math.round(row.temp_sum * 10) / 10,
    sunshine_sum: Math.round(row.sunshine_sum * 10) / 10,
    precip_sum: Math.round(row.precip_sum * 10) / 10,
    effective_temp_sum: Math.round(row.effective_temp_sum * 10) / 10,
    et0_sum: Math.round(row.et0_sum * 10) / 10,
    water_balance: Math.round((row.precip_sum - row.et0_sum) * 10) / 10,
    wind_max_peak: Math.round(row.wind_max_peak / 3.6 * 10) / 10,
    wind_max_avg: Math.round(row.wind_max_avg / 3.6 * 10) / 10,
    strong_wind_days: row.strong_wind_days,
    base_temp: baseTemp,
    from: start,
    to: end,
    days: row.days,
  })
})

export { app as weatherRoutes }
