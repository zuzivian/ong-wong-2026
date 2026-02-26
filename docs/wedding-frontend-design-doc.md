# Wedding Frontend Design Doc (v1.1)

## 1. Product Summary

Build a Next.js app for **Samuel and Natasha** to support:

- Public wedding website
- Guest RSVP workflow
- Guest self-service dashboard

Wedding date: **15 August 2026**

## 2. Context and Constraints

- Wedding format: church morning service followed by lunch reception.
- Audience includes older guests, so RSVP flow must be simple.
- Invitations are per individual, with optional companions/family where allowed.
- RSVP editability is controlled by a single global cutoff date (to be set once catering deadline is known).

## 3. MVP Scope (Must-Have)

- Public Home
- Event Details
- RSVP Flow
- Guest Dashboard
- FAQ

## 4. Deferred Scope (Post-MVP)

- Admin Guest Management (nice-to-have)
- Admin Analytics (nice-to-have)
- Admin Comms (explore later)
- Registry/Gifts (skip)
- Seating Planner (skip)

## 5. Confirmed Product Decisions

- RSVP access: **QR-first**
- Fallback access: **first name + last name + invite code**
- RSVP depth: attendance + dietary + companion details
- Companion policy: configurable per guest
- Dashboard: view/edit RSVP + free-text message/question form
- Guest messaging copy: "We'll respond as soon as possible"
- FAQ tone: formal
- Home tone: formal with light personal warmth

## 6. Venue Information

- Venue name: **The Singapore Thomson Road Baptist Church**
- Address: **45 Thomson Road, Singapore 307584**
- Note: official spelling is "Thomson".

## 7. Information Architecture and Routes

Recommended Next.js App Router structure:

- `/` Public Home
- `/event-details` Event Details
- `/rsvp` RSVP fallback entry page
- `/rsvp/[token]` QR-linked RSVP path
- `/dashboard` Guest Dashboard
- `/faq` FAQ page

Future routes:

- `/admin/guests`
- `/admin/analytics`
- `/admin/comms`

## 8. Detailed View Specs

### 8.1 Public Home

Selected direction:

- Hero title: **Samuel and Natasha**
- Primary CTA: **RSVP Now**
- Intro block: short formal welcome paragraph
- Secondary CTA: Event Details

Proposed section order:

1. Hero (names, date, venue summary)
2. Welcome paragraph (formal, warm)
3. Quick links (Event Details, FAQ)
4. RSVP callout block

### 8.2 Event Details

Selected direction:

- Schedule format: simple timeline
- Venue details depth: address + map + transport/parking
- What to Expect: formal with gentle guidance

Current content placeholders:

- Morning service
- Reception (church hall)

Planned section layout:

1. Schedule
2. Venue and map
3. Transport and parking
4. What to Expect
5. RSVP CTA

### 8.3 RSVP Flow

Selected direction:

- 3-step flow
- Companion wording: **Add companion/family member**
- Confirmation CTAs: **Go to Dashboard** and **View Event Details**

Flow:

1. Identify guest (token or fallback lookup)
2. Attendance
3. Dietary requirements
4. Companion/family details (if allowed)
5. Submit and show confirmation actions

### 8.4 Guest Dashboard

Confirmed behavior:

- Show RSVP status
- Allow edits until global cutoff
- Show companion data submitted
- Accept free-text questions/messages
- Link to event details and FAQ

### 8.5 FAQ

Selected direction:

- Formal tone
- Content can remain generic/blank initially and be filled later

## 9. Data Model (Product-Level)

Initial entities:

- `Guest`
  - `id`, `firstName`, `lastName`, `inviteCode`, `qrToken`
  - `canAddCompanions`, `maxCompanions`
  - `rsvpStatus`, `updatedAt`
- `Companion`
  - `id`, `guestId`, `name`, `dietaryNotes?`, `relationship?`
- `RsvpResponse`
  - `id`, `guestId`, `attendance`, `dietaryNotes?`, `notes?`, `updatedAt`
- `GuestMessage`
  - `id`, `guestId`, `message`, `status`, `createdAt`
- `SiteContent`
  - Event details blocks and FAQ entries
- `Config`
  - `globalRsvpCutoffAt`

## 10. Visual Design Direction

Chosen style direction:

- Overall look: warm traditional, minimal refined
- Navigation: minimal top bar + prominent RSVP button
- Hero background: warm textured paper style
- Typography: classic serif + neutral sans
- RSVP form UI: stepper with progress line
- Accent motif: floral corner ornaments

Palette direction:

- Ivory / warm stone background
- Muted olive accents
- Deep charcoal text

## 11. UX Copy Principles

- Keep language formal and courteous.
- Keep directions explicit for less technical guests.
- Use short sentence structure and clear action labels.
- Avoid slang and casual internet-style phrasing.

## 12. Outstanding Decisions

1. Final RSVP cutoff date/time (once catering deadline is known)

## 13. Implementation Plan (Next)

1. Set up Next.js app shell and route scaffolding for the 5 MVP views.
2. Implement style tokens for warm traditional visual system.
3. Build static page sections for Home, Event Details, FAQ.
4. Build RSVP stepper flow (UI and client state first).
5. Add dashboard view with editable RSVP state and question form.
6. Integrate backend data and auth strategy after flow approval.

## 14. Newly Confirmed Decisions (Round B)

1. Dashboard session persistence: "Remember me" for 30 days.
2. FAQ initial state: seed with 6 generic formal questions.
3. RSVP contact capture: ask optional phone/email if missing.

## 15. FAQ Seed Set (Formal Placeholder Content)

1. What time should guests arrive for the service?
2. Where is the ceremony and reception venue located?
3. Is parking available at or near the venue?
4. How should dietary requirements be submitted?
5. May I bring a companion or family member?
6. Whom should I contact if I need assistance?

## 16. Style Variant Review (Home + RSVP)

Three concrete variants are implemented for comparison:

1. `heirloom`
   - Balanced ivory paper look
   - Restrained floral corner ornament
   - Classic gradient stepper
2. `botanical`
   - Softer olive botanical accents
   - Flower motif and gentler tones
   - Slightly thicker rounded stepper
3. `chapel`
   - Stronger formal contrast
   - Symbolic roundel motif
   - Narrower bar-style stepper

Preview routes:
- `/?v=heirloom|botanical|chapel`
- `/rsvp?v=heirloom|botanical|chapel`
- `/design-lab` (kept for internal review, not in main navigation)

Live theme switching:
- A floating bottom-right bar now provides live scheme toggles across pages.

## 17. Placeholder Imagery (User Uploads)

Homepage jumbotron now uses the three uploaded couple photos as background options:

1. `public/photos/photo-1.jpg`
2. `public/photos/photo-2.jpg`
3. `public/photos/photo-3.jpg`

Current mapping:
- `heirloom` -> `photo-2.jpg`
- `botanical` -> `photo-1.jpg`
- `chapel` -> `photo-3.jpg`

## 18. Color Scheme Direction (Design Lab)

Three intentionally different, non-dark-background palettes:

1. `heirloom`: warm ivory + marigold + deep navy accents
2. `botanical`: mint/sage + coral accents + green ink tones
3. `chapel`: powder blue + gold accents + navy ink tones
