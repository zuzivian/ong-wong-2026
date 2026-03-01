# ong-wong-2026

Wedding website + RSVP app for Samuel and Natasha.
Current version: **0.0.2** (March 1, 2026)

## Tech Stack

- Next.js 14 (App Router)
- React 18
- TypeScript
- SpacetimeDB 2.0 (TypeScript server + generated client bindings)

## Current Product Status

Implemented routes:

- `/` Home
- `/unlock` Invite unlock entry
- `/event-details`
- `/rsvp`
- `/rsvp/[token]`
- `/dashboard`
- `/faq`
- `/design-lab` (internal design review)
- `/admin/cutoff` (internal utility)

Core implemented capabilities:

- Invite unlock gate for non-public routes (signed server cookie, 14-day TTL)
- QR-first RSVP with fallback lookup (`firstName + lastName + inviteCode`)
- Multi-step RSVP submission (attendance, dietary, optional contact, companions)
- Guest dashboard with RSVP summary, companion list, and guest messaging
- Global RSVP cutoff support
- 30-day remembered SpacetimeDB session token
- Theme variants for design comparison (`heirloom`, `botanical`, `chapel`)

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
WEDDING_UNLOCK_SECRET=<set-a-long-random-secret-for-production>
```

If `NEXT_PUBLIC_SPACETIMEDB_HOST` is omitted, frontend defaults to `http://127.0.0.1:3000`.
`WEDDING_UNLOCK_SECRET` should be unique per deployment environment.

## Useful Scripts

- `npm run dev` Start Next.js dev server
- `npm run build` Build app
- `npm run start` Run production server
- `npm run spacetime:generate` Generate TS bindings from module
- `npm run spacetime:publish:local` Publish module to local server
- `npm run spacetime:publish` Publish module to maincloud

## Notes

- SpacetimeDB generated files in `src/module_bindings/` should be regenerated, not hand-edited.
- Design system is intentionally not finalized yet; use `/design-lab` and `?v=` query param previews for comparison.
- Full product/design rationale is documented in `docs/wedding-frontend-design-doc.md`.
