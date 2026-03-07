import { Hono } from "hono"
import type { Env } from "../lib/types"

const app = new Hono<{ Bindings: Env }>()

app.get("/sekki", async (c) => {
  const url = new URL(c.req.url)
  url.pathname = "/data/sekki.json"
  const assetResp = await c.env.ASSETS.fetch(new Request(url.toString()))
  if (!assetResp.ok) return c.json({ error: "sekki.json not found" }, 404)
  return new Response(assetResp.body, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=86400, s-maxage=604800",
    },
  })
})

export { app as sekkiRoutes }
