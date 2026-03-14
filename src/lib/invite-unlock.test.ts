import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import {
  createUnlockSession,
  readUnlockSession,
  UNLOCK_SESSION_TTL_SECONDS,
  verifyUnlockSession,
} from './invite-unlock.ts';

const originalDateNow = Date.now;
const originalNodeEnv = process.env.NODE_ENV;
const originalSessionSecret = process.env.SESSION_SIGNING_SECRET;
const originalLegacySecret = process.env.WEDDING_UNLOCK_SECRET;

async function signRawPayload(payload: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return [...new Uint8Array(signature)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

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
});

test('creates and reads a signed unlock session with normalized invite code', async () => {
  process.env.NODE_ENV = 'development';
  process.env.SESSION_SIGNING_SECRET = 'test-secret';
  Date.now = () => 1_700_000_000_000;

  const token = await createUnlockSession(' ab-12 cd ');
  const session = await readUnlockSession(token);

  assert.deepEqual(session, {
    expiresAtMs: 1_700_000_000_000 + UNLOCK_SESSION_TTL_SECONDS * 1000,
    inviteCode: 'AB12CD',
  });
});

test('supports legacy numeric payloads when the signature is valid', async () => {
  process.env.NODE_ENV = 'development';
  process.env.SESSION_SIGNING_SECRET = 'legacy-secret';
  Date.now = () => 100;

  const payload = '5000';
  const signature = await signRawPayload(payload, 'legacy-secret');

  assert.deepEqual(await readUnlockSession(`${payload}.${signature}`), {
    expiresAtMs: 5000,
  });
});

test('rejects tampered session values', async () => {
  process.env.NODE_ENV = 'development';
  process.env.SESSION_SIGNING_SECRET = 'test-secret';

  const token = await createUnlockSession('ABC123');
  const tamperedToken = `${token.slice(0, -1)}0`;

  assert.equal(await readUnlockSession(tamperedToken), undefined);
  assert.equal(await verifyUnlockSession(tamperedToken), false);
});

test('rejects expired sessions', async () => {
  process.env.NODE_ENV = 'development';
  process.env.SESSION_SIGNING_SECRET = 'test-secret';
  Date.now = () => 10_000;

  const token = await createUnlockSession('ABC123');
  Date.now = () => 10_000 + UNLOCK_SESSION_TTL_SECONDS * 1000 + 1;

  assert.equal(await readUnlockSession(token), undefined);
  assert.equal(await verifyUnlockSession(token), false);
});

test('throws in production when no session signing secret is configured', async () => {
  process.env.NODE_ENV = 'production';
  delete process.env.SESSION_SIGNING_SECRET;
  delete process.env.WEDDING_UNLOCK_SECRET;

  await assert.rejects(
    () => createUnlockSession('ABC123'),
    /SESSION_SIGNING_SECRET must be set in production\./
  );
});
