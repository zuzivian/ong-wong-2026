import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
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
    redirect(`/api/unlock?inviteCode=${encodeURIComponent(inviteCode)}`);
  }

  redirect('/');
}
