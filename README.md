# denuwe frontend (`denuwe-core`)

React + Vite UI for denuwe. Foundation mirrors LPay (`lpay-core`).

Brand assets live in `public/`: `denuwe-mark.png` (the "d" mark, transparent, used for the favicon and in-app logo) and `denuwe-wordmark.jpg` (social preview image). The theme colors are navy `#1E3A8A`, blue `#2A6BD6` and sky `#5AAEE8`, defined in `src/styles.css`; the wordmark is set in Source Serif 4 via `src/components/brand/Brand.tsx`.

## Quick start

```bash
cp .env.example .env
npm install
npm run dev
```

Open http://localhost:3000 — the home page shows frontend, backend API and database status, polling `/api`, `/api/health` and `/api/v1` via the Vite proxy (`VITE_APP_URL` → Laravel).

## Real-time messaging

`/messages` (and the chats in My Society and the messaging dock) update live over Laravel Reverb, using `laravel-echo` + `pusher-js` (`src/services/realtime.ts`). Private channels are authorized with the same JWT, through the shared axios client, so an expired token is refreshed first. Set these in `.env` (restart `npm run dev` afterwards):

```env
VITE_REVERB_APP_KEY=   # same value as REVERB_APP_KEY in denuwe-ws/.env (public; never the secret)
VITE_REVERB_HOST=127.0.0.1
VITE_REVERB_PORT=8080
VITE_REVERB_SCHEME=http
```

Without a key the app works as before, minus live updates ("Live updates off"). In production use `wss` on 443; see `.env.vercel.example`.

## Installable app (PWA)

denuwe installs as an app on Windows, macOS, Linux, Android, iPhone and iPad. The pieces are `public/manifest.webmanifest`, `public/sw.js`, the icons in `public/icons/` (generated from `denuwe-mark.png`; maskable and Apple touch versions have a white background) and `src/lib/pwa.ts`, which registers the service worker and holds the browser's install prompt.

The service worker always goes to the network first for pages, caches the content-hashed `/assets/*` files, and falls back to the saved app shell when offline. It never handles `/api`, `/storage` or real-time traffic. Installing needs HTTPS (or `localhost`); `vercel.json` serves `sw.js` with `Cache-Control: no-cache` so updates are picked up.

The login page's **Download PC / Android / iOS** buttons (`src/components/auth/AppDownloads.tsx`) highlight the visitor's platform (`src/lib/platform.ts`):

- **Chrome, Edge, Samsung Internet:** the matching button opens the browser's own install dialog. When it isn't available yet (or on Firefox or Safari), it shows step-by-step instructions instead.
- **iPhone and iPad:** shows the Safari *Share → Add to Home Screen* steps.
- **Once installed:** the button changes to "Open denuwe". It does the same when denuwe is already running as the app.

When native apps are published, set their links in `.env` and the buttons go to the store instead, with no UI change:

```env
VITE_APP_DOWNLOAD_URL_PC=       # Microsoft Store or a Windows installer (https)
VITE_APP_DOWNLOAD_URL_ANDROID=  # Google Play
VITE_APP_DOWNLOAD_URL_IOS=      # Apple App Store
```

These are read in `src/config/appDownloads.ts` (`APP_DOWNLOAD_URLS`).
