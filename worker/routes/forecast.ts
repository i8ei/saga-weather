import { Hono } from "hono"
import type { Env, Municipality } from "../lib/types"
import { fetchForecast } from "../lib/open-meteo"

const DEFAULT_MC = "41441"
const CACHE_TTL = 1800 // 30 minutes

const app = new Hono<{ Bindings: Env }>()

app.get("/forecast", async (c) => {
  const mc = c.req.query("mc") || DEFAULT_MC
  const cacheKey = `forecast_${mc}`

  // Check KV cache
  const cached = await c.env.FORECAST_CACHE.get(cacheKey, { type: "json" })
  if (cached) {
    c.header("Cache-Control", "public, max-age=1800")
    return c.json(cached)
  }

  // Look up municipality lat/lon
  const muni = await c.env.DB.prepare(
    "SELECT lat, lon FROM municipality WHERE code = ?"
  ).bind(mc).first<Municipality>()
  if (!muni) return c.json({ error: "Unknown municipality" }, 404)

  // Fetch from Open-Meteo
  const data = await fetchForecast(String(muni.lat), String(muni.lon))

  // Store in KV with TTL
  await c.env.FORECAST_CACHE.put(cacheKey, JSON.stringify(data), {
    expirationTtl: CACHE_TTL,
  })

  c.header("Cache-Control", "public, max-age=1800")
  return c.json(data)
})

export { app as forecastRoutes }
