import type { BrowserContext, Page } from '@playwright/test';

import { createAdminSession, ADMIN_COOKIE_NAME } from '../../../src/lib/admin-auth';
import { createUnlockSession, UNLOCK_COOKIE_NAME } from '../../../src/lib/invite-unlock';

const baseURL = (process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000').replace(/\/$/, '');

export async function addUnlockCookie(
  context: BrowserContext,
  inviteCode = 'TESTCODE'
): Promise<void> {
  const session = await createUnlockSession(inviteCode);
  if (!session) {
    throw new Error('Unable to create an unlock session for acceptance tests.');
  }

  await context.addCookies([
    {
      name: UNLOCK_COOKIE_NAME,
      value: session,
      url: baseURL,
      httpOnly: true,
      sameSite: 'Lax',
    },
  ]);
}

export async function addAdminCookie(context: BrowserContext): Promise<void> {
  const session = await createAdminSession();

  await context.addCookies([
    {
      name: ADMIN_COOKIE_NAME,
      value: session,
      url: baseURL,
      httpOnly: true,
      sameSite: 'Strict',
    },
  ]);
}

export async function gotoUnlocked(page: Page, pathname: string, inviteCode = 'TESTCODE') {
  await addUnlockCookie(page.context(), inviteCode);
  await page.goto(pathname);
}
