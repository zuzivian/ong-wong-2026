import { NextRequest } from 'next/server.js';

type RateLimitState = {
  attempts: number[];
};

type RateLimitDecision = {
  allowed: boolean;
  retryAfterSeconds: number;
};

type RateLimitOptions = {
  maxAttempts: number;
  windowMs: number;
};

type RateLimitStore = Map<string, RateLimitState>;

function getRateLimitStore(): RateLimitStore {
  const globalStore = globalThis as typeof globalThis & {
    __weddingRateLimitStore?: RateLimitStore;
  };

  if (!globalStore.__weddingRateLimitStore) {
    globalStore.__weddingRateLimitStore = new Map();
  }

  return globalStore.__weddingRateLimitStore;
}

function pruneAttempts(attempts: number[], nowMs: number, windowMs: number): number[] {
  return attempts.filter((attemptMs) => nowMs - attemptMs < windowMs);
}

export function getRequestClientKey(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const firstIp = forwardedFor.split(',')[0]?.trim();
    if (firstIp) {
      return firstIp;
    }
  }

  const realIp = request.headers.get('x-real-ip')?.trim();
  if (realIp) {
    return realIp;
  }

  return 'unknown';
}

export function consumeRateLimit(
  namespace: string,
  clientKey: string,
  options: RateLimitOptions
): RateLimitDecision {
  const store = getRateLimitStore();
  const nowMs = Date.now();
  const storeKey = `${namespace}:${clientKey}`;
  const existing = store.get(storeKey);
  const recentAttempts = pruneAttempts(existing?.attempts ?? [], nowMs, options.windowMs);

  if (recentAttempts.length >= options.maxAttempts) {
    const oldestAttemptMs = recentAttempts[0] ?? nowMs;
    const retryAfterMs = Math.max(0, options.windowMs - (nowMs - oldestAttemptMs));
    store.set(storeKey, { attempts: recentAttempts });
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil(retryAfterMs / 1000)),
    };
  }

  recentAttempts.push(nowMs);
  store.set(storeKey, { attempts: recentAttempts });
  return {
    allowed: true,
    retryAfterSeconds: 0,
  };
}

export function resetRateLimit(namespace: string, clientKey: string): void {
  getRateLimitStore().delete(`${namespace}:${clientKey}`);
}
