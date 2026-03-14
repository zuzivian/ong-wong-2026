import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { NextRequest } from 'next/server.js';

import {
  consumeRateLimit,
  getRequestClientKey,
  resetRateLimit,
} from './request-rate-limit';

const originalDateNow = Date.now;

function clearRateLimitStore(): void {
  delete (globalThis as typeof globalThis & { __weddingRateLimitStore?: Map<string, unknown> })
    .__weddingRateLimitStore;
}

afterEach(() => {
  Date.now = originalDateNow;
  clearRateLimitStore();
});

test('getRequestClientKey prefers the first forwarded ip', () => {
  const request = new NextRequest('https://example.com', {
    headers: {
      'x-forwarded-for': '203.0.113.10, 198.51.100.20',
      'x-real-ip': '192.0.2.1',
    },
  });

  assert.equal(getRequestClientKey(request), '203.0.113.10');
});

test('getRequestClientKey falls back to x-real-ip and then unknown', () => {
  const realIpRequest = new NextRequest('https://example.com', {
    headers: {
      'x-real-ip': '192.0.2.1',
    },
  });
  const unknownRequest = new NextRequest('https://example.com');

  assert.equal(getRequestClientKey(realIpRequest), '192.0.2.1');
  assert.equal(getRequestClientKey(unknownRequest), 'unknown');
});

test('consumeRateLimit blocks once max attempts inside the window is reached', () => {
  Date.now = () => 1_000;

  const first = consumeRateLimit('unlock', 'client-a', {
    maxAttempts: 2,
    windowMs: 10_000,
  });
  const second = consumeRateLimit('unlock', 'client-a', {
    maxAttempts: 2,
    windowMs: 10_000,
  });
  const third = consumeRateLimit('unlock', 'client-a', {
    maxAttempts: 2,
    windowMs: 10_000,
  });

  assert.deepEqual(first, { allowed: true, retryAfterSeconds: 0 });
  assert.deepEqual(second, { allowed: true, retryAfterSeconds: 0 });
  assert.equal(third.allowed, false);
  assert.equal(third.retryAfterSeconds, 10);
});

test('consumeRateLimit prunes expired attempts outside the window', () => {
  Date.now = () => 1_000;
  consumeRateLimit('unlock', 'client-b', { maxAttempts: 1, windowMs: 5_000 });

  Date.now = () => 6_001;
  const nextAttempt = consumeRateLimit('unlock', 'client-b', {
    maxAttempts: 1,
    windowMs: 5_000,
  });

  assert.deepEqual(nextAttempt, { allowed: true, retryAfterSeconds: 0 });
});

test('resetRateLimit clears stored attempts for a client', () => {
  Date.now = () => 1_000;
  consumeRateLimit('unlock', 'client-c', { maxAttempts: 1, windowMs: 10_000 });

  resetRateLimit('unlock', 'client-c');

  const nextAttempt = consumeRateLimit('unlock', 'client-c', {
    maxAttempts: 1,
    windowMs: 10_000,
  });

  assert.deepEqual(nextAttempt, { allowed: true, retryAfterSeconds: 0 });
});
