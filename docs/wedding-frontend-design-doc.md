# Wedding Frontend Design Doc (v1.8)

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
- RSVP Flow (invite code + fallback lookup)
- Guest Dashboard
- FAQ

### Internal/Review Utilities (implemented, not public-facing MVP)

- Admin auth + landing (`/admin/login`, `/admin`)
- Admin guest dashboard (`/admin/guests`)

## 4. Deferred Scope (Post-MVP)

- Admin Guest Management (full CRUD)
- Admin Analytics
- Admin Comms workflows
- Registry/Gifts
- Seating Planner

## 5. Confirmed Product Decisions

- RSVP access: **invite code + name confirmation**
- Fallback access: **first name + last name + invite code**
- RSVP depth: attendance + dietary + optional contact details + companion details
- Companion policy: all guests can invite up to 5 companions
- Dashboard: view/edit RSVP + free-text message form
- Guest messaging copy: "We'll respond as soon as possible"
- FAQ tone: formal
- Home tone: formal with light personal warmth
- Session persistence: signed unlock cookie persisted for 180 days, with invite code embedded for preview/loading flows

## 6. Visual Design

**Heirloom** theme selected and locked. Warm ivory and marigold with formal editorial contrast. 

## 7. Venue Information

- Venue name: **The Singapore Thomson Road Baptist Church**
- Address: **45 Thomson Road, Singapore 307584**

## 8. Information Architecture and Routes

### Public/User routes

- `/` Public Home
- `/event-details` Event Details
- `/rsvp` RSVP fallback entry
- `/rsvp/[inviteCode]` invite-code RSVP path
- `/dashboard` Guest Dashboard
- `/faq` FAQ page

Access behavior:

- Home (`/`) and unlock endpoints stay public.
- Non-public routes are protected by middleware and require a valid unlock cookie.

### Internal routes

- `/admin` Admin landing (redirects to guests or login based on admin session)
- `/admin/login` Admin PIN entry
- `/admin/guests` Admin guest RSVP dashboard

## 9. RSVP Flow (Current Implementation)

Flow is currently implemented as a **5-step wizard** backed by guest portal state:

1. Welcome and confirm invitation
2. Attendance
3. Dietary requirements
4. Add loved ones (if invitation allows)
5. Review and submit

Pre-step route:

- Guests who are not yet unlocked are redirected to `/` before entering RSVP/dashboard routes.
- Invite-code entry (`/rsvp/[inviteCode]`) refreshes the unlock cookie server-side, then resumes the RSVP flow.

Post-submit actions:

- Go to Dashboard
- View Event Details

## 10. Data Model (Current Backend)

Implemented entities:

- `Guest`
  - `id`, `firstName`, `lastName`, `inviteCode`
  - All guests can invite up to 5 companions
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
- `AdminIdentity`
  - `id`, `identity (unique)`, `claimedAt`

## 11. Authentication and Session Behavior

- Guest identity is established by invite-code unlock plus fallback name+code lookup.
- Route-level access is controlled by signed unlock cookie (`wedding_unlock`) with 180-day TTL.
- Unlock cookie payload contains both expiry and normalized invite code so the home page, RSVP flow, and dashboard can restore guest context without re-entry.
- Verified guest mapping is stored in `GuestSession` (by authenticated sender identity).
- Client additionally stores the normalized unlocked invite code in local storage to smooth unlock and fallback transitions.
- Dashboard and RSVP edits depend on active verified session plus guest portal state loaded through server procedures.
- `SESSION_SIGNING_SECRET` is the primary signing key for both guest and admin cookies; `WEDDING_UNLOCK_SECRET` remains as a backward-compatibility fallback for older deployments.
- Non-production environments use a development fallback signing secret when no env secret is provided.
- `/api/unlock` and `/api/admin/auth` are protected with request rate limiting.

## 12. Implemented Features by Route

- `/`
  - Unlocked: Hero, invitation card, guest-name-aware welcome state, full schedule timeline, venue map, transport/parking, what to expect, RSVP CTA
  - Locked: Hero with unlock CTA, welcome copy, pre-RSVP checklist
- `/event-details`
  - Redirects to `/` (content consolidated into home page)
- `/rsvp` and `/rsvp/[inviteCode]`
  - Full stepper flow, validation, reducer calls, guest portal state loading, and cutoff-aware submit behavior
- `/dashboard`
  - RSVP status summary, cutoff awareness, companion display, invite code recovery, message create/edit/delete, and event/FAQ links
- `/faq`
  - Seeded with 6 formal questions and answers
- `/admin`
  - Redirects to `/admin/guests` when authenticated, otherwise `/admin/login`
- `/admin/login`
  - PIN form posting to `/api/admin/auth`, rate-limited, and setting admin session cookie
- `/admin/guests`
  - Live operations dashboard for guest search, invitation creation/import, inline RSVP/contact edits, companion management, bulk status changes, and message triage

## 13. Outstanding Decisions

No blocking product decisions currently open.

## 14. Gaps and Changes Needed Next

1. ~~Document and enforce access strategy for `/admin/cutoff` (currently internal utility route, no role guard yet).~~ ✓ Route removed; cutoff is now fixed in `shared/globals.ts`.
2. ~~Confirm whether Home should keep embedded map/schedule duplication or defer all details to `/event-details`.~~ ✓ Consolidated into home page; `/event-details` redirects to `/`.
3. ~~Add acceptance criteria per MVP route (content, UX states, accessibility baseline).~~ ✓ Baseline captured in `docs/route-acceptance-criteria.md`.

### Admin Guest Dashboard Status (Updated)

