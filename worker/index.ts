import { Hono } from "hono"
import type { Env } from "./lib/types"
import { weatherRoutes } from "./routes/weather"
import { forecastRoutes } from "./routes/forecast"
import { sekkiRoutes } from "./routes/sekki"
import { municipalityRoutes } from "./routes/municipalities"
import { ingest } from "./cron/ingest"
import { backfill } from "./cron/backfill"
import { isValidDate, daysBetween } from "./lib/date"

const app = new Hono<{ Bindings: Env }>()

// Global error handler
app.onError((err, c) => {
  console.error(`[${c.req.method}] ${c.req.path}:`, err.message)
  return c.json({ error: "Internal Server Error" }, 500)
})

app.route("/api/weather", weatherRoutes)
app.route("/api/weather", forecastRoutes)
app.route("/api", sekkiRoutes)
app.route("/api", municipalityRoutes)

// Admin auth middleware
app.use("/api/admin/*", async (c, next) => {
  const key = c.req.header("X-Admin-Key")
  if (!key || key !== c.env.ADMIN_KEY) {
    return c.json({ error: "Unauthorized" }, 401)
  }
  await next()
})

// Manual cron trigger
app.post("/api/admin/ingest", async (c) => {
  await ingest(c.env)
  return c.json({ ok: true })
})

// Backfill: POST /api/admin/backfill?from=2024-03-06&to=2024-06-03
app.post("/api/admin/backfill", async (c) => {
  const from = c.req.query("from")
  const to = c.req.query("to")
  if (!from || !to) return c.json({ error: "from and to required" }, 400)
  if (!isValidDate(from) || !isValidDate(to)) return c.json({ error: "Invalid date format" }, 400)
  if (from > to) return c.json({ error: "from must be <= to" }, 400)
  if (daysBetween(from, to) > 400) return c.json({ error: "Range too large (max 400 days)" }, 400)
  const result = await backfill(c.env, from, to)
  return c.json(result)
})

// SPA fallback: pass to ASSETS (with not_found_handling = SPA, returns index.html)
app.all("*", (c) => {
  return c.env.ASSETS.fetch(c.req.raw)
})

export default {
  fetch: app.fetch,
  async scheduled(_controller: ScheduledController, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(ingest(env))
  },
} satisfies ExportedHandler<Env>
