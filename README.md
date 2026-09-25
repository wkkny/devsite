# Kritiraj's portfolio

This repository contains the source code and content for Kritiraj (Kenny)'s portfolio. The site is a responsive React app with a project list, GitHub contribution calendar, draggable tech logos, theme switcher, visitor count, and an optional live Spotify status.

## Features

- Light and dark themes, with the selected theme saved in the browser.
- Responsive layout, touch-friendly controls, and reduced-motion support.
- Draggable technology decorations on desktop. Visitors can add, move, and remove logos. Their layout is saved in local storage for seven days.
- Project cards with grid and list views on desktop.
- GitHub contribution activity loaded from a public API.
- Optional Spotify status for the current track or the most recently played track. The last played track stays visible even when Spotify reports no playback or requests fail.
- A visitor count backed by CounterAPI. Local development reads the count without incrementing it.

## Tech stack

- React 19 and TypeScript
- Vite 8
- Tailwind CSS 4 and shadcn/ui components built on Base UI
- Motion for React, Paper Design shaders, and Geist Variable
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

Open the local URL printed by Vite. The default development server shows sample Spotify playback and does not need Spotify credentials.

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
| `bun run spotify:token` | Authorize Spotify and print a refresh token for local use. |

If Playwright has no Chromium binary installed, run `bunx playwright install chromium` once.

## Spotify setup

Spotify playback is optional. Without credentials, the live status is hidden. The local Vite server uses a sample track unless you opt into the Vercel API.

1. Create an app in the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).
2. Add `http://127.0.0.1:8765/callback` as a redirect URI in the Spotify app settings.
3. Copy `.env.example` to `.env` and fill in `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET`.
4. Run `bun run spotify:token`. Authorize the requested current playback and recent playback access. The command prints `SPOTIFY_REFRESH_TOKEN` in the terminal.
5. Add that refresh token to `.env`, then set `VITE_SPOTIFY_USE_MOCK=false`.
6. Run `bun run dev:spotify` to use the `/api/now-playing` endpoint locally.

The page checks Spotify every 30 seconds. When there is no active playback, the endpoint shows the most recently played track, regardless of when it was played. If Spotify reports no playback history or an upstream request fails (including 429 rate limits), the endpoint keeps serving the last played track, and the page backs off for the requested `Retry-After` duration before polling again.

### Environment variables

| Variable | Required for | Description |
| --- | --- | --- |
| `SPOTIFY_CLIENT_ID` | Live Spotify status | Spotify app client ID. Server-side only. |
| `SPOTIFY_CLIENT_SECRET` | Live Spotify status | Spotify app client secret. Server-side only. |
| `SPOTIFY_REFRESH_TOKEN` | Live Spotify status | Token printed by `bun run spotify:token`. Server-side only. |
| `VITE_SPOTIFY_USE_MOCK` | Local development | Leave as `true` to show the sample track. Set to `false` to request the local API. |

Vite exposes variables with the `VITE_` prefix to the browser. Keep all Spotify credentials under their `SPOTIFY_` names and never rename them with a `VITE_` prefix.

## Deployment

The app is set up for Vercel. Import the repository into Vercel, use `bun run build` as the build command, and use `dist` as the output directory. Vercel deploys `api/now-playing.ts` as a serverless function alongside the site.

Add `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`, and `SPOTIFY_REFRESH_TOKEN` to the Vercel environments where you want the live Spotify status. Keep these as server-side environment variables. The rest of the portfolio works without Spotify credentials.

On a static host without Vercel functions, the frontend can still build and deploy, but live Spotify status needs a server endpoint that implements `/api/now-playing`.

## External services

- The GitHub calendar requests public contribution data for the configured username from [github-contributions-api.jogruber.de](https://github-contributions-api.jogruber.de/). Change the username in `src/data.ts` when you fork the site.
- The visitor count uses CounterAPI. Its endpoint is configured in `src/data.ts` and currently belongs to the author's portfolio.
- The Spotify function requests playback data from Spotify's Web API. It keeps credentials on the server and returns only the track title, artist, link, and playback status to the browser.

These widgets depend on their services being reachable. The portfolio page remains usable if a service is unavailable.

## Customize the portfolio

| File | What to edit |
| --- | --- |
| `src/data.ts` | Owner name, role, bio, contact details, social links, GitHub account, visitor counter URL, and project content. |
| `src/App.tsx` | Page layout and section order. |
| `src/assets/profile-picture.png` | Profile image and favicon asset. |
| `index.html` | Browser title, page description, favicon, and initial theme script. |
| `src/components/portfolio/` | Profile, social links, project cards, projects section, and footer markup. |
| `src/components/draggable-decorations.tsx` | Default decorations and logos visitors can add. |
| `src/index.css` | Theme colors, global styles, font setup, and animation styles. |

The visitor counter URL in `src/data.ts` currently points to the author's CounterAPI counter. Change it before using the counter on another portfolio.

## Project structure

```text
api/                   Vercel function for Spotify playback
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

The browser tests use mocked responses for Spotify, GitHub contributions, and the visitor counter. They do not need credentials for those services.

## License

The portfolio source code is licensed under the MIT License. It allows reuse, modification, and redistribution when the copyright and license notices are kept. [Read the license](LICENSE).

The MIT License does not cover Kritiraj's profile photo, name, likeness, biography, or personal branding. Replace those materials before reusing the site as a template. Third-party dependencies and assets remain under their own licenses.
