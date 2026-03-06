import { Hono } from "hono"
import type { Env, Municipality } from "../lib/types"

const app = new Hono<{ Bindings: Env }>()

app.get("/municipalities", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT code, name, lat, lon FROM municipality ORDER BY code"
  ).all<Municipality>()
  const oldest = await c.env.DB.prepare(
    "SELECT MIN(date) as min_date FROM daily_weather"
  ).first<{ min_date: string | null }>()
  return c.json({ municipalities: results, minDate: oldest?.min_date ?? null })
})

export { app as municipalityRoutes }
