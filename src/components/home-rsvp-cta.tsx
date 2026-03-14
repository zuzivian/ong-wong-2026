'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useSpacetimeDB } from 'spacetimedb/react';
import Icon from '@/components/icon';
import { DbConnection } from '@/module_bindings';
import { loadGuestPortalState } from '@/lib/guest-portal-state';

type HomeRsvpCtaProps = {
  inviteCode: string;
  initialSubmitted?: boolean;
  hideWhenSubmitted?: boolean;
  className?: string;
};

export default function HomeRsvpCta({
  inviteCode,
  initialSubmitted = false,
  hideWhenSubmitted = false,
  className = 'button-primary',
}: HomeRsvpCtaProps) {
  const db = useSpacetimeDB();
  const connection = db.getConnection() as DbConnection | null;
  const [hasSubmitted, setHasSubmitted] = useState<boolean | null>(initialSubmitted);

  useEffect(() => {
    setHasSubmitted(initialSubmitted);
  }, [initialSubmitted]);

  useEffect(() => {
    if (!connection || !inviteCode) {
      return;
    }

    let cancelled = false;
    loadGuestPortalState(connection, inviteCode)
      .then((state) => {
        if (!cancelled) {
          setHasSubmitted(state.activeRsvp !== undefined && state.activeRsvp.submitted);
        }
      })
      .catch(() => {
        // Fallback: show submit button
      });

    return () => {
      cancelled = true;
    };
  }, [connection, inviteCode]);

  if (hideWhenSubmitted && hasSubmitted) {
    return null;
  }

  if (hasSubmitted) {
    return (
      <Link href="/dashboard" className={className}>
        <Icon name="how_to_reg" className="button-icon" /> Your RSVP
      </Link>
    );
  }

  return (
    <Link href="/rsvp" className={className}>
      <Icon name="how_to_reg" className="button-icon" /> Submit RSVP
    </Link>
  );
}
