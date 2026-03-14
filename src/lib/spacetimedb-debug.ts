'use client';

import { tables } from '@/module_bindings';
import type { DbConnection } from '@/module_bindings';

const PREFIX = '[STDB DEBUG]';
const instrumentedConnections = new WeakSet<object>();
let windowHooksInstalled = false;
let tableSchemaLogged = false;

function isDebugEnabled(): boolean {
  return process.env.NEXT_PUBLIC_SPACETIMEDB_DEBUG === '1';
}

function safeSerialize(value: unknown): unknown {
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (Array.isArray(value)) {
    return value.map(safeSerialize);
  }
  if (value && typeof value === 'object') {
    const mapped: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      mapped[key] = safeSerialize(nested);
    }
    return mapped;
  }
  return value;
}

function summarizeRow(row: unknown): unknown {
  if (!row || typeof row !== 'object') {
    return row;
  }

  const source = row as Record<string, unknown>;
  const summary: Record<string, unknown> = {};
  for (const key of ['id', 'guestId', 'sender', 'inviteCode']) {
    if (key in source) {
      const value = source[key];
      summary[key] =
        typeof value === 'object' && value && 'toHexString' in value
          ? (value as { toHexString: () => string }).toHexString()
          : safeSerialize(value);
    }
  }
  return Object.keys(summary).length > 0 ? summary : safeSerialize(source);
}

export function installSpacetimeWindowDebugHooks(): void {
  if (!isDebugEnabled() || typeof window === 'undefined' || windowHooksInstalled) {
    return;
  }

  windowHooksInstalled = true;

  window.addEventListener('unhandledrejection', (event) => {
    console.error(`${PREFIX} unhandled rejection`, event.reason);
  });

  window.addEventListener('error', (event) => {
    console.error(`${PREFIX} window error`, {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error,
    });
  });

  console.info(`${PREFIX} window debug hooks installed`);
}

export function logExpectedTableSchema(): void {
  if (!isDebugEnabled() || tableSchemaLogged) {
    return;
  }

  tableSchemaLogged = true;
  const schema = Object.entries(tables as Record<string, { sourceName: string; toSql(): string }>).map(([accessorName, table]) => ({
    accessorName,
    sourceName: table.sourceName,
    query: table.toSql(),
  }));

  console.info(`${PREFIX} expected tables from generated bindings`, schema);
}

export function attachConnectionDebug(connection: DbConnection): void {
  if (!isDebugEnabled() || instrumentedConnections.has(connection)) {
    return;
  }

  instrumentedConnections.add(connection);
  console.info(`${PREFIX} attached connection debug`, {
    connectionId: connection.connectionId.toHexString(),
    isActive: connection.isActive,
    identity: connection.identity?.toHexString(),
  });

  const dbTables = Object.keys(connection.db as Record<string, unknown>);
  console.info(`${PREFIX} db accessors on connection`, dbTables);

  const originalSubscriptionBuilder = connection.subscriptionBuilder.bind(connection);
  (connection as DbConnection & { subscriptionBuilder: () => any }).subscriptionBuilder = () => {
    const builder = originalSubscriptionBuilder();
    const mutableBuilder = builder as any;
    const originalSubscribe = builder.subscribe?.bind(builder) as ((query: any) => unknown) | undefined;
    const originalSubscribeToAllTables = builder.subscribeToAllTables?.bind(builder);

    if (originalSubscribe) {
      mutableBuilder.subscribe = (query: any) => {
        const queries = Array.isArray(query) ? query : [query];
        const normalizedQueries = queries.map((q) => {
          if (typeof q === 'string') {
            return q;
          }
          if (q && typeof q === 'object' && 'toSql' in q && typeof (q as { toSql: () => string }).toSql === 'function') {
            return (q as { toSql: () => string }).toSql();
          }
          return String(q);
        });

        console.info(`${PREFIX} subscribe() called`, normalizedQueries);
        return originalSubscribe(query);
      };
    }

    if (originalSubscribeToAllTables) {
      mutableBuilder.subscribeToAllTables = () => {
        console.warn(`${PREFIX} subscribeToAllTables() called`);
        return originalSubscribeToAllTables();
      };
    }

    return builder;
  };

  for (const accessorName of dbTables) {
    const tableRef = (connection.db as Record<string, any>)[accessorName];
    if (!tableRef?.onInsert || !tableRef?.onDelete) {
      continue;
    }

    const onInsert = (ctx: unknown, row: unknown) => {
      console.debug(`${PREFIX} ${accessorName} insert`, {
        ctx: safeSerialize(ctx),
        row: summarizeRow(row),
      });
    };
    const onDelete = (ctx: unknown, row: unknown) => {
      console.debug(`${PREFIX} ${accessorName} delete`, {
        ctx: safeSerialize(ctx),
        row: summarizeRow(row),
      });
    };
    const onUpdate = (ctx: unknown, oldRow: unknown, newRow: unknown) => {
      console.debug(`${PREFIX} ${accessorName} update`, {
        ctx: safeSerialize(ctx),
        oldRow: summarizeRow(oldRow),
        newRow: summarizeRow(newRow),
      });
    };

    tableRef.onInsert(onInsert);
    tableRef.onDelete(onDelete);
    tableRef.onUpdate?.(onUpdate);
  }
}
