import type { VercelRequest, VercelResponse } from "@vercel/node"

import { exchangeCodeForToken, setSpotifyCookies } from "./_spotify.js"

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const code = Array.isArray(req.query.code)
    ? req.query.code[0]
    : req.query.code

  if (!code) {
    return res.redirect("/?error=missing_code")
  }

  try {
    const token = await exchangeCodeForToken(code)

    setSpotifyCookies(res, token)
    return res.redirect("/")
  } catch {
    return res.redirect("/?error=token_exchange_failed")
  }
}
