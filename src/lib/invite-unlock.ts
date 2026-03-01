const DEV_FALLBACK_UNLOCK_SECRET = 'dev-only-unlock-secret-change-before-production';

export const UNLOCK_COOKIE_NAME = 'wedding_unlock';
export const UNLOCK_SESSION_TTL_SECONDS = 60 * 60 * 24 * 14; // 14 days

function getUnlockSecret(): string {
  const configuredSecret = process.env.WEDDING_UNLOCK_SECRET?.trim();
  if (configuredSecret) {
    return configuredSecret;
  }

  return DEV_FALLBACK_UNLOCK_SECRET;
}

function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }

  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return diff === 0;
}

function bytesToHex(value: ArrayBuffer): string {
  return [...new Uint8Array(value)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function signPayload(payload: string): Promise<string> {
  const secret = getUnlockSecret();

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return bytesToHex(signature);
}

export async function createUnlockSession(): Promise<string> {
  const expiresAtMs = Date.now() + UNLOCK_SESSION_TTL_SECONDS * 1000;
  const payload = String(expiresAtMs);
  const signature = await signPayload(payload);
  return `${payload}.${signature}`;
}

export async function verifyUnlockSession(value: string | undefined): Promise<boolean> {
  if (!value) {
    return false;
  }

  const [rawExpiry, providedSignature] = value.split('.');
  if (!rawExpiry || !providedSignature) {
    return false;
  }

  const expiry = Number(rawExpiry);
  if (!Number.isFinite(expiry) || expiry <= Date.now()) {
    return false;
  }

  const expectedSignature = await signPayload(rawExpiry);

  return timingSafeEqual(providedSignature, expectedSignature);
}
