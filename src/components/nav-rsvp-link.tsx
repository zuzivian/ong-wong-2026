'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useSpacetimeDB } from 'spacetimedb/react';
import { loadGuestPortalState } from '@/lib/guest-portal-state';
import {
  normalizeInviteCode,
  UNLOCKED_INVITE_CODE_STORAGE_KEY,
} from '@/lib/unlock-client';
import { DbConnection } from '@/module_bindings';

type NavRsvpLinkProps = {
  initialInviteCode?: string;
  initialSubmitted: boolean;
};

function getInviteCodeFromPathname(pathname: string): string {
  const match = pathname.match(/^\/rsvp\/([^/]+)$/);
  if (!match) {
    return '';
  }

  try {
    return normalizeInviteCode(decodeURIComponent(match[1]));
  } catch {
    return normalizeInviteCode(match[1]);
  }
}

export default function NavRsvpLink({
  initialInviteCode = '',
  initialSubmitted,
}: NavRsvpLinkProps) {
  const db = useSpacetimeDB();
  const connection = db.getConnection() as DbConnection | null;
  const pathname = usePathname();
  const pathnameInviteCode = getInviteCodeFromPathname(pathname);

  const [inviteCode, setInviteCode] = useState(() => normalizeInviteCode(initialInviteCode));
  const [hasSubmitted, setHasSubmitted] = useState(initialSubmitted);

  useEffect(() => {
    setInviteCode(normalizeInviteCode(initialInviteCode));
    setHasSubmitted(initialSubmitted);
  }, [initialInviteCode, initialSubmitted]);

  useEffect(() => {
    if (inviteCode || typeof window === 'undefined') {
      return;
    }

    const storedInviteCode = normalizeInviteCode(
      window.localStorage.getItem(UNLOCKED_INVITE_CODE_STORAGE_KEY) ?? ''
    );
    if (storedInviteCode) {
      setInviteCode(storedInviteCode);
    }
  }, [inviteCode]);

  useEffect(() => {
    if (inviteCode || !pathnameInviteCode) {
      return;
    }

    setInviteCode(pathnameInviteCode);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(UNLOCKED_INVITE_CODE_STORAGE_KEY, pathnameInviteCode);
    }
  }, [inviteCode, pathnameInviteCode]);

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
        // Fall back to the initial server-rendered state.
      });

    return () => {
      cancelled = true;
    };
  }, [connection, inviteCode]);

  return (
    <Link href={hasSubmitted ? '/dashboard' : '/rsvp'} className="rsvp-button">
      {hasSubmitted ? 'Your RSVP' : 'Submit RSVP'}
    </Link>
  );
}
