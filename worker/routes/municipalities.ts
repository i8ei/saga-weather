import { Hono } from "hono"
import type { Env, Municipality } from "../lib/types"

const app = new Hono<{ Bindings: Env }>()

app.get("/municipalities", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT m.code, m.name, (SELECT MIN(date) FROM daily_weather) AS min_date FROM municipality m ORDER BY m.code"
  ).all<Municipality & { min_date: string | null }>()
  const minDate = results.length > 0 ? results[0].min_date : null
  c.header("Cache-Control", "public, max-age=86400, s-maxage=86400")
  return c.json({ municipalities: results.map(m => ({ code: m.code, name: m.name })), minDate })
})

export { app as municipalityRoutes }
