import assert from 'node:assert/strict';
import test from 'node:test';

import { serializeSpacetimeObject, serializeSpacetimeValue } from './spacetime-json.ts';

test('serializeSpacetimeValue converts bigint values recursively', () => {
  const serialized = serializeSpacetimeValue({
    id: 42n,
    nested: {
      count: 3n,
      items: [1n, { total: 7n }],
    },
  });

  assert.deepEqual(serialized, {
    id: '42',
    nested: {
      count: '3',
      items: ['1', { total: '7' }],
    },
  });
});

test('serializeSpacetimeValue normalizes modern and legacy timestamp shapes', () => {
  const modernTimestamp = serializeSpacetimeValue({
    createdAt: { microsSinceUnixEpoch: 1_234_567n },
  });
  const legacyTimestamp = serializeSpacetimeValue({
    updatedAt: { __timestamp_micros_since_unix_epoch__: 7_654_321n },
  });

  assert.deepEqual(modernTimestamp, {
    createdAt: { microsSinceUnixEpoch: '1234567' },
  });
  assert.deepEqual(legacyTimestamp, {
    updatedAt: { microsSinceUnixEpoch: '7654321' },
  });
});

test('serializeSpacetimeObject preserves nullish primitives and empty timestamps', () => {
  const serialized = serializeSpacetimeObject({
    title: 'Welcome',
    notes: null,
    optional: undefined,
    happenedAt: {},
  });

  assert.deepEqual(serialized, {
    title: 'Welcome',
    notes: null,
    optional: undefined,
    happenedAt: {},
  });
});
