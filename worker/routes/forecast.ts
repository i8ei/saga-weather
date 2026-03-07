import { Hono } from "hono"
import type { Env, Municipality } from "../lib/types"
import { fetchForecast, ForecastDay } from "../lib/open-meteo"

const DEFAULT_MC = "41441"
const FRESH_TTL_MS = 30 * 60 * 1000    // 30 minutes — data is fresh
const STALE_TTL_MS = 90 * 60 * 1000    // 90 minutes — serve stale + revalidate

interface CachedForecast {
  data: ForecastDay[]
  timestamp: number
}

const app = new Hono<{ Bindings: Env }>()

app.get("/forecast", async (c) => {
  const mc = c.req.query("mc") || DEFAULT_MC
  const cacheKey = `forecast_${mc}`

  // 1. Read from KV
  const cached = await c.env.FORECAST_CACHE.get<CachedForecast>(cacheKey, { type: "json" })
  const now = Date.now()

  if (cached) {
    const age = now - cached.timestamp

    // 2. Fresh (< 30 min): return immediately
    if (age < FRESH_TTL_MS) {
      c.header("Cache-Control", "public, max-age=1800")
      return c.json(cached.data)
    }

    // 3. Stale (30–90 min): return old data, revalidate in background
    if (age < STALE_TTL_MS) {
      c.executionCtx.waitUntil(revalidate(c.env, cacheKey, mc))
      c.header("Cache-Control", "public, max-age=300")
      return c.json(cached.data)
    }
  }

  // 4. Expired (> 90 min) or missing: synchronous fetch
  const muni = await c.env.DB.prepare(
    "SELECT lat, lon FROM municipality WHERE code = ?"
  ).bind(mc).first<Municipality>()
  if (!muni) return c.json({ error: "Unknown municipality" }, 404)

  try {
    const data = await fetchForecast(String(muni.lat), String(muni.lon))
    c.executionCtx.waitUntil(putCache(c.env, cacheKey, data))
    c.header("Cache-Control", "public, max-age=1800")
    return c.json(data)
  } catch (err) {
    console.error("Forecast fetch failed:", err instanceof Error ? err.message : String(err))

    // #14: Fallback — return stale data if available
    if (cached) {
      c.header("X-Forecast-Stale", "true")
      c.header("Cache-Control", "public, max-age=60")
      return c.json(cached.data)
    }

    // No cached data at all — 503
    return c.json({ error: "Forecast temporarily unavailable" }, 503)
  }
})

/** Write forecast data + timestamp to KV with jittered TTL */
async function putCache(env: Env, key: string, data: ForecastDay[]): Promise<void> {
  const entry: CachedForecast = { data, timestamp: Date.now() }
  const ttl = 5400 + Math.floor(Math.random() * 600) // 90 min + 0–10 min jitter
  await env.FORECAST_CACHE.put(key, JSON.stringify(entry), { expirationTtl: ttl })
}

/** Background revalidation: fetch fresh data and update KV */
async function revalidate(env: Env, cacheKey: string, mc: string): Promise<void> {
  try {
    const muni = await env.DB.prepare(
      "SELECT lat, lon FROM municipality WHERE code = ?"
    ).bind(mc).first<Municipality>()
    if (!muni) return

    const data = await fetchForecast(String(muni.lat), String(muni.lon))
    await putCache(env, cacheKey, data)
  } catch (err) {
    console.error("Background revalidation failed:", err instanceof Error ? err.message : String(err))
  }
}

export { app as forecastRoutes }
