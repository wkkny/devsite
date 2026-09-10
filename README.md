# Kritiraj's Portfolio

Personal site built with Vite, React, and Tailwind. Two serverless functions live in `api/`: the Spotify now-playing pill and a GitHub contributions proxy for the calendar, so the site needs Vercel (or any host that runs those functions) to show them.

## Local development

```sh
pnpm install
cp .env.example .env
```

The UI uses mock playback by default in local development. To exercise the real
serverless endpoint, fill in the Spotify values in `.env`:

1. Create an app at [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard).
2. Add `http://127.0.0.1:8765/callback` as a redirect URI for the local token script.
3. Copy the client ID and secret into `.env`.
4. Run `pnpm spot:token`, log in as the portfolio owner, and paste the printed
   refresh token into `.env` as `SPOTIFY_REFRESH_TOKEN`. Spotify refresh tokens
   are valid for six months, so repeat this step and replace the token before it
   expires.
5. Set `VITE_SPOTIFY_USE_MOCK=false` in `.env`.

Then run:

```sh
pnpm dev:spotify
```

This starts Vercel's dev server so the `api/` functions work. Plain `pnpm dev`
runs the UI with mock Spotify data. The mock never runs in production.

## Site content

Name, roles, email, timezone, GitHub username, and project entries all live in
`src/config/portfolio.ts`. Edit that file to change what the site shows — no
component changes needed.

## API endpoints

| Endpoint | What it does |
| --- | --- |
| `GET /api/now-playing` | Owner's current/recent Spotify playback, CDN-cached ~10s |
| `GET /api/github-contributions` | Owner's GitHub contribution graph, CDN-cached ~1h |
| `POST /api/clear-spotify-cookies` | One-time cleanup of legacy Spotify cookies |

## Deploy to Vercel

1. Push this repo to GitHub, then import it at [vercel.com/new](https://vercel.com/new). Vercel detects Vite, sets the build command to `pnpm build`, and serves `dist/`. No changes needed there.
2. In Vercel, Settings → Environment Variables, add:

   | Variable | Value |
   | --- | --- |
   | `SPOTIFY_CLIENT_ID` | your Spotify client ID |
   | `SPOTIFY_CLIENT_SECRET` | your Spotify client secret |
   | `SPOTIFY_REFRESH_TOKEN` | the token from `pnpm spot:token` (replace every six months) |

   These are server-only credentials; do not give them a `VITE_` prefix. Visitors
   never authenticate with Spotify and no Spotify token is stored in cookies.
3. Deploy. Every push to `main` deploys automatically after that.

## CI

GitHub Actions (`.github/workflows/ci.yml`) runs `pnpm lint`, `pnpm test`, and
`pnpm build` on every push and pull request. The build type-checks both the
frontend (`src/`) and the serverless functions (`api/`) in strict mode.

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Vite dev server, no API functions |
| `pnpm dev:spotify` | `vercel dev`, UI plus `api/` functions on port 3000 |
| `pnpm spot:token` | Refresh-token helper on port 8765 |
| `pnpm build` | Typecheck and production build |
| `pnpm lint` | oxlint |
| `pnpm test` | Run the Vitest suite once |
| `pnpm test:watch` | Run Vitest in watch mode |
