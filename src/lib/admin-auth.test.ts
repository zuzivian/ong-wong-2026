import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import {
  ADMIN_SESSION_TTL_SECONDS,
  createAdminSession,
  readAdminSession,
  validateAdminPin,
} from './admin-auth';

const originalDateNow = Date.now;
const originalNodeEnv = process.env.NODE_ENV;
const originalSessionSecret = process.env.SESSION_SIGNING_SECRET;
const originalLegacySecret = process.env.WEDDING_UNLOCK_SECRET;
const originalAdminPin = process.env.ADMIN_PIN;

afterEach(() => {
  Date.now = originalDateNow;
  process.env.NODE_ENV = originalNodeEnv;

  if (originalSessionSecret === undefined) {
    delete process.env.SESSION_SIGNING_SECRET;
  } else {
    process.env.SESSION_SIGNING_SECRET = originalSessionSecret;
  }

  if (originalLegacySecret === undefined) {
    delete process.env.WEDDING_UNLOCK_SECRET;
  } else {
    process.env.WEDDING_UNLOCK_SECRET = originalLegacySecret;
  }

  if (originalAdminPin === undefined) {
    delete process.env.ADMIN_PIN;
  } else {
    process.env.ADMIN_PIN = originalAdminPin;
  }
});

test('creates and reads a valid admin session', async () => {
  process.env.NODE_ENV = 'development';
  process.env.SESSION_SIGNING_SECRET = 'admin-secret';
  Date.now = () => 1_700_000_000_000;

  const session = await createAdminSession();

  assert.equal(await readAdminSession(session), true);
});

test('admin session expires after ttl', async () => {
  process.env.NODE_ENV = 'development';
  process.env.SESSION_SIGNING_SECRET = 'admin-secret';
  Date.now = () => 1_700_000_000_000;

  const session = await createAdminSession();
  Date.now = () => 1_700_000_000_000 + ADMIN_SESSION_TTL_SECONDS * 1000 + 1;

  assert.equal(await readAdminSession(session), false);
});

test('rejects tampered admin sessions', async () => {
  process.env.NODE_ENV = 'development';
  process.env.SESSION_SIGNING_SECRET = 'admin-secret';

  const session = await createAdminSession();
  const lastChar = session.at(-1);
  const replacement = lastChar === '0' ? '1' : '0';
  const tampered = `${session.slice(0, -1)}${replacement}`;

  assert.equal(await readAdminSession(tampered), false);
});

test('validateAdminPin requires both a configured pin and secret', () => {
  process.env.NODE_ENV = 'development';
  process.env.SESSION_SIGNING_SECRET = 'admin-secret';
  process.env.ADMIN_PIN = ' 1234 ';

  assert.equal(validateAdminPin('1234'), true);
  assert.equal(validateAdminPin(' 1234 '), true);
  assert.equal(validateAdminPin('9999'), false);

  delete process.env.SESSION_SIGNING_SECRET;
  assert.equal(validateAdminPin('1234'), false);
});

test('admin session creation throws in production without a secret', async () => {
  process.env.NODE_ENV = 'production';
  delete process.env.SESSION_SIGNING_SECRET;
  delete process.env.WEDDING_UNLOCK_SECRET;

  await assert.rejects(
    () => createAdminSession(),
    /SESSION_SIGNING_SECRET must be set in production\./
  );
});
