'use client';

import { useEffect, useState } from 'react';
import { RSVP_CUTOFF_AT_MICROS } from '../../shared/globals';

const RSVP_CUTOFF_POLL_INTERVAL_MS = 1000;

export function useIsRsvpClosed(): boolean {
  const [isClosed, setIsClosed] = useState(() => BigInt(Date.now()) * 1000n > RSVP_CUTOFF_AT_MICROS);

  useEffect(() => {
    if (isClosed) {
      return;
    }

    const intervalId = window.setInterval(() => {
      if (BigInt(Date.now()) * 1000n > RSVP_CUTOFF_AT_MICROS) {
        setIsClosed(true);
      }
    }, RSVP_CUTOFF_POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [isClosed]);

  return isClosed;
}
