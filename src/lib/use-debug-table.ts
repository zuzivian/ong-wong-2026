'use client';

import { useEffect, useRef } from 'react';
import { useTable } from 'spacetimedb/react';

const PREFIX = '[STDB DEBUG]';

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

export function useDebugTable<RowType = unknown>(
  label: string,
  query: any
): [readonly RowType[], boolean] {
  useEffect(() => {
    if (!isDebugEnabled()) {
      return;
    }

    const querySql =
      query && typeof query === 'object' && 'toSql' in query && typeof query.toSql === 'function'
        ? query.toSql()
        : String(query);

    console.info(`${PREFIX} ${label} mount`, { querySql });
  }, [label, query]);

  const [rows, isReady] = useTable(query, {
    onInsert: (row) => {
      if (isDebugEnabled()) {
        console.debug(`${PREFIX} ${label} onInsert`, safeSerialize(row));
      }
    },
    onDelete: (row) => {
      if (isDebugEnabled()) {
        console.debug(`${PREFIX} ${label} onDelete`, safeSerialize(row));
      }
    },
    onUpdate: (oldRow, newRow) => {
      if (isDebugEnabled()) {
        console.debug(`${PREFIX} ${label} onUpdate`, {
          oldRow: safeSerialize(oldRow),
          newRow: safeSerialize(newRow),
        });
      }
    },
  });

  const previous = useRef<{ count: number; loading: boolean } | null>(null);
  useEffect(() => {
    if (!isDebugEnabled()) {
      return;
    }

    const next = { count: rows.length, loading: !isReady };
    if (!previous.current || previous.current.count !== next.count || previous.current.loading !== next.loading) {
      console.info(`${PREFIX} ${label} snapshot`, next);
      previous.current = next;
    }
  }, [isReady, label, rows.length]);

  return [rows as readonly RowType[], !isReady];
}
