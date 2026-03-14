# ong-wong-2026

Wedding website + RSVP app for Samuel and Natasha.
Current version: **0.0.2** with live-code updates through **March 14, 2026**

## Tech Stack

- Next.js 16 (App Router)
- React 19
- TypeScript
- SpacetimeDB 2.0.1 (TypeScript server + generated client bindings)

## Current Product Status

Implemented routes:

- `/` Home
- `/rsvp`
- `/rsvp/[token]`
- `/dashboard`
- `/faq`
- `/admin/login`
- `/admin/guests` (admin)

Core implemented capabilities:

- Invite unlock gate for non-public routes (signed server cookie, 180-day TTL, invite code embedded in the signed payload)
- QR-first RSVP with fallback lookup (`firstName + lastName + inviteCode`)
- Guest portal state management across home, RSVP, dashboard, and QR unlock flows
- Multi-step RSVP submission (attendance, dietary, optional contact, companions)
- Guest dashboard with RSVP summary, companion list, invite-code-aware refresh, and guest messaging
- Admin guest operations dashboard with search, inline RSVP/contact editing, companion replacement, bulk RSVP actions, guest creation/import, QR tools, and message triage
- Fixed RSVP cutoff in `shared/globals.ts` (31 May 2026, 11:59 PM Singapore time)

## Project Structure

- `src/app/` Next.js routes
- `src/components/` UI and flow components
- `src/lib/` shared frontend helpers
- `src/module_bindings/` generated SpacetimeDB bindings (do not edit manually)
- `spacetimedb/src/` backend schema and reducers
- `docs/` product/design documentation

## Local Development

### 1) Install dependencies

```bash
npm install
```

### 2) Start SpacetimeDB (separate terminal)

```bash
spacetime start
```

### 3) Publish backend module locally

```bash
npm run spacetime:publish:local
```

### 4) Generate client bindings

```bash
npm run spacetime:generate
```

### 5) Start frontend

```bash
npm run dev
```

## Environment Variables

Create `.env.local` with:

```env
NEXT_PUBLIC_SPACETIMEDB_HOST=http://127.0.0.1:3000
NEXT_PUBLIC_SPACETIMEDB_DB_NAME=<your_db_name>
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SPACETIMEDB_DEBUG=0
SESSION_SIGNING_SECRET=<set-a-long-random-secret>
ADMIN_PIN=<pin-for-accessing-admin-routes>
```

Notes:

- `NEXT_PUBLIC_SPACETIMEDB_HOST` defaults to `http://127.0.0.1:3000` only in development.
- `NEXT_PUBLIC_APP_URL` should be the canonical public site origin in deployed environments so QR codes point at the correct domain.
- `NEXT_PUBLIC_SPACETIMEDB_DEBUG=1` enables verbose client-side SpacetimeDB debug logging; leave it `0` for normal use.
- `SESSION_SIGNING_SECRET` signs guest unlock and admin session cookies, must be set in production, and should be unique per deployment environment.
- `WEDDING_UNLOCK_SECRET` is still accepted as a temporary fallback for older deployments, but new environments should use `SESSION_SIGNING_SECRET`.
- In non-production environments, the app falls back to a development-only signing secret so local unlock/admin flows work without extra setup.
- `ADMIN_PIN` is required for `/admin/login`, and both unlock/admin auth endpoints use in-memory request rate limiting.

## Useful Scripts

- `npm run dev` Start Next.js dev server
- `npm run build` Build app
- `npm run start` Run production server
- `npm run spacetime:generate` Generate TS bindings from module
- `npm run spacetime:publish:local` Publish module to local server
- `npm run spacetime:publish` Publish module to maincloud

## Notes

- Recent architecture changes are reflected in these commits:
  - `7a0b008` `feat: implement invite unlock functionality with session management`
  - `85db8b2` `feat: add invite unlock gate and bump to v0.0.2`
  - `fb4a5cc` `fix: add server-side unlock guard to RSVP and dashboard routes`
  - `dde28e1` `feat: Refactor RSVP flow to utilize guest portal state management`
- SpacetimeDB generated files in `src/module_bindings/` should be regenerated, not hand-edited.
- `/event-details` now redirects to `/`, and the legacy `/unlock` route also redirects home.
- Seed/sample guests have been removed from backend init; load real invite data before launch.
- Full product/design rationale is documented in `docs/wedding-frontend-design-doc.md`.
