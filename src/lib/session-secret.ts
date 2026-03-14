const DEV_FALLBACK_SESSION_SECRET = 'dev-only-unlock-secret-change-before-production';

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}

export function getSessionSigningSecret(): string | undefined {
  const configuredSecret =
    process.env.SESSION_SIGNING_SECRET?.trim() || process.env.WEDDING_UNLOCK_SECRET?.trim();
  if (configuredSecret) {
    return configuredSecret;
  }

  if (isProduction()) {
    return undefined;
  }

  return DEV_FALLBACK_SESSION_SECRET;
}
