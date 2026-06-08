# @plantry/web

Vite + React + TypeScript PWA for Plantry. The frontend is one of two reads against the Convex backend; the other is the slow-loop session.

## Local dev

```
cp app/web/.env.example app/web/.env.local
# Fill in VITE_CONVEX_URL and VITE_PLANTRY_PASSCODE; see below.
npm install
npm run dev --workspace @plantry/web
```

Visit http://localhost:5173. The dev Convex deployment is `lovely-curlew-631`; its public URL is `https://lovely-curlew-631.convex.cloud`. To seed a sample week so the read-only view has data, run:

```
cd app/convex && npx convex run seed:seedCurrentWeek
```

against the dev deployment. Do not run this against prod (`disciplined-chameleon-263`).

## Env vars

| Name                    | Purpose                                                                                                                            | Example                                  |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| `VITE_CONVEX_URL`       | Convex deployment URL the React client subscribes to. Build-time.                                                                  | `https://lovely-curlew-631.convex.cloud` |
| `VITE_PLANTRY_PASSCODE` | Shared splash-gate passcode. Until this is entered the app stays on the passcode screen. Stored client-side only; no server check. | `plantry`                                |

The auth gate stores `plantry:auth` in localStorage with a one-week timeout, picked because the two phones live with their owners and a personal household app doesn't need anything tighter.

## Identity

After the passcode passes, the user picks "I am Rajat" or "I am Tuhina" once per device. The choice is written to `plantry:identity` in localStorage and read by every mutation to set `author`. Slice 1 does NOT mirror the pick into Convex's `userProfiles` table; a later slice adds that write once the `setUserProfile` mutation exists.

A small "Not me" link in the header clears the local identity and shows the picker again.

## Service worker and offline

Workbox caches the app shell (the Vite PWA plugin handles this). The last successful `getCurrentWeek` response is cached in localStorage under `plantry:lastWeek`. When the app loads offline and Convex is unreachable, the cached week renders with a small banner "Showing last known menu (offline)".

The read-only slice does not write while offline.
