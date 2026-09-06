# Kritiraj's Portfolio

Personal site built with Vite, React, and Tailwind. The Spotify now-playing pill runs on a small serverless function that lives in `api/`, so the site needs Vercel (or any host that runs those functions) to show it.

## Local development

```sh
pnpm install
cp .env.example .env
```

Fill in the Spotify values in `.env`:

1. Create an app at [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard).
2. Add `http://127.0.0.1:3000/api/callback` as a redirect URI for local dev, and `http://127.0.0.1:8765/callback` for the token script.
3. Copy the client ID and secret into `.env`.
4. Run `pnpm spot:token`, log in, and paste the printed refresh token into `.env` as `SPOTIFY_REFRESH_TOKEN`. You only do this once.

Then run:

```sh
pnpm dev:spotify
```

This starts Vercel's dev server so the `api/` functions work. Plain `pnpm dev` runs the UI fine, but the Spotify pill falls back to mock data. Without `SPOTIFY_REFRESH_TOKEN` set, the pill serves mock data in dev (`VITE_SPOTIFY_DEV_AUTH=true`).

## Deploy to Vercel

1. Push this repo to GitHub, then import it at [vercel.com/new](https://vercel.com/new). Vercel detects Vite, sets the build command to `pnpm build`, and serves `dist/`. No changes needed there.
2. In the Spotify dashboard, add your production redirect URI: `https://<your-domain>/api/callback`.
3. In Vercel, Settings → Environment Variables, add:

   | Variable | Value |
   | --- | --- |
   | `VITE_SPOTIFY_CLIENT_ID` | your Spotify client ID |
   | `SPOTIFY_CLIENT_SECRET` | your Spotify client secret |
   | `SPOTIFY_REFRESH_TOKEN` | the token from `pnpm spot:token` |
   | `VITE_SPOTIFY_REDIRECT_URI` | `https://<your-domain>/api/callback`, same as the dashboard entry |
   | `VITE_SPOTIFY_AUTH_MODE` | `private` |

   `VITE_SPOTIFY_AUTH_MODE=private` makes the function use the refresh token instead of dev mock data. Leave `VITE_SPOTIFY_DEV_AUTH` unset so local dev can keep using mocks.
4. Deploy. Every push to `main` deploys automatically after that.

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm dev` | Vite dev server, no API functions |
| `pnpm dev:spotify` | `vercel dev`, UI plus `api/` functions on port 3000 |
| `pnpm spot:token` | One-time refresh-token helper on port 8765 |
| `pnpm build` | Typecheck and production build |
| `pnpm lint` | oxlint |
