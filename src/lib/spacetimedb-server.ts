import '@/lib/promise-with-resolvers';
import { DbConnection } from '@/module_bindings';

const DEFAULT_CONNECTION_TIMEOUT_MS = 8000;

type SpacetimeConnectionOptions = {
  timeoutMs?: number;
  token?: string;
};

function normalizeToWsUri(input: string): string {
  const parsed = new URL(input);
  if (parsed.protocol === 'https:') {
    parsed.protocol = 'wss:';
  } else if (parsed.protocol === 'http:') {
    parsed.protocol = 'ws:';
  }
  return parsed.toString();
}

export function getSpacetimeServerConfig(): { host: string; databaseName: string } | null {
  const host = process.env.SPACETIMEDB_HOST ?? process.env.NEXT_PUBLIC_SPACETIMEDB_HOST ?? '';
  const databaseName =
    process.env.SPACETIMEDB_DB_NAME ?? process.env.NEXT_PUBLIC_SPACETIMEDB_DB_NAME ?? '';

  if (!host.trim() || !databaseName.trim()) {
    return null;
  }

  return { host: host.trim(), databaseName: databaseName.trim() };
}

function toSpacetimeError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  if (typeof error === 'string' && error.trim().length > 0) {
    return new Error(error);
  }

  if (error && typeof error === 'object') {
    if ('message' in error && typeof (error as { message?: unknown }).message === 'string') {
      return new Error((error as { message: string }).message);
    }

    try {
      return new Error(JSON.stringify(error));
    } catch {
      return new Error(String(error));
    }
  }

  return new Error('SpacetimeDB request failed.');
}

export async function withSpacetimeConnection<T>(
  run: (connection: DbConnection) => Promise<T>,
  options: number | SpacetimeConnectionOptions = DEFAULT_CONNECTION_TIMEOUT_MS
): Promise<T> {
  const config = getSpacetimeServerConfig();
  if (!config) {
    throw new Error('SpacetimeDB host/database is not configured.');
  }

  const timeoutMs =
    typeof options === 'number' ? options : options.timeoutMs ?? DEFAULT_CONNECTION_TIMEOUT_MS;
  const token = typeof options === 'number' ? undefined : options.token;

  return new Promise<T>((resolve, reject) => {
    let settled = false;
    let connection: DbConnection | null = null;

    const timeout = setTimeout(() => {
      settleReject(new Error('Timed out while connecting to SpacetimeDB.'));
    }, timeoutMs);

    const cleanup = () => {
      clearTimeout(timeout);
      if (connection) {
        connection.disconnect();
      }
    };

    const settleResolve = (value: T) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      resolve(value);
    };

    const settleReject = (error: Error) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      reject(error);
    };

    try {
      connection = DbConnection.builder()
        .withUri(normalizeToWsUri(config.host))
        .withDatabaseName(config.databaseName)
        .withToken(token)
        .onConnect((connected) => {
          run(connected)
            .then(settleResolve)
            .catch((error) => {
              settleReject(toSpacetimeError(error));
            });
        })
        .onConnectError((_ctx, error) => {
          settleReject(toSpacetimeError(error));
        })
        .build();
    } catch (error) {
      settleReject(toSpacetimeError(error));
    }
  });
}
