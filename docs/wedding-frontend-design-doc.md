# Wedding Frontend Design Doc (v1.6)

## 1. Product Summary

Build a Next.js app for **Samuel and Natasha** to support:

- Public wedding website
- Guest RSVP workflow
- Guest self-service dashboard

Wedding date: **15 August 2026**

## 2. Context and Constraints

- Wedding format: church morning service followed by lunch reception.
- Audience includes older guests, so RSVP flow must be simple, explicit, and forgiving.
- Invitations are per individual, with optional companions/family where allowed.
- RSVP editability is controlled by a single global cutoff date.

## 3. MVP Scope (Current)

- Public Home
- Invite unlock gate (inline on `/` with cookie/API session)
- Event Details
- RSVP Flow (QR + fallback lookup)
- Guest Dashboard
- FAQ

### Internal/Review Utilities (implemented, not public-facing MVP)

- Admin auth + landing (`/admin/login`, `/admin`)
- Admin guest dashboard (`/admin/guests`)
- Admin RSVP cutoff page (`/admin/cutoff`)

## 4. Deferred Scope (Post-MVP)

- Admin Guest Management (full CRUD)
- Admin Analytics
- Admin Comms workflows
- Registry/Gifts
- Seating Planner

## 5. Confirmed Product Decisions

- RSVP access: **QR-first**
- Fallback access: **first name + last name + invite code**
- RSVP depth: attendance + dietary + optional contact details + companion details
- Companion policy: configurable per guest (`canAddCompanions`, `maxCompanions`)
- Dashboard: view/edit RSVP + free-text message form
- Guest messaging copy: "We'll respond as soon as possible"
- FAQ tone: formal
- Home tone: formal with light personal warmth
- Session persistence: "Remember me" token persisted for 30 days

## 6. Visual Design

**Heirloom** theme selected and locked. Warm ivory and marigold with formal editorial contrast. Other variants (`botanical`, `chapel`) and the `/design-lab` route have been removed.

## 7. Venue Information

- Venue name: **The Singapore Thomson Road Baptist Church**
- Address: **45 Thomson Road, Singapore 307584**
- Note: official spelling is "Thomson".

## 8. Information Architecture and Routes

### Public/User routes

- `/` Public Home
- `/event-details` Event Details
- `/rsvp` RSVP fallback entry
- `/rsvp/[token]` QR-linked RSVP path
- `/dashboard` Guest Dashboard
- `/faq` FAQ page

Legacy behavior:

- `/unlock` is now legacy and redirects to `/` via middleware.

Access behavior:

- Home (`/`) and unlock endpoints stay public.
- Non-public routes are protected by middleware and require a valid unlock cookie.

### Internal routes

- `/admin` Admin landing (redirects to guests or login based on admin session)
- `/admin/login` Admin PIN entry
- `/admin/guests` Admin guest RSVP dashboard
- `/admin/cutoff` Global RSVP cutoff configuration

## 9. RSVP Flow (Current Implementation)

Flow is currently implemented as a **6-step wizard**:

1. Confirm name
2. Attendance
3. Dietary requirements
4. Contact details (optional)
5. Add loved ones (if invitation allows)
6. Review and submit

Pre-step route:

- Guests who are not yet unlocked are redirected to `/` before entering RSVP/dashboard routes.

Post-submit actions:

- Go to Dashboard
- View Event Details

## 10. Data Model (Current Backend)

Implemented entities:

- `Guest`
  - `id`, `firstName`, `lastName`, `inviteCode`, `qrToken`
  - `canAddCompanions`, `maxCompanions`
  - `contactEmail?`, `contactPhone?`
  - `rsvpStatus`, `updatedAt`
- `RsvpResponse`
  - `id`, `guestId (unique)`, `attendance`, `dietaryNotes?`, `notes?`, `updatedAt`
- `Companion`
  - `id`, `guestId`, `name`, `dietaryNotes?`, `relationship?`, `updatedAt`
- `GuestMessage`
  - `id`, `guestId`, `message`, `status`, `createdAt`
- `GuestSession`
  - `sender (identity PK)`, `guestId`, `verifiedAt`
- `Config`
  - `id`, `globalRsvpCutoffAt?`, `updatedAt`

## 11. Authentication and Session Behavior

