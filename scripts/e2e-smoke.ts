import assert from 'node:assert/strict';

import { createUnlockSession, UNLOCK_COOKIE_NAME } from '../src/lib/invite-unlock';

const BASE_URL = (process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3000').replace(/\/$/, '');

async function request(
  pathname: string,
  init?: RequestInit & { expectedStatus?: number }
): Promise<Response> {
  const response = await fetch(`${BASE_URL}${pathname}`, {
    redirect: 'manual',
    ...init,
  });

  if (init?.expectedStatus !== undefined) {
    assert.equal(
      response.status,
      init.expectedStatus,
      `${pathname} returned ${response.status} instead of ${init.expectedStatus}`
    );
  }

  return response;
}

function assertRedirectToHome(response: Response, pathname: string) {
  assert.ok(
    response.status === 307 || response.status === 308,
    `${pathname} returned ${response.status} instead of a redirect`
  );
  assert.equal(response.headers.get('location'), '/');
}

function getFirstSetCookie(response: Response): string {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const cookieFromList = headers.getSetCookie?.()[0];
  const cookieFromHeader = response.headers.get('set-cookie');
  const cookie = cookieFromList ?? cookieFromHeader ?? '';

  assert.ok(cookie.includes('='), 'Expected response to include a Set-Cookie header.');
  return cookie;
}

async function readText(pathname: string, init?: RequestInit & { expectedStatus?: number }) {
  const response = await request(pathname, init);
  return response.text();
}

async function main() {
  const home = await readText('/', { expectedStatus: 200 });
  assert.match(home, /Samuel & Natasha/i);

  const dashboardRedirect = await request('/dashboard');
  assertRedirectToHome(dashboardRedirect, '/dashboard');

  const rsvpRedirect = await request('/rsvp');
  assertRedirectToHome(rsvpRedirect, '/rsvp');

  const unlockSession = await createUnlockSession('TESTCODE');
  const unlockCookie = `${UNLOCK_COOKIE_NAME}=${unlockSession}`;

  const unlockResponse = await request('/api/unlock', {
    headers: { Cookie: unlockCookie },
    expectedStatus: 200,
  });
  const unlockPayload = (await unlockResponse.json()) as { ok?: boolean; inviteCode?: string | null };
  assert.equal(unlockPayload.ok, true);
  assert.equal(unlockPayload.inviteCode, 'TESTCODE');

  const dashboard = await readText('/dashboard', {
    headers: { Cookie: unlockCookie },
    expectedStatus: 200,
  });
  assert.match(dashboard, /Your RSVP/i);

  const rsvp = await readText('/rsvp', {
    headers: { Cookie: unlockCookie },
    expectedStatus: 200,
  });
  assert.match(rsvp, /Step 1: Welcome and Confirm Invitation/i);

  const wrongAdminLogin = await request('/api/admin/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin: 'wrong-pin' }),
    expectedStatus: 401,
  });
  const wrongAdminPayload = (await wrongAdminLogin.json()) as { error?: string };
  assert.match(wrongAdminPayload.error ?? '', /Incorrect PIN/i);

  const adminPin = process.env.ADMIN_PIN ?? '123456';
  const adminLogin = await request('/api/admin/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin: adminPin }),
    expectedStatus: 200,
  });
  const adminCookie = getFirstSetCookie(adminLogin);
  assert.ok(adminCookie?.includes('wedding_admin='));

  const adminDashboard = await readText('/admin/guests', {
    headers: { Cookie: adminCookie },
    expectedStatus: 200,
  });
  assert.match(adminDashboard, /Guest Operations Dashboard/i);

  console.log('E2E smoke checks passed.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
