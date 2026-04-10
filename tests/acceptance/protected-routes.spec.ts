import { expect, test } from '@playwright/test';

import { expectNoHorizontalOverflow, expectSingleH1 } from './helpers/page-assertions';
import { gotoUnlocked } from './helpers/session-cookies';

test('EVENT-01 EVENT-02 /event-details redirects home cleanly', async ({ page }) => {
  await page.goto('/event-details');

  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('heading', { name: 'Samuel & Natasha' })).toBeVisible();
});

test('RSVP-01 DASH-01 FAQ-01 locked guest routes redirect home', async ({ page }) => {
  for (const pathname of ['/rsvp', '/dashboard', '/faq']) {
    await page.goto(pathname);
    await expect(page).toHaveURL(/\/$/);
  }
});

test('RSVP-02 RSVP-03 unlocked RSVP loads with five visible steps and progress text', async ({ page }) => {
  await gotoUnlocked(page, '/rsvp');

  await expectSingleH1(page);
  await expect(page.getByText('Step 1: Name')).toBeVisible();
  await expect(page.getByRole('button', { name: '1 Name' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Attendance' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Dietary Requirements' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add Loved Ones' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Review and Submit' })).toBeVisible();
  await expect(page.getByText('Step 1 of 5')).toBeVisible();
});

test('RSVPCODE-01 unlocked /rsvp/[inviteCode] redirects home cleanly when the cookie matches', async ({
  page,
}) => {
  await gotoUnlocked(page, '/rsvp/test-code', 'TESTCODE');

  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('h1', { hasText: 'Samuel & Natasha' })).toBeVisible();
});

test('DASH-02 DASH-04 A11Y-01 dashboard shows a recovery state when guest data is unresolved', async ({
  page,
}) => {
  await gotoUnlocked(page, '/dashboard');

  await expectSingleH1(page);
  await expect(page.getByRole('heading', { name: 'Loading Invitation' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Go to Home to Unlock/i })).toBeVisible();
});

test('FAQ-02 FAQ-03 A11Y-01 A11Y-09 unlocked FAQ renders the current content set without horizontal overflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await gotoUnlocked(page, '/faq');

  await expectSingleH1(page);
  await expect(page.getByRole('heading', { name: 'Frequently Asked Questions' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /What is the dress code/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /dietary requirements/i })).toBeVisible();
  await expect(page.getByRole('heading', { name: /bring a companion or family member/i })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('RSVPCODE-02 RSVPCODE-03 /rsvp/[inviteCode] redirects home cleanly for a mismatched code', async ({
  page,
}) => {
  await gotoUnlocked(page, '/rsvp/wrongcode', 'TESTCODE');

  await expect(page).toHaveURL(/\/$/);
  // RSVPCODE-02: home page with a recoverable path is shown
  await expect(page.getByRole('heading', { name: 'Samuel & Natasha' })).toBeVisible();
  // RSVPCODE-03: no raw error text exposed
  await expect(page.getByText(/Error:/i)).not.toBeVisible();
});
