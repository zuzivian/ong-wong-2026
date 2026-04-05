import { expect, test } from '@playwright/test';

import { expectNoHorizontalOverflow, expectSingleH1 } from './helpers/page-assertions';
import { gotoUnlocked } from './helpers/session-cookies';

test('HOME-01 HOME-02 A11Y-01 A11Y-09 locked home shows unlock flow, one h1, and no 320px overflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/');

  await expectSingleH1(page);
  await expect(page.getByRole('button', { name: 'Enter Invite Code' })).toBeVisible();

  await page.getByRole('button', { name: 'Enter Invite Code' }).click();
  await page.getByRole('button', { name: 'Unlock Invitation' }).click();

  await expect(page.getByText('Please enter your invite code.')).toBeVisible();
  await expectNoHorizontalOverflow(page);
});

test('HOME-03 HOME-04 HOME-05 HOME-06 unlocked home shows invitation, navigation actions, and safe external links', async ({
  page,
}) => {
  await gotoUnlocked(page, '/');

  await expect(page.getByText('Invitation', { exact: true })).toBeVisible();
  await expect(page.locator('#home-invitation-card').getByRole('link', { name: 'Submit RSVP' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Add to Google Calendar/i }).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Schedule' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Venue' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Getting There and Parking' })).toBeVisible();

  const calendarLink = page.getByRole('link', { name: /Add to Google Calendar/i }).first();
  await expect(calendarLink).toHaveAttribute('target', '_blank');
  await expect(calendarLink).toHaveAttribute('rel', /noopener/);

  const mapsLink = page.getByRole('link', { name: /Open in Maps/i });
  await expect(mapsLink).toHaveAttribute('target', '_blank');
  await expect(mapsLink).toHaveAttribute('rel', /noopener/);
});