Current baseline in code: `/admin/guests` is now the live admin operations surface rather than a read-only report.

**P0 / high priority**

1. ~~**Fast search + filters**~~ — implemented for guest name, invite code, contact, and RSVP status. ✓
2. ~~**Inline RSVP editing**~~ — implemented for RSVP status, dietary notes, contact fields, companion access, and companion list updates. ✓
3. ~~**Table-level actions**~~ — implemented for bulk row selection and bulk RSVP status changes; guest create/import flows now ship from the dashboard. ✓
4. **Operational planning views** — expand current summary cards into explicit planning exports for venue/vendors.
5. ~~**Guest message inbox workflow**~~ — implemented with per-message status transitions (`new`, `in_progress`, `resolved`). ✓

**P2 / deprioritized nice additions** (tracked in §15)

7. Export mode for venue and planner handoff.
8. Reminder workflow for pending RSVP contacts.
9. Audit log of admin edits for traceability.

## 15. Outstanding Work

### Priority 1 — Before invitations are distributed

1. **Harden admin auth and credential handling** — `ADMIN_IDENTITY_BOOTSTRAP_MARKER = 'wedding-admin-bootstrap-v1'` is hardcoded in version control and is the `adminSecret` passed on every server-to-SpacetimeDB admin call. Move it to a `SPACETIMEDB_ADMIN_SECRET` env var (alongside `SESSION_SIGNING_SECRET` and `ADMIN_PIN`) so it cannot be read from the repository.

2. **Seed real guest data** — all invited guests must be loaded into SpacetimeDB (via `/admin/guests` import or `admin_upsert_guest`) before QR codes or paper invitations are distributed. Nothing in the RSVP flow works until guest records exist.

### Priority 2 — Before RSVP opens

3. **Write operational runbook** — document day-of procedures: how to verify SpacetimeDB is healthy, how to add a last-minute guest from a phone, what logs to check when a guest cannot unlock their invitation, and how to recover from an expired admin session.

4. **Acceptance test coverage for A11Y-02 through A11Y-08** — eight accessibility criteria in `docs/route-acceptance-criteria.md` are currently untested. Automatable priority: A11Y-07 (all meaningful images carry non-empty `alt` text), then A11Y-05 (all form inputs have associated labels and inline error text). A11Y-02/03/04/06/08 require manual review or specialist tooling.

5. **Live SpacetimeDB acceptance tests** — RSVP-05 (submitted guests can update), DASH-03 (dashboard renders full guest data), DASH-05 (edit feedback not color-only), and ADMINGUESTS-04 (inline edit and bulk action feedback) require a real guest record to exercise. Run these after priority 2 guest seeding is complete.

### Priority 3 — Post-RSVP or low urgency

6. **Operational planning views** — expand admin summary cards into explicit planning exports for venue/vendor handoff (confirmed head count, dietary breakdown by type, per-table arrangement).

7. **Consolidate guest session data loading** — shared guest-session summary loading already deduplicates layout/home/nav reads; the dashboard still hydrates its full portal state client-side for live editing. Remaining optimisation opportunity.

8. **Refactor large client workflows** — split `use-rsvp-workflow.ts` and `use-dashboard-workflow.ts` (~664 lines each) into smaller hooks and components so state orchestration, reducer calls, and rendering are easier to extend and test independently.

### Deprioritised (P2)

9. Export mode for venue and planner handoff.
10. Reminder workflow for pending RSVP contacts.
11. Audit log of admin edits for traceability.

### Completed

- ~~**Finalize visual design**~~ — Heirloom selected, others removed. ✓
- ~~**Remove design-review artifacts from public nav**~~ — `/design-lab` removed. ✓
- ~~**Secure admin routes**~~ — PIN-gated via `ADMIN_PIN` env variable; 8-hour signed session cookie; `/admin/login` entry point; protected layout and rate-limited auth endpoint. ✓
- ~~**Finalize and freeze production content**~~ — final copy for schedule wording, dress code, FAQ answers, venue details. ✓
- ~~**Decide home-page content density**~~ — Single-page: all event content lives on `/` when unlocked. `/event-details` redirects to `/`. ✓
- ~~**Set the RSVP cutoff date**~~ — fixed in `shared/globals.ts` at 31 May 2026 23:59 Singapore time. ✓
- ~~**Build admin RSVP dashboard**~~ — live at `/admin/guests` with editing, import, bulk status, and message management. ✓
- ~~**Add Google Calendar invite link**~~ — Added to the unlocked home CTA row and invitation card. ✓
- ~~**Scale the admin data surface**~~ — Guest and message tabs use paginated, scoped fetches with server-side filtering/search. ✓
- ~~**Add CI production gates**~~ — GitHub Actions runs unit tests, production build, smoke e2e, and acceptance tests on every push. ✓

## 16. Known Bugs and UX Issues

No active bugs are documented in this design brief. Remaining work is tracked in the next-steps and backlog sections above.

## 17. Change History

Known implementation shifts that prompted this documentation refresh:

- `7a0b008` `feat: implement invite unlock functionality with session management`
- `85db8b2` `feat: add invite unlock gate and bump to v0.0.2`
- `fb4a5cc` `fix: add server-side unlock guard to RSVP and dashboard routes`
- `bfef804` `feat: update event details and RSVP flow`
- `dde28e1` `feat: Refactor RSVP flow to utilize guest portal state management`

## 18. Possible Future Features

1. Add to Google Calendar. ✓
2. Send a copy of the RSVP response by email.
3. Keep legal/invited guest names fixed during RSVP, but allow preferred names to be submitted.
