import assert from 'node:assert/strict';

const BASE_URL = (process.env.E2E_BASE_URL ?? 'http://127.0.0.1:3000').replace(/\/$/, '');
const E2E_INVITE_CODE = 'E2ESMOKE';

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

function toCookieHeader(cookie: string): string {
  return cookie.split(';', 1)[0] ?? cookie;
}

async function readText(pathname: string, init?: RequestInit & { expectedStatus?: number }) {
  const response = await request(pathname, init);
  return response.text();
}

async function main() {
  const home = await readText('/', { expectedStatus: 200 });
  assert.match(home, /Samuel (?:&|&amp;) Natasha/i);

  const dashboardRedirect = await request('/dashboard');
  assertRedirectToHome(dashboardRedirect, '/dashboard');

  const rsvpRedirect = await request('/rsvp');
  assertRedirectToHome(rsvpRedirect, '/rsvp');

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
  const adminCookieHeader = toCookieHeader(adminCookie);

  const createGuest = await request('/api/admin/spacetimedb', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: adminCookieHeader,
    },
    body: JSON.stringify({
      action: 'upsertGuest',
      firstName: 'Smoke',
      lastName: 'Test',
      inviteCode: E2E_INVITE_CODE,
    }),
    expectedStatus: 200,
  });
  const createGuestPayload = (await createGuest.json()) as { ok?: boolean };
  assert.equal(createGuestPayload.ok, true);

  const unlockPost = await request('/api/unlock', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ inviteCode: E2E_INVITE_CODE }),
    expectedStatus: 200,
  });
  const unlockPostPayload = (await unlockPost.json()) as { ok?: boolean };
  assert.equal(unlockPostPayload.ok, true);
  const unlockCookie = getFirstSetCookie(unlockPost);
  const unlockCookieHeader = toCookieHeader(unlockCookie);

  const unlockResponse = await request('/api/unlock', {
    headers: { Cookie: unlockCookieHeader },
    expectedStatus: 200,
  });
  const unlockPayload = (await unlockResponse.json()) as { ok?: boolean; inviteCode?: string | null };
  assert.equal(unlockPayload.ok, true);
  assert.equal(unlockPayload.inviteCode, E2E_INVITE_CODE);

  const dashboard = await readText('/dashboard', {
    headers: { Cookie: unlockCookieHeader },
    expectedStatus: 200,
  });
  assert.match(dashboard, /Your RSVP/i);

  const rsvp = await readText('/rsvp', {
    headers: { Cookie: unlockCookieHeader },
    expectedStatus: 200,
  });
  assert.match(rsvp, /Step 1: Welcome and Confirm Invitation/i);

  const adminDashboard = await readText('/admin/guests', {
    headers: { Cookie: adminCookieHeader },
    expectedStatus: 200,
  });
  assert.match(adminDashboard, /Guest Operations Dashboard/i);

  console.log('E2E smoke checks passed.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
