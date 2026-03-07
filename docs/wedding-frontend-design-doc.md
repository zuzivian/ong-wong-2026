# Wedding Frontend Design Doc (v1.4)

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
- Invite unlock gate (`/unlock`) for non-public routes
- Event Details
- RSVP Flow (QR + fallback lookup)
- Guest Dashboard
- FAQ

### Internal/Review Utilities (implemented, not public-facing MVP)

- Design Lab (`/design-lab`) for variant comparison
- Admin RSVP cutoff page (`/admin/cutoff`) for global edit deadline

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
- `/unlock` Invite-code unlock route
- `/event-details` Event Details
- `/rsvp` RSVP fallback entry
- `/rsvp/[token]` QR-linked RSVP path
- `/dashboard` Guest Dashboard
- `/faq` FAQ page

Access behavior:

- Home (`/`) and unlock endpoints stay public.
- Non-public routes are protected by middleware and require a valid unlock cookie.

### Internal route

- `/admin/cutoff` Global RSVP cutoff configuration

## 9. RSVP Flow (Current Implementation)

Flow is currently implemented as a **7-step wizard**:

1. Confirm name
2. Attendance
3. Dietary requirements
4. Contact details (optional)
5. Add loved ones (if invitation allows)
6. Review and submit

Pre-step route:

- Guests who are not yet unlocked are redirected to `/unlock` before entering RSVP/dashboard routes.

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
  - Hero, formal welcome, schedule snapshot, venue summary/map, quick links, RSVP CTA
- `/event-details`
  - Schedule timeline, venue map, transport/parking, what to expect, RSVP CTA
- `/rsvp` and `/rsvp/[token]`
  - Full stepper flow, validation, reducer calls, cutoff-aware submit behavior
- `/dashboard`
  - RSVP status summary, cutoff awareness, companion display, message submission, event/FAQ links
- `/faq`
  - Seeded with 6 formal questions and answers
- `/admin/cutoff`
  - Set/clear global RSVP edit cutoff

## 13. Outstanding Decisions

1. Final RSVP cutoff date/time (operational value to be set)

## 14. Gaps and Changes Needed Next

1. Document and enforce access strategy for `/admin/cutoff` (currently internal utility route, no role guard yet).
2. Confirm whether Home should keep embedded map/schedule duplication or defer all details to `/event-details`.
3. Add acceptance criteria per MVP route (content, UX states, accessibility baseline).
4. Define production content freeze checklist (final copy, schedule wording, dress code wording).

## 15. Immediate Next Steps

1. ~~**Finalize visual design**~~ — Heirloom selected, others removed. ✓
2. ~~**Remove design-review artifacts from public nav**~~ — `/design-lab` removed. ✓
3. ~~**Secure `/admin/cutoff`**~~ — PIN-gated via `ADMIN_PIN` env variable; 8-hour signed session cookie; `/admin/login` entry point. ✓
4. **Finalize and freeze production content** — final copy for schedule wording, dress code, FAQ answers, venue details.
5. **Decide home-page content density** — summary that defers to `/event-details`, or standalone with map/schedule embedded.
6. **Set the RSVP cutoff date** — default pre-filled to 31 May 2026 23:59 in the admin UI. Confirm and save before launch. TODO: migrate cutoff management to admin dashboard (post-MVP).

## 16. Known Bugs and UX Issues

All bugs resolved as of v1.4. None outstanding.

## 17. Possible Future Features

1. Add to Google Calendar.
2. Send a copy of the RSVP response by email.
3. Keep legal/invited guest names fixed during RSVP, but allow preferred names to be submitted.
