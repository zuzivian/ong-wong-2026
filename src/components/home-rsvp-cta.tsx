'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSpacetimeDB } from 'spacetimedb/react';
import Icon from '@/components/icon';
import { DbConnection } from '@/module_bindings';
import { loadGuestPortalState } from '@/lib/guest-portal-state';

export default function HomeRsvpCta({ inviteCode }: { inviteCode: string }) {
  const db = useSpacetimeDB();
  const connection = db.getConnection() as DbConnection | null;
  const [hasSubmitted, setHasSubmitted] = useState<boolean | null>(null);

  useEffect(() => {
    if (!connection || !inviteCode) {
      return;
    }

    let cancelled = false;
    loadGuestPortalState(connection, inviteCode)
      .then((state) => {
        if (!cancelled) {
          setHasSubmitted(state.activeRsvp !== undefined);
        }
      })
      .catch(() => {
        // Fallback: show submit button
      });

    return () => {
      cancelled = true;
    };
  }, [connection, inviteCode]);

  if (hasSubmitted) {
    return (
      <Link href="/dashboard" className="button-primary">
        <Icon name="how_to_reg" className="button-icon" /> Your RSVP
      </Link>
    );
  }

  return (
    <Link href="/rsvp" className="button-primary">
      <Icon name="how_to_reg" className="button-icon" /> Submit RSVP
    </Link>
  );
}
