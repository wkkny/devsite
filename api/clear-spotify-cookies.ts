import type { VercelRequest, VercelResponse } from "@vercel/node"

const LEGACY_COOKIE_DELETIONS = [
  "spotify_access_token=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax",
  "spotify_refresh_token=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax",
]

export default function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader("Cache-Control", "no-store")

  if (req.method !== "POST") {
    res.setHeader("Allow", "POST")
    return res.status(405).json({ error: "Method not allowed" })
  }

  res.setHeader("Set-Cookie", LEGACY_COOKIE_DELETIONS)
  return res.status(204).end()
}
