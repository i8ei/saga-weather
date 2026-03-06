import type { Env, Municipality } from "../lib/types"
import { fetchArchiveMulti } from "../lib/open-meteo"

const BATCH_SIZE = 100

export async function backfill(env: Env, fromStr: string, toStr: string) {
  // 1. Get all municipalities
  const { results: munis } = await env.DB.prepare(
    "SELECT code, name, lat, lon FROM municipality ORDER BY code"
  ).all<Municipality>()

  // 2. Multi-location archive fetch
  const lats = munis.map((m) => m.lat).join(",")
  const lons = munis.map((m) => m.lon).join(",")
  const allData = await fetchArchiveMulti(lats, lons, fromStr, toStr)

  // 3. Build upsert statements
  const now = new Date().toISOString()
  const stmts = munis.flatMap((m, i) =>
    (allData[i] || []).map((row) =>
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

  // 4. Execute in batches
  for (let i = 0; i < stmts.length; i += BATCH_SIZE) {
    const batch = stmts.slice(i, i + BATCH_SIZE)
    await env.DB.batch(batch)
  }

  return {
    ok: true,
    municipalities: munis.length,
    rows: stmts.length,
    from: fromStr,
    to: toStr,
  }
}
