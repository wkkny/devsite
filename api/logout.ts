import type { VercelRequest, VercelResponse } from "@vercel/node"

import { clearSpotifyCookies } from "./_spotify.js"

export default function handler(_req: VercelRequest, res: VercelResponse) {
  clearSpotifyCookies(res)
  return res.redirect("/")
}
