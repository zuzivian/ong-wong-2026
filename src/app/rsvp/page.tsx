import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import RsvpFlow from '@/components/rsvp-flow';
import { getVariantMeta } from '@/lib/design-variant';
import { readUnlockSession, UNLOCK_COOKIE_NAME, verifyUnlockSession } from '@/lib/invite-unlock';

export default async function RsvpPage() {
  const cookieStore = await cookies();
  const unlockCookie = cookieStore.get(UNLOCK_COOKIE_NAME)?.value;
  const isUnlocked = await verifyUnlockSession(unlockCookie);
  if (!isUnlocked) {
    redirect('/');
  }
  const unlockSession = await readUnlockSession(unlockCookie);

  const meta = getVariantMeta();
  return (
    <div className={`theme-page ${meta.themeClass}`}>
      <RsvpFlow initialInviteCode={unlockSession?.inviteCode ?? ''} />
    </div>
  );
}
