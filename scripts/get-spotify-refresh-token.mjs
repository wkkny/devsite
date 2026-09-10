import { createServer } from "node:http"
import { randomBytes } from "node:crypto"
import { Buffer } from "node:buffer"
import { spawn } from "node:child_process"
import process from "node:process"

const PORT = 8765
const REDIRECT_URI = `http://127.0.0.1:${PORT}/callback`
const TOKEN_URL = "https://accounts.spotify.com/api/token"
const SCOPES = [
  "user-read-currently-playing",
  "user-read-recently-played",
].join(" ")

const clientId = process.env.SPOTIFY_CLIENT_ID
const clientSecret = process.env.SPOTIFY_CLIENT_SECRET

if (!clientId || !clientSecret) {
  console.error(
    "Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET in .env"
  )
  process.exit(1)
}

const state = randomBytes(16).toString("hex")

function closeServer(exitCode) {
  if (exitCode !== undefined) process.exitCode = exitCode
  server.close()
}

function openBrowser(url) {
  const [command, args] = process.platform === "darwin"
    ? ["open", [url]]
    : process.platform === "win32"
      ? ["rundll32.exe", ["url.dll,FileProtocolHandler", url]]
      : ["xdg-open", [url]]

  const child = spawn(command, args, {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  })
  child.once("error", () => {
    console.warn("Could not open a browser automatically; use the URL above.")
  })
  child.unref()
}

function buildAuthorizeUrl() {
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: REDIRECT_URI,
    scope: SCOPES,
    state,
  })

  return `https://accounts.spotify.com/authorize?${params.toString()}`
}

async function exchangeCode(code) {
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
    }),
  })

  const data = await response.json()

  if (!response.ok || !data.refresh_token) {
    throw new Error(
      data.error_description ?? data.error ?? "Token exchange failed"
    )
  }

  return data
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, REDIRECT_URI)

  if (url.pathname !== "/callback") {
    res.writeHead(404)
    res.end()
    return
  }

  const error = url.searchParams.get("error")
  const code = url.searchParams.get("code")
  const returnedState = url.searchParams.get("state")

  if (error || !code || returnedState !== state) {
    res.writeHead(400, { "Content-Type": "text/html" })
    res.end("<p>Authorization failed — check the terminal.</p>")
    console.error(`Authorization failed: ${error ?? "state/code mismatch"}`)
    closeServer(1)
    return
  }

  try {
    const token = await exchangeCode(code)

    res.writeHead(200, { "Content-Type": "text/html" })
    res.end("<p>Done — refresh token printed in the terminal. You can close this tab.</p>")

    console.log("\nAdd this to .env:\n")
    console.log(`SPOTIFY_REFRESH_TOKEN=${token.refresh_token}`)
    console.log("\nThen restart vercel dev.")
    closeServer()
  } catch (err) {
    res.writeHead(500, { "Content-Type": "text/html" })
    res.end("<p>Token exchange failed — check the terminal.</p>")
    console.error(err.message)
    closeServer(1)
  }
})

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Waiting for Spotify authorization on ${REDIRECT_URI}…`)
  const authorizeUrl = buildAuthorizeUrl()
  console.log(`If the browser does not open, visit:\n${authorizeUrl}\n`)
  openBrowser(authorizeUrl)
})
