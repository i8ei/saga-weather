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

  const totalDays = daysBetween(start, end) + 1
  const minCoverage = totalDays * 0.5

  // Fetch all data with per-range count validation
  const allConditions = ranges.map((_, i) => `(date >= ?${i * 2 + 2} AND date <= ?${i * 2 + 3})`).join(" OR ")
  const allBinds: (string | number)[] = [mc]
  for (const r of ranges) { allBinds.push(r.from, r.to) }

  const { results } = await c.env.DB.prepare(
    `SELECT ${DAILY_COLS} FROM daily_weather WHERE municipality_code = ?1 AND (${allConditions}) ORDER BY date`
  ).bind(...allBinds).all<DailyWeatherRow>()

  // Group by offset range (not by year — handles year boundaries correctly)
  const rangeGroups = new Map<number, DailyWeatherRow[]>()
  for (const row of results) {
    for (const r of ranges) {
      if (row.date >= r.from && row.date <= r.to) {
        if (!rangeGroups.has(r.offset)) rangeGroups.set(r.offset, [])
        rangeGroups.get(r.offset)!.push(row)
        break
      }
    }
  }

  // Filter valid ranges and compute daily averages + accumulation
  const startYear = parseInt(start.slice(0, 4))
  const startMd = start.slice(5) // "MM-DD"
  const endYear = parseInt(end.slice(0, 4))
  const crossesYear = endYear > startYear
  const r1 = (v: number) => Math.round(v * 10) / 10

  interface RangeAccum { temp_sum: number; sunshine_sum: number; precip_sum: number; effective_temp_sum: number; et0_sum: number; wind_max_peak: number; wind_max_sum: number; strong_wind_days: number; days: number }
  const validAccums: RangeAccum[] = []
  const dayValues = new Map<string, { temp_mean: number[]; temp_max: number[]; temp_min: number[]; precip_sum: number[]; sunshine_h: number[]; et0: number[]; wind_max: number[] }>()

  for (const [offset, rows] of rangeGroups) {
    if (rows.length < minCoverage) continue

    const a: RangeAccum = { temp_sum: 0, sunshine_sum: 0, precip_sum: 0, effective_temp_sum: 0, et0_sum: 0, wind_max_peak: 0, wind_max_sum: 0, strong_wind_days: 0, days: rows.length }

    for (const row of rows) {
      const tm = row.temp_mean ?? 0, ps = row.precip_sum ?? 0, sh = row.sunshine_h ?? 0
      const et = row.et0 ?? 0, wm = (row.wind_max ?? 0)
      a.temp_sum += tm; a.sunshine_sum += sh; a.precip_sum += ps
      a.effective_temp_sum += Math.max(0, tm - baseTemp)
      a.et0_sum += et
      if (wm > a.wind_max_peak) a.wind_max_peak = wm
      a.wind_max_sum += wm
      if (wm >= 8) a.strong_wind_days++

      // Group by MM-DD for daily averages
      const md = row.date.slice(5) // "MM-DD"
      if (!dayValues.has(md)) {
        dayValues.set(md, { temp_mean: [], temp_max: [], temp_min: [], precip_sum: [], sunshine_h: [], et0: [], wind_max: [] })
      }
      const dv = dayValues.get(md)!
      dv.temp_mean.push(tm); dv.temp_max.push(row.temp_max ?? 0); dv.temp_min.push(row.temp_min ?? 0)
      dv.precip_sum.push(ps); dv.sunshine_h.push(sh); dv.et0.push(et); dv.wind_max.push(wm)
    }
    validAccums.push(a)
  }

  if (validAccums.length === 0) return c.json({ accumulation: null, daily: [], years_used: 0 })

  const n = validAccums.length
  const avgKey = (key: keyof RangeAccum) => validAccums.reduce((s, a) => s + (a[key] as number), 0) / n

  const accumulation = {
    temp_sum: r1(avgKey("temp_sum")),
    sunshine_sum: r1(avgKey("sunshine_sum")),
    precip_sum: r1(avgKey("precip_sum")),
    effective_temp_sum: r1(avgKey("effective_temp_sum")),
    et0_sum: r1(avgKey("et0_sum")),
    water_balance: r1(avgKey("precip_sum") - avgKey("et0_sum")),
    wind_max_peak: r1(Math.max(...validAccums.map(a => a.wind_max_peak))),
    wind_max_avg: r1(validAccums.reduce((s, a) => s + a.wind_max_sum / a.days, 0) / n),
    strong_wind_days: Math.round(avgKey("strong_wind_days")),
    base_temp: baseTemp, from: start, to: end,
    days: Math.round(avgKey("days")),
  }

  // Build daily averages with current-year dates, sorted correctly
  const avgArr = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length
  const daily: Omit<DailyWeatherRow, "municipality_code" | "fetched_at">[] = []
  for (const [md, dv] of dayValues) {
    if (dv.temp_mean.length === 0) continue
    const y = crossesYear && md < startMd ? startYear + 1 : startYear
    // Skip Feb 29 if target year is not a leap year
    if (md === "02-29" && new Date(y, 1, 29).getDate() !== 29) continue
    daily.push({
      date: `${y}-${md}`,
      temp_mean: r1(avgArr(dv.temp_mean)), temp_max: r1(avgArr(dv.temp_max)), temp_min: r1(avgArr(dv.temp_min)),
      precip_sum: r1(avgArr(dv.precip_sum)), sunshine_h: r1(avgArr(dv.sunshine_h)),
      et0: r1(avgArr(dv.et0)), wind_max: r1(avgArr(dv.wind_max)), weather_code: 0,
    })
  }
  daily.sort((a, b) => a.date.localeCompare(b.date))

  cacheHeader(c, end)
  return c.json({ accumulation, daily, years_used: n })
})

// GET /status — system health and data coverage
app.get("/status", async (c) => {
  const row = await c.env.DB.prepare(
    `SELECT MAX(date) as last_date, COUNT(DISTINCT date) as total_days FROM daily_weather`
  ).first<{ last_date: string | null; total_days: number }>()
  c.header("Cache-Control", "public, max-age=3600")
  return c.json({
    lastDate: row?.last_date ?? null,
    totalDays: row?.total_days ?? 0,
  })
})

export { app as weatherRoutes }
