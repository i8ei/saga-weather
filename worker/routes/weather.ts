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

/** YYYY-MM-DD を offset 年ずらす（うるう日は2/28に丸める） */
function shiftDateYear(dateStr: string, offset: number): string {
  const [y, m, d] = dateStr.split("-").map(Number)
  const ty = y + offset
  const maxDay = new Date(ty, m, 0).getDate()
  return `${ty}-${String(m).padStart(2, "0")}-${String(Math.min(d, maxDay)).padStart(2, "0")}`
}

// GET /normal?mc=&from=&to=&base_temp= — 過去5年平均（前年除く）
// #11: 日毎平均を SQL GROUP BY で集計しCPU負荷を削減
app.get("/normal", async (c) => {
  const mc = getMc(c)
  const today = todayJST()
  const year = parseInt(today.slice(0, 4))
  const end = c.req.query("to") || today
  const start = c.req.query("from") || `${year}-01-01`
  if (!isValidDate(start) || !isValidDate(end)) return c.json({ error: "Invalid date format" }, 400)
  if (daysBetween(start, end) > MAX_RANGE_DAYS) return c.json({ error: "Range too large" }, 400)
  const baseTemp = Math.max(0, Math.min(30, parseFloat(c.req.query("base_temp") || "10")))

  // Years -2 to -5 (skip -1 = previous year)
  const ranges: { from: string; to: string; offset: number }[] = []
  for (let off = 2; off <= 5; off++) {
    ranges.push({ from: shiftDateYear(start, -off), to: shiftDateYear(end, -off), offset: off })
  }

  // Count valid years (>50% coverage)
  const totalDays = daysBetween(start, end) + 1
  const minCoverage = totalDays * 0.5

  const countConditions = ranges.map((_, i) => `(date >= ?${i * 2 + 2} AND date <= ?${i * 2 + 3})`).join(" OR ")
  const countBinds: (string | number)[] = [mc]
  for (const r of ranges) { countBinds.push(r.from, r.to) }

  // Get per-year counts to filter valid years
  const { results: yearCounts } = await c.env.DB.prepare(
    `SELECT substr(date,1,4) AS yr, COUNT(*) AS cnt
     FROM daily_weather WHERE municipality_code = ?1 AND (${countConditions})
     GROUP BY yr`
  ).bind(...countBinds).all<{ yr: string; cnt: number }>()

  const validYears = yearCounts.filter(y => y.cnt >= minCoverage).map(y => y.yr)
  if (validYears.length === 0) return c.json({ accumulation: null, daily: [], years_used: 0 })

  // Build date conditions for valid years only
  const validRanges = ranges.filter(r => validYears.includes(r.from.slice(0, 4)))
  const dailyConditions = validRanges.map((_, i) => `(date >= ?${i * 2 + 2} AND date <= ?${i * 2 + 3})`).join(" OR ")
  const dailyBinds: (string | number)[] = [mc]
  for (const r of validRanges) { dailyBinds.push(r.from, r.to) }

  // SQL-side daily averages grouped by MM-DD
  const { results: dailyAvgs } = await c.env.DB.prepare(
    `SELECT
       strftime('%m-%d', date) AS md,
       AVG(temp_mean) AS temp_mean, AVG(temp_max) AS temp_max, AVG(temp_min) AS temp_min,
       AVG(sunshine_h) AS sunshine_h, AVG(precip_sum) AS precip_sum,
       AVG(et0) AS et0, AVG(ROUND(wind_max/3.6, 1)) AS wind_max
     FROM daily_weather
     WHERE municipality_code = ?1 AND (${dailyConditions})
     GROUP BY md ORDER BY md`
  ).bind(...dailyBinds).all<{
    md: string; temp_mean: number; temp_max: number; temp_min: number;
    sunshine_h: number; precip_sum: number; et0: number; wind_max: number
  }>()

  // SQL-side accumulation per year, then average in JS (lightweight)
  const { results: accumRows } = await c.env.DB.prepare(
    `SELECT
       substr(date,1,4) AS yr,
       SUM(temp_mean) AS temp_sum, SUM(sunshine_h) AS sunshine_sum, SUM(precip_sum) AS precip_sum,
       SUM(CASE WHEN temp_mean > ?1 THEN temp_mean - ?1 ELSE 0 END) AS effective_temp_sum,
       SUM(et0) AS et0_sum, MAX(wind_max) AS wind_max_peak, AVG(wind_max) AS wind_max_avg,
       SUM(CASE WHEN wind_max >= 28.8 THEN 1 ELSE 0 END) AS strong_wind_days,
       COUNT(*) AS days
     FROM daily_weather
     WHERE municipality_code = ?2 AND (${dailyConditions.replace(/\?\d+/g, (m) => `?${parseInt(m.slice(1)) + 1}`)})`
    + ` GROUP BY yr`
  ).bind(baseTemp, ...[mc, ...dailyBinds.slice(1)]).all<{
    yr: string; temp_sum: number; sunshine_sum: number; precip_sum: number;
    effective_temp_sum: number; et0_sum: number; wind_max_peak: number;
    wind_max_avg: number; strong_wind_days: number; days: number
  }>()

  const n = accumRows.length
  if (n === 0) return c.json({ accumulation: null, daily: [], years_used: 0 })

  const r1 = (v: number) => Math.round(v * 10) / 10
  const avg = (key: keyof typeof accumRows[0]) => accumRows.reduce((s, a) => s + (a[key] as number), 0) / n

  const accumulation = {
    temp_sum: r1(avg("temp_sum")),
    sunshine_sum: r1(avg("sunshine_sum")),
    precip_sum: r1(avg("precip_sum")),
    effective_temp_sum: r1(avg("effective_temp_sum")),
    et0_sum: r1(avg("et0_sum")),
    water_balance: r1(avg("precip_sum") - avg("et0_sum")),
    wind_max_peak: r1(Math.max(...accumRows.map(a => a.wind_max_peak)) / 3.6),
    wind_max_avg: r1(accumRows.reduce((s, a) => s + a.wind_max_avg / 3.6, 0) / n),
    strong_wind_days: Math.round(avg("strong_wind_days")),
    base_temp: baseTemp, from: start, to: end,
    days: Math.round(avg("days")),
  }

  // Convert MM-DD averages to current-year dates
  const startYear = parseInt(start.slice(0, 4))
  const daily: Omit<DailyWeatherRow, "municipality_code" | "fetched_at">[] = dailyAvgs.map(row => ({
    date: `${startYear}-${row.md}`,
    temp_mean: r1(row.temp_mean), temp_max: r1(row.temp_max), temp_min: r1(row.temp_min),
    precip_sum: r1(row.precip_sum), sunshine_h: r1(row.sunshine_h),
    et0: r1(row.et0), wind_max: r1(row.wind_max), weather_code: 0,
  }))

  cacheHeader(c, end)
  return c.json({ accumulation, daily, years_used: n })
})

export { app as weatherRoutes }
