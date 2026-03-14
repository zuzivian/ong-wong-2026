type TimestampLike = {
  microsSinceUnixEpoch?: bigint;
  __timestamp_micros_since_unix_epoch__?: bigint;
};

function isTimestampLike(value: unknown): value is TimestampLike {
  if (!value || typeof value !== 'object') {
    return false;
  }

  return (
    'microsSinceUnixEpoch' in value ||
    '__timestamp_micros_since_unix_epoch__' in value
  );
}

export function serializeSpacetimeValue(value: unknown): unknown {
  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (isTimestampLike(value)) {
    const microsSinceUnixEpoch =
      value.microsSinceUnixEpoch ?? value.__timestamp_micros_since_unix_epoch__;
    return microsSinceUnixEpoch === undefined
      ? null
      : { microsSinceUnixEpoch: microsSinceUnixEpoch.toString() };
  }

  if (Array.isArray(value)) {
    return value.map(serializeSpacetimeValue);
  }

  if (value && typeof value === 'object') {
    const mapped: Record<string, unknown> = {};
    for (const [key, nested] of Object.entries(value)) {
      mapped[key] = serializeSpacetimeValue(nested);
    }
    return mapped;
  }

  return value;
}

export function serializeSpacetimeObject(value: Record<string, unknown>): Record<string, unknown> {
  return serializeSpacetimeValue(value) as Record<string, unknown>;
}
