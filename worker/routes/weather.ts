import { Hono } from "hono"
import type { Env, DailyWeatherRow } from "../lib/types"
import { todayJST, daysAgoJST, isValidDate, daysBetween } from "../lib/date"

const DEFAULT_MC = "41441" // 太良町
const MAX_RANGE_DAYS = 1900 // 5年+余裕
const DAILY_COLS = "date, temp_max, temp_min, temp_mean, precip_sum, sunshine_h, weather_code, et0, ROUND(wind_max/3.6, 1) as wind_max"

const app = new Hono<{ Bindings: Env }>()

function getMc(c: { req: { query: (k: string) => string | undefined } }): string {
  return c.req.query("mc") || DEFAULT_MC
}

/** 過去データのCache-Control: toが今日より前なら長め、含むなら短め */
function cacheHeader(c: { header: (k: string, v: string) => void }, to: string) {
  const today = todayJST()
  if (to < today) {
    c.header("Cache-Control", "public, max-age=86400, s-maxage=604800")
  } else {
    c.header("Cache-Control", "public, max-age=300, s-maxage=300")
  }
}

// GET /latest?mc=
app.get("/latest", async (c) => {
  const mc = getMc(c)
  const toStr = todayJST()
  const fromStr = daysAgoJST(7)
  const { results } = await c.env.DB.prepare(
    `SELECT ${DAILY_COLS} FROM daily_weather WHERE municipality_code = ? AND date >= ? AND date <= ? ORDER BY date`
  ).bind(mc, fromStr, toStr).all<DailyWeatherRow>()
  c.header("Cache-Control", "public, max-age=3600")
  return c.json(results)
})

// GET /daily?mc=&from=&to=
app.get("/daily", async (c) => {
  const mc = getMc(c)
  const from = c.req.query("from")
  const to = c.req.query("to")
  if (from && to) {
    if (!isValidDate(from) || !isValidDate(to)) return c.json({ error: "Invalid date format" }, 400)
    if (daysBetween(from, to) > MAX_RANGE_DAYS) return c.json({ error: "Range too large" }, 400)
  }
  let results: DailyWeatherRow[]
  if (from && to) {
    const r = await c.env.DB.prepare(
      `SELECT ${DAILY_COLS} FROM daily_weather WHERE municipality_code = ? AND date >= ? AND date <= ? ORDER BY date`
    ).bind(mc, from, to).all<DailyWeatherRow>()
    results = r.results
    cacheHeader(c, to)
  } else {
    const r = await c.env.DB.prepare(
      `SELECT ${DAILY_COLS} FROM daily_weather WHERE municipality_code = ? ORDER BY date DESC LIMIT 30`
    ).bind(mc).all<DailyWeatherRow>()
    results = r.results
    c.header("Cache-Control", "public, max-age=3600")
  }
  return c.json(results)
})

// GET /accumulation?mc=&from=&to=&base_temp=
app.get("/accumulation", async (c) => {
  const mc = getMc(c)
  const today = todayJST()
  const year = parseInt(today.slice(0, 4))
  const end = c.req.query("to") || today
  const start = c.req.query("from") || `${year}-01-01`
  if (!isValidDate(start) || !isValidDate(end)) return c.json({ error: "Invalid date format" }, 400)
  if (daysBetween(start, end) > MAX_RANGE_DAYS) return c.json({ error: "Range too large" }, 400)
  const baseTemp = Math.max(0, Math.min(30, parseFloat(c.req.query("base_temp") || "10")))
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

  cacheHeader(c, end)
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

// GET /bundle?mc=&from=&to= — daily + accumulation を1レスポンスで返す
app.get("/bundle", async (c) => {
  const mc = getMc(c)
  const today = todayJST()
  const year = parseInt(today.slice(0, 4))
  const from = c.req.query("from") || `${year}-01-01`
  const to = c.req.query("to") || today
  if (!isValidDate(from) || !isValidDate(to)) return c.json({ error: "Invalid date format" }, 400)
  if (daysBetween(from, to) > MAX_RANGE_DAYS) return c.json({ error: "Range too large" }, 400)
  const baseTemp = Math.max(0, Math.min(30, parseFloat(c.req.query("base_temp") || "10")))
  const strongWindThKmh = 28.8

  const [dailyResult, accumRow] = await Promise.all([
    c.env.DB.prepare(
      `SELECT ${DAILY_COLS} FROM daily_weather WHERE municipality_code = ? AND date >= ? AND date <= ? ORDER BY date`
    ).bind(mc, from, to).all<DailyWeatherRow>(),
    c.env.DB.prepare(`
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
    `).bind(baseTemp, strongWindThKmh, mc, from, to).first<Record<string, number>>(),
  ])

  const row = accumRow
  cacheHeader(c, to)
  return c.json({
    daily: dailyResult.results,
    accumulation: row ? {
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
      from, to, days: row.days,
    } : null,
  })
})

export { app as weatherRoutes }
