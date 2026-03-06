import { Hono } from "hono"
import type { Env, Municipality } from "../lib/types"

const app = new Hono<{ Bindings: Env }>()

app.get("/municipalities", async (c) => {
  const { results } = await c.env.DB.prepare(
    "SELECT code, name, lat, lon FROM municipality ORDER BY code"
  ).all<Municipality>()
  return c.json(results)
})

export { app as municipalityRoutes }
