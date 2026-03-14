'use client';

import { PropsWithChildren, useEffect, useMemo } from 'react';
import { SpacetimeDBProvider } from 'spacetimedb/react';
import { DbConnection } from '@/module_bindings';
import {
  attachConnectionDebug,
  installSpacetimeWindowDebugHooks,
  logExpectedTableSchema,
} from '@/lib/spacetimedb-debug';

const CONNECTION_SCHEMA_SALT = 'schema-2026-03-01-v1';

function getClientSpacetimeHost(): string {
  const configured = process.env.NEXT_PUBLIC_SPACETIMEDB_HOST?.trim();
  if (configured) {
    return configured;
  }
  if (process.env.NODE_ENV !== 'production') {
    return 'http://127.0.0.1:3000';
  }
  throw new Error('NEXT_PUBLIC_SPACETIMEDB_HOST must be set in production.');
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

function withConnectionSalt(uri: string, salt: string): string {
  const parsed = new URL(uri);
  parsed.hash = salt;
  return parsed.toString();
}

export default function SpacetimeAppProvider({ children }: PropsWithChildren) {
  const host = getClientSpacetimeHost();
  const databaseName = process.env.NEXT_PUBLIC_SPACETIMEDB_DB_NAME ?? '';
  const wsHost = useMemo(() => withConnectionSalt(normalizeToWsUri(host), CONNECTION_SCHEMA_SALT), [host]);

  useEffect(() => {
    installSpacetimeWindowDebugHooks();
    logExpectedTableSchema();
  }, []);

  const connectionBuilder = useMemo(
    () =>
      DbConnection.builder()
        .withUri(wsHost)
        .withDatabaseName(databaseName)
        .onConnect((connection, identity) => {
          attachConnectionDebug(connection);
          if (process.env.NEXT_PUBLIC_SPACETIMEDB_DEBUG === '1') {
            console.info('[STDB DEBUG] onConnect', {
              connectionId: connection.connectionId.toHexString(),
              identity: identity.toHexString(),
            });
          }
        })
        .onDisconnect((ctx, error) => {
          if (process.env.NEXT_PUBLIC_SPACETIMEDB_DEBUG === '1') {
            console.warn('[STDB DEBUG] onDisconnect', {
              isActive: ctx.isActive,
              error,
            });
          }
        })
        .onConnectError((_ctx, error) => {
          console.error('Failed to connect to SpacetimeDB:', error);
        }),
    [databaseName, wsHost]
  );

  return (
    <SpacetimeDBProvider connectionBuilder={connectionBuilder}>
      {children}
    </SpacetimeDBProvider>
  );
}
