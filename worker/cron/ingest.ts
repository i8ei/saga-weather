import type { Env, Municipality } from "../lib/types"
import { fetchDailyRangeMulti } from "../lib/open-meteo"

const BATCH_SIZE = 100

export async function ingest(env: Env) {
  const today = new Date()
  const weekAgo = new Date(today)
  weekAgo.setDate(weekAgo.getDate() - 7)

  const toStr = today.toISOString().slice(0, 10)
  const fromStr = weekAgo.toISOString().slice(0, 10)

  // 1. Get all municipalities
  const { results: munis } = await env.DB.prepare(
    "SELECT code, name, lat, lon FROM municipality ORDER BY code"
  ).all<Municipality>()

  console.log(`Fetching weather for ${munis.length} municipalities: ${fromStr} → ${toStr}`)

  // 2. Multi-location fetch (1 API call for all 20 locations)
  const lats = munis.map((m) => m.lat).join(",")
  const lons = munis.map((m) => m.lon).join(",")
  const allData = await fetchDailyRangeMulti(lats, lons, fromStr, toStr)

  // 3. Build upsert statements
  const now = new Date().toISOString()
  const stmts = munis.flatMap((m, i) =>
    allData[i].map((row) =>
      env.DB.prepare(`
        INSERT INTO daily_weather (municipality_code, date, temp_max, temp_min, temp_mean, precip_sum, sunshine_h, weather_code, et0, wind_max, fetched_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)
        ON CONFLICT(municipality_code, date) DO UPDATE SET
          temp_max=excluded.temp_max,
          temp_min=excluded.temp_min,
          temp_mean=excluded.temp_mean,
          precip_sum=excluded.precip_sum,
          sunshine_h=excluded.sunshine_h,
          weather_code=excluded.weather_code,
          et0=excluded.et0,
          wind_max=excluded.wind_max,
          fetched_at=excluded.fetched_at
      `).bind(
        m.code, row.date, row.temp_max, row.temp_min, row.temp_mean,
        row.precip_sum, row.sunshine_h, row.weather_code,
        row.et0, row.wind_max, now
      )
    )
  )

  // 4. Execute in batches (D1 limit is ~100 statements per batch)
  for (let i = 0; i < stmts.length; i += BATCH_SIZE) {
    const batch = stmts.slice(i, i + BATCH_SIZE)
    await env.DB.batch(batch)
  }
  console.log(`Upserted ${stmts.length} rows for ${munis.length} municipalities`)

  // 5. Prune old data (>5 years)
  const pruned = await env.DB.prepare(
    "DELETE FROM daily_weather WHERE date < date('now', '-1825 days')"
  ).run()
  if (pruned.meta.changes > 0) {
    console.log(`Pruned ${pruned.meta.changes} old rows`)
  }
}
