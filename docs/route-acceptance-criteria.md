# Route Acceptance Criteria

Last updated: **March 21, 2026**

This document defines the minimum release bar for each live route in the wedding app. It complements the product/design brief and is intended to be used for QA, pre-launch checks, and regression review.

## Shared Accessibility Baseline

Every MVP route should meet this baseline before release:

- `A11Y-01` Each page has one clear `h1` and a logical heading order beneath it.
- `A11Y-02` All interactive controls are reachable and operable with a keyboard alone.
- `A11Y-03` Focus order follows the visual reading order, with no keyboard traps.
- `A11Y-04` Interactive elements have visible focus states and accessible names.
- `A11Y-05` Forms expose labels, required states, and inline error/status messaging in text.
- `A11Y-06` Color is not the only signal for status, completion, errors, or selected states.
- `A11Y-07` Meaningful images and iframes include descriptive `alt` text or `title`.
- `A11Y-08` Reduced-motion users can complete the core flow without depending on animation.
- `A11Y-09` Layout remains usable at mobile widths down to 320px without horizontal scrolling.
- `A11Y-10` Route guards and redirects preserve a clear recovery path back to `/`.

## `/`

Purpose: public landing page, unlock entry, and unlocked invitation/event hub.

Acceptance criteria:

- `HOME-01` Locked state shows hero copy, invitation framing, and the unlock CTA.
- `HOME-02` Unlock entry exposes clear inline validation and failure messaging.
- `HOME-03` Unlocked state shows the invitation card, RSVP action, Google Calendar action, schedule, venue, transport, and FAQ/event navigation.
- `HOME-04` Unlocked hero CTA row includes RSVP, event details anchor, and calendar action.
- `HOME-05` Invitation card displays guest-aware name copy when an invite code resolves successfully; otherwise it falls back gracefully.
- `HOME-06` External actions that open Google Maps or Google Calendar use descriptive link text and safe external-link attributes.

## `/event-details`

Purpose: legacy path preserved for compatibility.

Acceptance criteria:

- `EVENT-01` Route redirects to `/`.
- `EVENT-02` Redirect does not expose an error state or blank page.

## `/admin`

Purpose: admin landing route that resolves the correct auth destination.

Acceptance criteria:

- `ADMIN-01` Missing or expired admin sessions redirect to `/admin/login`.
- `ADMIN-02` Valid admin sessions redirect straight to `/admin/guests`.
- `ADMIN-03` The route does not render a partial loading shell before redirecting.

## `/rsvp`

Purpose: authenticated RSVP workflow entry.

Acceptance criteria:

- `RSVP-01` Locked visitors are redirected to `/`.
- `RSVP-02` Unlocked visitors land on the RSVP stepper with the invite code recovered from the signed unlock cookie.
- `RSVP-03` The flow exposes five steps with validation, progress indication, and save/submit feedback.
- `RSVP-04` Back/continue controls remain usable via keyboard and screen readers.
- `RSVP-05` Submitted guests can still review or update according to cutoff rules already enforced by the app.

## `/rsvp/[inviteCode]`

Purpose: invite-code RSVP entry path.

Acceptance criteria:

- `RSVPCODE-01` Valid invite-code entry refreshes the unlock session and resumes the RSVP flow.
- `RSVPCODE-02` Invalid or expired invite-code entry returns the guest to `/` with a recoverable path.
- `RSVPCODE-03` The route does not expose raw invite-code errors to guests.

## `/dashboard`

Purpose: authenticated guest self-service dashboard.

Acceptance criteria:

- `DASH-01` Locked visitors are redirected to `/`.
- `DASH-02` Unlocked visitors see the dashboard shell immediately and a clear loading/recovery state while invitation data resolves.
- `DASH-03` RSVP summary, invitation details, companion management, and quick links render when guest data is present.
- `DASH-04` If guest lookup fails, the page explains how to recover by returning home to unlock again.
- `DASH-05` Editing controls surface success and failure messages in text, not color alone.

## `/faq`

Purpose: authenticated reference page for common guest questions.

Acceptance criteria:

- `FAQ-01` Locked visitors are redirected to `/`.
- `FAQ-02` Page presents the current FAQ set in a readable single-column layout.
- `FAQ-03` FAQ content includes guest guidance for timing, venue, parking, dietary updates, companions, RSVP edits, invite-code recovery, and invitation help.
- `FAQ-04` Heading hierarchy and link labels remain understandable when read out of visual context.

## `/admin/login`

Purpose: admin authentication entry.

Acceptance criteria:

- `ADMINLOGIN-01` Page loads without guest unlock requirements.
- `ADMINLOGIN-02` PIN field is labeled, keyboard-focusable, and supports submit via Enter.
- `ADMINLOGIN-03` Wrong PIN returns inline error text without navigating away.
- `ADMINLOGIN-04` Successful login redirects to `/admin/guests` and sets the admin session cookie.
- `ADMINLOGIN-05` Rate-limit failures return a clear retry message.

## `/admin/guests`

Purpose: protected admin operations dashboard.

Acceptance criteria:

- `ADMINGUESTS-01` Missing or expired admin session redirects to `/admin/login`.
- `ADMINGUESTS-02` Authenticated admins can reach the dashboard shell and tab controls.
- `ADMINGUESTS-03` Search, filter, guest-list actions, and bulk import controls expose accessible labels and tab state.
- `ADMINGUESTS-04` Inline edit and bulk actions provide success/failure text feedback.
- `ADMINGUESTS-05` The default guest tab is usable at desktop and tablet widths without clipping primary controls.
