import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import {
  getConfiguredSessionSigningSecret,
  getSessionSigningSecret,
} from './session-secret.ts';

const originalNodeEnv = process.env.NODE_ENV;
const originalSessionSecret = process.env.SESSION_SIGNING_SECRET;
const originalLegacySecret = process.env.WEDDING_UNLOCK_SECRET;

afterEach(() => {
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

test('prefers SESSION_SIGNING_SECRET when present', () => {
  process.env.NODE_ENV = 'development';
  process.env.SESSION_SIGNING_SECRET = '  primary-secret  ';
  process.env.WEDDING_UNLOCK_SECRET = 'legacy-secret';

  assert.equal(getSessionSigningSecret(), 'primary-secret');
});

test('falls back to WEDDING_UNLOCK_SECRET when needed', () => {
  process.env.NODE_ENV = 'development';
  delete process.env.SESSION_SIGNING_SECRET;
  process.env.WEDDING_UNLOCK_SECRET = '  legacy-secret  ';

  assert.equal(getSessionSigningSecret(), 'legacy-secret');
});

test('uses a development fallback secret outside production', () => {
  process.env.NODE_ENV = 'test';
  delete process.env.SESSION_SIGNING_SECRET;
  delete process.env.WEDDING_UNLOCK_SECRET;

  assert.equal(getConfiguredSessionSigningSecret(), undefined);
  assert.equal(
    getSessionSigningSecret(),
    'dev-only-unlock-secret-change-before-production'
  );
});

test('requires an explicit secret in production', () => {
  process.env.NODE_ENV = 'production';
  delete process.env.SESSION_SIGNING_SECRET;
  delete process.env.WEDDING_UNLOCK_SECRET;

  assert.equal(getSessionSigningSecret(), undefined);
});
