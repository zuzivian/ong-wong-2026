import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const ADMIN_CREDENTIALS_PATH = path.join(process.cwd(), '.spacetimedb-admin-credentials.json');

export type SpacetimeAdminCredentials = {
  identity: string;
  token: string;
};

export async function readSpacetimeAdminCredentials(): Promise<SpacetimeAdminCredentials | null> {
  // First try environment variables (for serverless deployments)
  const envIdentity = process.env.SPACETIMEDB_ADMIN_IDENTITY;
  const envToken = process.env.SPACETIMEDB_ADMIN_TOKEN;

  if (envIdentity && envToken) {
    return {
      identity: envIdentity.trim(),
      token: envToken.trim(),
    };
  }

  // Fall back to file-based storage (for local development)
  try {
    const raw = await readFile(ADMIN_CREDENTIALS_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Partial<SpacetimeAdminCredentials>;
    if (typeof parsed.identity !== 'string' || typeof parsed.token !== 'string') {
      return null;
    }

    const identity = parsed.identity.trim();
    const token = parsed.token.trim();
    if (!identity || !token) {
      return null;
    }

    return { identity, token };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

export async function writeSpacetimeAdminCredentials(
  credentials: SpacetimeAdminCredentials
): Promise<void> {
  // In serverless environments, we can't write files, so skip writing
  // The credentials should be set via environment variables instead
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
    return;
  }

  // For local development, still write to file
  await writeFile(ADMIN_CREDENTIALS_PATH, `${JSON.stringify(credentials, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  });
}
