import { expect, test } from '@playwright/test';

import { expectNoHorizontalOverflow, expectSingleH1 } from './helpers/page-assertions';
import { addAdminCookie } from './helpers/session-cookies';

const adminPin = process.env.ADMIN_PIN ?? '123456';

test('ADMIN-01 admin landing redirects unauthenticated visitors to login', async ({
  page,
}) => {
  await page.goto('/admin');

  await expect(page).toHaveURL(/\/admin\/login$/);
  await expect(page.getByRole('heading', { name: 'Admin Access' })).toBeVisible();
});

test('ADMINLOGIN-01 ADMINLOGIN-02 ADMINLOGIN-03 admin login loads directly and shows inline errors for an invalid PIN', async ({
  page,
}) => {
  await page.goto('/admin/login');

  await expectSingleH1(page);
  await page.getByLabel('Admin PIN').fill('wrong-pin');
  await page.getByRole('button', { name: 'Enter' }).click();

  await expect(page.getByRole('alert').filter({ hasText: 'Incorrect PIN.' })).toBeVisible();
});

test('ADMINLOGIN-02 ADMINLOGIN-04 login supports Enter and redirects to the admin dashboard', async ({
  page,
}) => {
  await page.goto('/admin/login');

  await page.getByLabel('Admin PIN').fill(adminPin);
  await page.getByLabel('Admin PIN').press('Enter');

  await expect(page).toHaveURL(/\/admin\/guests$/);
  await expect(page.getByRole('heading', { name: 'Guest Operations Dashboard' })).toBeVisible();
});

test('ADMIN-02 ADMINGUESTS-01 /admin honors a valid admin session and redirects to guests', async ({
  page,
}) => {
  await addAdminCookie(page.context());
  await page.goto('/admin');

  await expect(page).toHaveURL(/\/admin\/guests$/);
});

test('ADMINGUESTS-02 ADMINGUESTS-03 A11Y-01 A11Y-09 admin guests renders tab controls without horizontal overflow at tablet width', async ({
  page,
}) => {
  await page.setViewportSize({ width: 768, height: 900 });
  await addAdminCookie(page.context());
  await page.goto('/admin/guests');

  await expectSingleH1(page);
  await expect(page.getByRole('heading', { name: 'Guest Operations Dashboard' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Guest list' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Add Guests' })).toBeVisible();
  await expect(page.getByRole('tab', { name: 'Messages' })).toBeVisible();
  await expectNoHorizontalOverflow(page);
});