- Guest identity is established by either token lookup or fallback name+code lookup.
- Route-level access is controlled by signed unlock cookie (`wedding_unlock`) with 14-day TTL.
- Verified guest mapping is stored in `GuestSession` (by authenticated sender identity).
- Client stores Spacetime auth token in localStorage with 30-day expiry.
- Dashboard and RSVP edits depend on active verified session.

## 12. Implemented Features by Route

- `/`
  - Unlocked: Hero, invitation card, full schedule timeline, venue map, transport/parking, what to expect, RSVP CTA
  - Locked: Hero with unlock CTA, welcome copy, pre-RSVP checklist
- `/event-details`
  - Redirects to `/` (content consolidated into home page)
- `/rsvp` and `/rsvp/[token]`
  - Full stepper flow, validation, reducer calls, cutoff-aware submit behavior
- `/dashboard`
  - RSVP status summary, cutoff awareness, companion display, message submission, event/FAQ links
- `/faq`
  - Seeded with 6 formal questions and answers
- `/admin`
  - Redirects to `/admin/guests` when authenticated, otherwise `/admin/login`
- `/admin/login`
  - PIN form posting to `/api/admin/auth` and setting admin session cookie
- `/admin/guests`
  - Live table of guests with status, dietary notes, companion details, unread message counts, and summary stats
- `/admin/cutoff`
  - Set/clear global RSVP edit cutoff

## 13. Outstanding Decisions

No blocking product decisions currently open.

## 14. Gaps and Changes Needed Next

1. ~~Document and enforce access strategy for `/admin/cutoff` (currently internal utility route, no role guard yet).~~ ✓
2. ~~Confirm whether Home should keep embedded map/schedule duplication or defer all details to `/event-details`.~~ ✓ Consolidated into home page; `/event-details` redirects to `/`.
3. Add acceptance criteria per MVP route (content, UX states, accessibility baseline).

### Admin Guest Dashboard Backlog (Updated)

Current baseline in code: `/admin/guests` now exists with read-only list, summary stats, companion details, and unread message counts.

**P0 / high priority**

1. **Fast search + filters** — search by name/invite code/QR/contact; filter by RSVP status, no-response, companions, dietary, message status.
2. **Inline RSVP editing** — update RSVP status, dietary notes, contact details, and companion allowance/list from dashboard.
3. **Table-level actions** — bulk select + bulk status actions; bulk guest import with validation preview.
4. **QR operations** — regenerate token, download single QR, and bulk export QR assets.
5. **Operational planning views** — headcount and meal summaries by status/dietary/companions.
6. **Guest message inbox workflow** — queue by status (`new`, `in_progress`, `resolved`) and per-guest handling.

**P2 / deprioritized nice additions**

7. export mode for venue and planner handoff.
8. Reminder workflow for pending RSVP contacts.
9. Audit log of admin edits for traceability.

## 15. Immediate Next Steps

1. ~~**Finalize visual design**~~ — Heirloom selected, others removed. ✓
2. ~~**Remove design-review artifacts from public nav**~~ — `/design-lab` removed. ✓
3. ~~**Secure `/admin/cutoff`**~~ — PIN-gated via `ADMIN_PIN` env variable; 8-hour signed session cookie; `/admin/login` entry point. ✓
4. ~~**Finalize and freeze production content**~~ — final copy for schedule wording, dress code, FAQ answers, venue details. ✓
5. ~~**Decide home-page content density**~~ ✓ — Single-page: all event content (schedule, venue, transport, what to expect) lives on `/` when unlocked. `/event-details` redirects to `/`.
6. ~~**Set the RSVP cutoff date**~~ — default pre-filled to 31 May 2026 23:59 in the admin UI. Confirmed and saved. ✓
7. ~~**Build admin RSVP dashboard**~~ — baseline dashboard now live at `/admin/guests` with read-only reporting. ✓
8. **Seed real guest data** — load all invited guests into SpacetimeDB before launch.
9. **Generate and validate QR codes** — produce per-guest QR tokens and confirm `/rsvp/[token]` unlock flow works end-to-end.
10. **Deliver Admin Dashboard P0 backlog items 1-6** — promote dashboard from read-only reporting to day-to-day operations.

## 16. Known Bugs and UX Issues

All bugs resolved as of v1.4. None outstanding.

## 17. Possible Future Features

1. Add to Google Calendar.
2. Send a copy of the RSVP response by email.
3. Keep legal/invited guest names fixed during RSVP, but allow preferred names to be submitted.
