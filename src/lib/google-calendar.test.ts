import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildGoogleCalendarUrl,
  buildWeddingGoogleCalendarUrl,
  WEDDING_EVENT_DESCRIPTION,
  WEDDING_EVENT_LOCATION,
  WEDDING_EVENT_TIMEZONE,
  WEDDING_EVENT_TITLE,
} from './google-calendar';

test('builds the default wedding Google Calendar URL', () => {
  const url = new URL(buildWeddingGoogleCalendarUrl());

  assert.equal(url.origin, 'https://calendar.google.com');
  assert.equal(url.pathname, '/calendar/render');
  assert.equal(url.searchParams.get('action'), 'TEMPLATE');
  assert.equal(url.searchParams.get('text'), WEDDING_EVENT_TITLE);
  assert.equal(url.searchParams.get('location'), WEDDING_EVENT_LOCATION);
  assert.equal(url.searchParams.get('details'), WEDDING_EVENT_DESCRIPTION);
  assert.equal(url.searchParams.get('ctz'), WEDDING_EVENT_TIMEZONE);
  assert.equal(url.searchParams.get('dates'), '20260815T020000Z/20260815T050000Z');
});

test('supports custom event overrides', () => {
  const url = new URL(
    buildGoogleCalendarUrl({
      title: 'Custom Event',
      description: 'Bring joy.',
      location: 'Somewhere',
      startAt: new Date(Date.UTC(2026, 0, 1, 0, 0, 0)),
      endAt: new Date(Date.UTC(2026, 0, 1, 1, 30, 0)),
      timezone: 'UTC',
    })
  );

  assert.equal(url.searchParams.get('text'), 'Custom Event');
  assert.equal(url.searchParams.get('details'), 'Bring joy.');
  assert.equal(url.searchParams.get('location'), 'Somewhere');
  assert.equal(url.searchParams.get('ctz'), 'UTC');
  assert.equal(url.searchParams.get('dates'), '20260101T000000Z/20260101T013000Z');
});
