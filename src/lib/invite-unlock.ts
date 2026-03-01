const DEV_FALLBACK_UNLOCK_SECRET = 'dev-only-unlock-secret-change-before-production';

export const UNLOCK_COOKIE_NAME = 'wedding_unlock';
export const UNLOCK_SESSION_TTL_SECONDS = 60 * 60 * 24 * 180; // 180 days

type UnlockSessionPayload = {
  exp: number;
  code?: string;
};

export type UnlockSession = {
  expiresAtMs: number;
  inviteCode?: string;
};

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

function normalizeInviteCode(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toUpperCase();
  return normalized.length > 0 ? normalized : undefined;
}

function encodeBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeBase64Url(value: string): string | undefined {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const paddingLength = (4 - (base64.length % 4)) % 4;
  const padded = `${base64}${'='.repeat(paddingLength)}`;

  try {
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, char => char.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return undefined;
  }
}

function encodeUnlockPayload(payload: UnlockSessionPayload): string {
  return encodeBase64Url(JSON.stringify(payload));
}

function parseLegacyPayload(rawPayload: string): UnlockSession | undefined {
  if (!/^\d+$/.test(rawPayload)) {
    return undefined;
  }

  const expiry = Number(rawPayload);
  if (!Number.isFinite(expiry)) {
    return undefined;
  }

  return { expiresAtMs: expiry };
}

function parseUnlockPayload(rawPayload: string): UnlockSession | undefined {
  const decoded = decodeBase64Url(rawPayload);
  if (!decoded) {
    return undefined;
  }

  let parsed: UnlockSessionPayload;
  try {
    parsed = JSON.parse(decoded) as UnlockSessionPayload;
  } catch {
    return undefined;
  }

  const expiry = Number(parsed.exp);
  if (!Number.isFinite(expiry)) {
    return undefined;
  }

  const inviteCode = normalizeInviteCode(parsed.code);
  return {
    expiresAtMs: expiry,
    inviteCode,
  };
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

export async function createUnlockSession(inviteCode?: string): Promise<string> {
  const normalizedInviteCode = normalizeInviteCode(inviteCode);
  const expiresAtMs = Date.now() + UNLOCK_SESSION_TTL_SECONDS * 1000;
  const payload = encodeUnlockPayload({
    exp: expiresAtMs,
    code: normalizedInviteCode,
  });
  const signature = await signPayload(payload);
  return `${payload}.${signature}`;
}

export async function readUnlockSession(value: string | undefined): Promise<UnlockSession | undefined> {
  if (!value) {
    return undefined;
  }

  const separatorIndex = value.lastIndexOf('.');
  if (separatorIndex <= 0 || separatorIndex >= value.length - 1) {
    return undefined;
  }

  const rawPayload = value.slice(0, separatorIndex);
  const providedSignature = value.slice(separatorIndex + 1);
  if (!providedSignature) {
    return undefined;
  }

  const expectedSignature = await signPayload(rawPayload);
  if (!timingSafeEqual(providedSignature, expectedSignature)) {
    return undefined;
  }

  const session = parseLegacyPayload(rawPayload) ?? parseUnlockPayload(rawPayload);
  if (!session || session.expiresAtMs <= Date.now()) {
    return undefined;
  }

  return session;
}

export async function verifyUnlockSession(value: string | undefined): Promise<boolean> {
  return (await readUnlockSession(value)) !== undefined;
}
