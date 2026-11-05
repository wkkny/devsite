# Kritiraj's portfolio

This repository contains the source code and content for Kritiraj (Kenny)'s portfolio. The site is a responsive React app with a project list, GitHub contribution calendar, theme switcher, visitor count, and an optional live Spotify status.

## Features

- Light and dark themes, with the selected theme saved in the browser.
- Responsive layout, touch-friendly controls, and reduced-motion support.
- Project cards with grid and list views on desktop.
- GitHub contribution activity for each calendar year from 2026, loaded from a public API. It opens on the current year, January to December.
- Optional Spotify status for the current track or the most recently played track, read from Last.fm scrobbles. It shows a live indicator while playing and how long ago the last track played, and its tooltip shows the album cover and name. The last played track stays visible even when nothing is playing or requests fail.
- A visitor count backed by a Vercel function and Upstash Redis. `bun run dev` proxies `/api/visitors` to the production site (see `vite.config.ts`) and only reads the count.

## Tech stack

- React 19 and TypeScript
- Vite 8
- Tailwind CSS 4 and shadcn/ui components built on Base UI
- Motion for React, a canvas-drawn dithered banner, and Geist Variable
- Bun for package management and scripts
- Vitest for unit tests, Playwright for browser tests, and Oxlint for linting

## Getting started

Use Bun 1.4.2, as declared in `package.json`.

```sh
git clone https://github.com/wkkny/Devsite.git
cd Devsite
bun install
bun run dev
```

Open the local URL printed by Vite. The default development server shows sample Spotify playback and does not need Last.fm credentials.

## Commands

| Command | Description |
| --- | --- |
| `bun run dev` | Start the Vite development server with mock Spotify playback by default. |
| `bun run dev:spotify` | Start Vercel's local server so the app can call `/api/now-playing`. |
| `bun run build` | Type-check the app and build the production files into `dist/`. |
| `bun run preview` | Serve the production build locally. |
| `bun run lint` | Run Oxlint. |
| `bun run test` | Run unit tests and Playwright browser tests. |
| `bun run test:unit` | Run the Vitest unit tests. |
| `bun run test:e2e` | Run the Playwright tests in Chromium. |

If Playwright has no Chromium binary installed, run `bunx playwright install chromium` once.

## Spotify setup

