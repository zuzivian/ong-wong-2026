import { getConfiguredSessionSigningSecret } from './session-secret.ts';

export const ADMIN_COOKIE_NAME = 'wedding_admin';
export const ADMIN_SESSION_TTL_SECONDS = 60 * 60 * 8; // 8 hours

function getAdminSecret(): string | undefined {
  const base = getConfiguredSessionSigningSecret();
  if (base) {
    return `admin:${base}`;
  }
  return undefined;
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

async function signPayload(payload: string): Promise<string> {
  const secret = getAdminSecret();
  if (!secret) {
    throw new Error('SESSION_SIGNING_SECRET must be set in production.');
  }

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return [...new Uint8Array(signature)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function createAdminSession(): Promise<string> {
  const exp = String(Date.now() + ADMIN_SESSION_TTL_SECONDS * 1000);
  const sig = await signPayload(exp);
  return `${exp}.${sig}`;
}

export async function readAdminSession(value: string | undefined): Promise<boolean> {
  if (!value) {
    return false;
  }
  const sep = value.lastIndexOf('.');
  if (sep <= 0 || sep >= value.length - 1) {
    return false;
  }
  const payload = value.slice(0, sep);
  const sig = value.slice(sep + 1);
  const expectedSig = await signPayload(payload);
  if (!timingSafeEqual(sig, expectedSig)) {
    return false;
  }
  const exp = Number(payload);
  return Number.isFinite(exp) && exp > Date.now();
}

export function validateAdminPin(pin: string): boolean {
  const configured = process.env.ADMIN_PIN?.trim();
  if (!configured || !getAdminSecret()) {
    return false;
  }
  return timingSafeEqual(pin.trim(), configured);
}
