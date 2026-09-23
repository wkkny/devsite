# Kritiraj B’s Portfolio

A personal portfolio built with React, TypeScript, Vite, Tailwind CSS v4, and shadcn/ui. It uses the Nova preset, Base UI primitives, Geist Variable, CSS-variable theme tokens, and the `@/` import aliases.

## Development

```sh
bun install
bun run dev
```

## Design system

- `components.json` stores the shadcn/ui setup.
- `src/index.css` defines the theme tokens and global styles.
- `src/components/ui/` contains the installed shadcn/ui components.
- Add more components with `bunx --bun shadcn@latest add <component>`.

Oxlint is configured in `.oxlintrc.json`, with `@shadcn/lint` registered as a plugin. Existing Oxlint rules are preserved; no shadcn-specific rules are enabled yet.

## Scripts

| Command | What it does |
| --- | --- |
| `bun run dev` | Start the local Vite server |
| `bun run dev:spotify` | Start Vercel's local server for the live Spotify endpoint |
| `bun run build` | Type-check the app and create a production build |
| `bun run preview` | Preview the production build |
| `bun run lint` | Run Oxlint |
| `bun run test` | Run Spotify endpoint tests and the browser smoke test |
| `bun run test:unit` | Run Spotify endpoint tests |
| `bun run test:e2e` | Run the homepage smoke test in Chromium |
| `bun run spotify:token` | Authorize Spotify and print a refresh token |

## Spotify status

The hero shows the current song, or the most recent song if it played within the last 24 hours. The song title links to Spotify. If playback is unavailable, the line is hidden.

Plain `bun run dev` shows a sample song. To use your own playback locally, copy `.env.example` to `.env`, add `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET`, register `http://127.0.0.1:8765/callback` as a redirect URI in your Spotify app, and run `bun run spotify:token`. Add the printed `SPOTIFY_REFRESH_TOKEN` to `.env`, set `VITE_SPOTIFY_USE_MOCK=false`, then run `bun run dev:spotify`.

Set the same three `SPOTIFY_` variables in Vercel for production. Keep them server-side; they must never use the `VITE_` prefix.
