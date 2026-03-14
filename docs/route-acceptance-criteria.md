# Route Acceptance Criteria

Last updated: **March 14, 2026**

This document defines the minimum release bar for each live route in the wedding app. It complements the product/design brief and is intended to be used for QA, pre-launch checks, and regression review.

## Shared Accessibility Baseline

Every MVP route should meet this baseline before release:

- Each page has one clear `h1` and a logical heading order beneath it.
- All interactive controls are reachable and operable with a keyboard alone.
- Focus order follows the visual reading order, with no keyboard traps.
- Interactive elements have visible focus states and accessible names.
- Forms expose labels, required states, and inline error/status messaging in text.
- Color is not the only signal for status, completion, errors, or selected states.
- Meaningful images and iframes include descriptive `alt` text or `title`.
- Reduced-motion users can complete the core flow without depending on animation.
- Layout remains usable at mobile widths down to 320px without horizontal scrolling.
- Route guards and redirects preserve a clear recovery path back to `/`.

## `/`

Purpose: public landing page, unlock entry, and unlocked invitation/event hub.

Acceptance criteria:

- Locked state shows hero copy, invitation framing, and the unlock CTA.
- Unlock entry exposes clear inline validation and failure messaging.
- Unlocked state shows the invitation card, RSVP action, Google Calendar action, schedule, venue, transport, and FAQ/event navigation.
- Unlocked hero CTA row includes RSVP, event details anchor, and calendar action.
- Invitation card displays guest-aware name copy when an invite code resolves successfully; otherwise it falls back gracefully.
- External actions that open Google Maps or Google Calendar use descriptive link text and safe external-link attributes.

## `/event-details`

Purpose: legacy path preserved for compatibility.

Acceptance criteria:

- Route redirects to `/`.
- Redirect does not expose an error state or blank page.

## `/rsvp`

Purpose: authenticated RSVP workflow entry.

Acceptance criteria:

- Locked visitors are redirected to `/`.
- Unlocked visitors land on the RSVP stepper with the invite code recovered from the signed unlock cookie.
- The flow exposes five steps with validation, progress indication, and save/submit feedback.
- Back/continue controls remain usable via keyboard and screen readers.
- Submitted guests can still review or update according to cutoff rules already enforced by the app.

## `/rsvp/[inviteCode]`

Purpose: invite-code RSVP entry path.

Acceptance criteria:

- Valid invite-code entry refreshes the unlock session and resumes the RSVP flow.
- Invalid or expired invite-code entry returns the guest to `/` with a recoverable path.
- The route does not expose raw invite-code errors to guests.

## `/dashboard`

Purpose: authenticated guest self-service dashboard.

Acceptance criteria:

- Locked visitors are redirected to `/`.
- Unlocked visitors see the dashboard shell immediately and a clear loading/recovery state while invitation data resolves.
- RSVP summary, invitation details, companion management, guest messages, and quick links render when guest data is present.
- If guest lookup fails, the page explains how to recover by returning home to unlock again.
- Editing controls surface success and failure messages in text, not color alone.

## `/faq`

Purpose: authenticated reference page for common guest questions.

Acceptance criteria:

- Locked visitors are redirected to `/`.
- Page presents the six seeded FAQ items in a readable single-column layout.
- Heading hierarchy and link labels remain understandable when read out of visual context.

## `/admin/login`

Purpose: admin authentication entry.

Acceptance criteria:

- Page loads without guest unlock requirements.
- PIN field is labeled, keyboard-focusable, and supports submit via Enter.
- Wrong PIN returns inline error text without navigating away.
- Successful login redirects to `/admin/guests` and sets the admin session cookie.
- Rate-limit failures return a clear retry message.

## `/admin/guests`

Purpose: protected admin operations dashboard.

Acceptance criteria:

- Missing or expired admin session redirects to `/admin/login`.
- Authenticated admins can reach the dashboard shell and tab controls.
- Search, filter, bulk, and message tabs expose accessible labels and tab state.
- Inline edit and bulk actions provide success/failure text feedback.
- The default guest tab is usable at desktop and tablet widths without clipping primary controls.
