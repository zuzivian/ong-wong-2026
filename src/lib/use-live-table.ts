'use client';

import { useCallback, useSyncExternalStore } from 'react';
import { useSpacetimeDB } from 'spacetimedb/react';
import { DbConnection } from '@/module_bindings';

export function useLiveTable<RowType = any>(
  tableName: string
): [readonly RowType[], boolean] {
  const state = useSpacetimeDB();

  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const connection = state.getConnection() as DbConnection | null;
      if (!connection) {
        return () => {};
      }

      const table = (connection.db as Record<string, any>)[tableName];
      if (!table) {
        return () => {};
      }

      const onInsert = () => onStoreChange();
      const onDelete = () => onStoreChange();
      const onUpdate = () => onStoreChange();

      table.onInsert(onInsert);
      table.onDelete(onDelete);
      table.onUpdate?.(onUpdate);

      return () => {
        table.removeOnInsert(onInsert);
        table.removeOnDelete(onDelete);
        table.removeOnUpdate?.(onUpdate);
      };
    },
    [state, tableName]
  );

  const getSnapshot = useCallback((): readonly RowType[] => {
    const connection = state.getConnection() as DbConnection | null;
    if (!connection) {
      return [];
    }
    const table = (connection.db as Record<string, any>)[tableName];
    if (!table) {
      return [];
    }
    return Array.from(table.iter()) as RowType[];
  }, [state, tableName]);

  const rows = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return [rows, state.isActive];
}
