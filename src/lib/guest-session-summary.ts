import { cache } from 'react';
import { getGuestPortalState } from '@/lib/spacetimedb-procedures';
import { withSpacetimeConnection } from '@/lib/spacetimedb-server';

export type GuestSessionSummary = {
  guestName?: string;
  inviteCode: string;
  rsvpSubmitted: boolean;
};

const loadGuestSessionSummary = cache(async (inviteCode: string): Promise<GuestSessionSummary> => {
  const portalState = await withSpacetimeConnection((connection) =>
    getGuestPortalState(connection, { inviteCode })
  );

  const previewGuest = portalState.previewGuest;
  const guestName = previewGuest
    ? `${previewGuest.firstName} ${previewGuest.lastName}`.trim() || undefined
    : undefined;

  return {
    guestName,
    inviteCode,
    rsvpSubmitted: portalState.activeRsvp !== undefined && portalState.activeRsvp.submitted,
  };
});

export async function getGuestSessionSummary(
  inviteCode?: string
): Promise<GuestSessionSummary | undefined> {
  if (!inviteCode?.trim()) {
    return undefined;
  }

  try {
    return await loadGuestSessionSummary(inviteCode.trim().toUpperCase());
  } catch {
    return undefined;
  }
}
