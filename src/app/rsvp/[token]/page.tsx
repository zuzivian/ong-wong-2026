import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import RsvpFlow from '@/components/rsvp-flow';
import { getVariantMeta } from '@/lib/design-variant';
import { UNLOCK_COOKIE_NAME, verifyUnlockSession } from '@/lib/invite-unlock';

type RsvpByTokenPageProps = {
  params: {
    token: string;
  };
};

export default async function RsvpByTokenPage({ params }: RsvpByTokenPageProps) {
  const unlockCookie = cookies().get(UNLOCK_COOKIE_NAME)?.value;
  const isUnlocked = await verifyUnlockSession(unlockCookie);
  if (!isUnlocked) {
    redirect('/');
  }

  const meta = getVariantMeta();
  return (
    <div className={`theme-page ${meta.themeClass}`}>
      <RsvpFlow initialToken={params.token} />
    </div>
  );
}
