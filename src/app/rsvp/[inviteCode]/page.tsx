import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import RsvpFlow from '@/components/rsvp-flow';
import { getVariantMeta } from '@/lib/design-variant';
import { normalizeInviteCode } from '@/lib/unlock-client';
import { readUnlockSession, UNLOCK_COOKIE_NAME } from '@/lib/invite-unlock';

type RsvpByInviteCodePageProps = {
  params: Promise<{
    inviteCode: string;
  }>;
};

export default async function RsvpByInviteCodePage({ params }: RsvpByInviteCodePageProps) {
  const { inviteCode: inviteCodeParam } = await params;
  const inviteCode = normalizeInviteCode(inviteCodeParam);
  const cookieStore = await cookies();
  const unlockCookie = cookieStore.get(UNLOCK_COOKIE_NAME)?.value;
  const unlockSession = await readUnlockSession(unlockCookie);
  if (!inviteCode) {
    redirect('/');
  }

  if (unlockSession?.inviteCode !== inviteCode) {
    redirect(`/api/rsvp-unlock?inviteCode=${encodeURIComponent(inviteCode)}`);
  }

  const meta = getVariantMeta();
  return (
    <div className={`theme-page ${meta.themeClass}`}>
      <RsvpFlow initialInviteCode={unlockSession?.inviteCode ?? inviteCode} />
    </div>
  );
}