The Spotify status is optional. Without credentials, it is hidden. It reads your listening from [Last.fm](https://www.last.fm), which records what you play on Spotify, so it needs no Spotify app or OAuth token. The local Vite server uses sample tracks unless you opt into the Vercel API.

1. Create a Last.fm account. In **Settings → Applications**, connect Spotify so your plays are scrobbled.
2. In **Settings → Privacy**, leave **Hide recent listening information** off. With it on, the API refuses to return your tracks.
3. Create an API account at [last.fm/api/account/create](https://www.last.fm/api/account/create) and copy the API key.
4. Copy `.env.example` to `.env`, fill in `LASTFM_API_KEY` and `LASTFM_USERNAME`, then set `VITE_SPOTIFY_USE_MOCK=false`.
5. Run `bun run dev:spotify` to use the `/api/now-playing` endpoint locally.

The page checks for the current track about every two minutes while the tab is visible. The deployed endpoint stores the latest track, Last.fm's rate-limit cooldown, and a 60-second backoff after upstream failures in shared Redis state, so Vercel instances reuse the same result and honor the same `Retry-After` period. It keeps showing the last known track during errors and rate limits.

Last.fm doesn't return Spotify track IDs, so the link opens a Spotify search for the song. New tracks can take up to a minute to appear, and a paused track can show as playing for a short while.

### Environment variables

| Variable | Required for | Description |
| --- | --- | --- |
| `LASTFM_API_KEY` | Live Spotify status | Last.fm API key. Server-side only. |
| `LASTFM_USERNAME` | Live Spotify status | The Last.fm user whose scrobbles are shown. Server-side only. |
| `UPSTASH_REDIS_REST_URL` | Deployed live Spotify status | Explicit HTTPS REST URL for the shared Upstash Redis database. Set it together with `UPSTASH_REDIS_REST_TOKEN`; otherwise the Vercel Marketplace KV pair is used when available. Server-side only. |
| `UPSTASH_REDIS_REST_TOKEN` | Deployed live Spotify status | Explicit Upstash Redis REST token. Set it together with `UPSTASH_REDIS_REST_URL`; otherwise the Vercel Marketplace KV pair is used when available. Server-side only. |
| `VITE_SPOTIFY_USE_MOCK` | Local development | Leave as `true` to show the sample track. Set to `false` to request the local API. |

Vite exposes variables with the `VITE_` prefix to the browser. Keep the Last.fm and Upstash settings server-side. Never rename them with a `VITE_` prefix.

## Deployment

The app is set up for Vercel. Import the repository into Vercel, use `bun run build` as the build command, and use `dist` as the output directory. Vercel deploys `api/now-playing.ts` as a serverless function alongside the site.

Before enabling live Spotify status, connect [Upstash Redis through the Vercel Marketplace](https://vercel.com/docs/marketplace-storage). The integration provides `KV_REST_API_URL` and `KV_REST_API_TOKEN` as a pair. If using the explicit `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` names instead, configure both; a partial explicit pair is not used. Then add `LASTFM_API_KEY` and `LASTFM_USERNAME` to the same Vercel environments. These settings stay server-side. The rest of the portfolio works without them.

On a static host without Vercel functions, the frontend can still build and deploy, but live Spotify status needs a server endpoint that implements `/api/now-playing`.

## External services

- The GitHub calendar requests public contribution data for the configured username from [github-contributions-api.jogruber.de](https://github-contributions-api.jogruber.de/). Change the username in `src/data.ts` when you fork the site.
- The visitor count is served by `api/visitors.ts`, which keeps one counter in the same Upstash Redis database as the Spotify status. Each browser is counted once (tracked in `localStorage`), and only the production deployment increments it, so local development and previews never do.
- The Spotify status function requests your latest scrobble from the Last.fm API. It keeps the API key on the server and returns only the track title, artist, album, cover image, play time, link, and playback status to the browser. The browser loads cover images from Last.fm's image CDN.

These widgets depend on their services being reachable. The portfolio page remains usable if a service is unavailable.

## Customize the portfolio

| File | What to edit |
| --- | --- |
| `src/data.ts` | Owner name, role, bio, contact details, social links, GitHub account, visitor counter URL, and project content. |
| `src/App.tsx` | Page layout and section order. |
| `src/assets/profile-picture.png` | Profile image and favicon asset. |
| `index.html` | Browser title, page description, favicon, and initial theme script. |
| `src/components/portfolio/` | Profile, social links, project cards, projects section, and footer markup. |
| `src/index.css` | Theme colors, global styles, font setup, and animation styles. |


## Project structure

```text
api/                   Vercel functions for Spotify playback and the visitor count
e2e/                   Playwright browser tests
scripts/               Spotify authorization helper
shared/                Types and data parsing shared by the app and API
src/App.tsx            Page layout and section composition
src/data.ts            Portfolio owner, social, counter, and project data
src/components/        Page components, charts, theme, motion, and UI components
src/components/portfolio/  Profile, projects, and footer sections
src/lib/               Shared utilities and interaction hooks
tests/                 Vitest unit tests
```

## Contributing

Changes to the portfolio code are welcome. Before opening a pull request, install dependencies and run the checks that apply to your change:

```sh
bun install
bun run lint
bun run test:unit
bun run test:e2e
bun run build
```

The browser tests build the app and serve it with Vite preview, including checks for production assets and optional chunk failures. Shared-state tests exercise independent production Redis adapters through a simulated Redis REST transport.

The browser tests use mocked responses for Spotify, GitHub contributions, and the visitor counter. They do not need credentials for those services.

## License

The portfolio source code is licensed under the MIT License. It allows reuse, modification, and redistribution when the copyright and license notices are kept. [Read the license](LICENSE).

The MIT License does not cover Kritiraj's profile photo, name, likeness, biography, or personal branding. Replace those materials before reusing the site as a template. Third-party dependencies and assets remain under their own licenses.
