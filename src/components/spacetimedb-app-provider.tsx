'use client';

import { PropsWithChildren, useEffect, useMemo } from 'react';
import { SpacetimeDBProvider } from 'spacetimedb/react';
import { DbConnection } from '@/module_bindings';
import { useState } from 'react';
import {
  attachConnectionDebug,
  installSpacetimeWindowDebugHooks,
  logExpectedTableSchema,
} from '@/lib/spacetimedb-debug';

const TOKEN_STORAGE_KEY = 'wedding_spacetimedb_auth';
const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
const CONNECTION_SCHEMA_SALT = 'schema-2026-03-01-v1';

type StoredToken = {
  token: string;
  expiresAtMs: number;
};

function loadStoredToken(): string | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  const raw = window.localStorage.getItem(TOKEN_STORAGE_KEY);
  if (!raw) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(raw) as StoredToken;
    if (!parsed.token || !parsed.expiresAtMs || parsed.expiresAtMs <= Date.now()) {
      window.localStorage.removeItem(TOKEN_STORAGE_KEY);
      return undefined;
    }
    return parsed.token;
  } catch {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
    return undefined;
  }
}

function persistToken(token: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  const payload: StoredToken = {
    token,
    expiresAtMs: Date.now() + THIRTY_DAYS_MS,
  };
  window.localStorage.setItem(TOKEN_STORAGE_KEY, JSON.stringify(payload));
}

function clearStoredToken(): void {
  if (typeof window === 'undefined') {
    return;
  }
  window.localStorage.removeItem(TOKEN_STORAGE_KEY);
}

function normalizeToWsUri(input: string): string {
  const parsed = new URL(input);
  if (parsed.protocol === 'https:') {
    parsed.protocol = 'wss:';
    return parsed.toString();
  }
  if (parsed.protocol === 'http:') {
    parsed.protocol = 'ws:';
    return parsed.toString();
  }
  return parsed.toString();
}

function withConnectionSalt(uri: string): string {
  const parsed = new URL(uri);
  parsed.hash = CONNECTION_SCHEMA_SALT;
  return parsed.toString();
}

export default function SpacetimeAppProvider({ children }: PropsWithChildren) {
  const host = process.env.NEXT_PUBLIC_SPACETIMEDB_HOST ?? 'http://127.0.0.1:3000';
  const databaseName = process.env.NEXT_PUBLIC_SPACETIMEDB_DB_NAME ?? '';
  const wsHost = useMemo(() => withConnectionSalt(normalizeToWsUri(host)), [host]);
  const [token, setToken] = useState<string | undefined>(() => loadStoredToken());

  useEffect(() => {
    installSpacetimeWindowDebugHooks();
    logExpectedTableSchema();
  }, []);

  const connectionBuilder = useMemo(
    () =>
      DbConnection.builder()
        .withUri(wsHost)
        .withDatabaseName(databaseName)
        .withToken(token)
        .onConnect((connection, identity, token) => {
          persistToken(token);
          setToken(token);
          attachConnectionDebug(connection);
          console.info('[STDB DEBUG] onConnect', {
            connectionId: connection.connectionId.toHexString(),
            identity: identity.toHexString(),
          });
        })
        .onDisconnect((ctx, error) => {
          console.warn('[STDB DEBUG] onDisconnect', {
            isActive: ctx.isActive,
            error,
          });
        })
        .onConnectError((_ctx, error) => {
          if (token) {
            // A stale token can break auth after DB resets. Clear once and retry anonymously.
            clearStoredToken();
            setToken(undefined);
          }
          console.error('Failed to connect to SpacetimeDB:', error);
        }),
    [databaseName, token, wsHost]
  );

  return (
    <SpacetimeDBProvider connectionBuilder={connectionBuilder}>
      {children}
    </SpacetimeDBProvider>
  );
}
