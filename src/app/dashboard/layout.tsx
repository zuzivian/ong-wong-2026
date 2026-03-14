import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { UNLOCK_COOKIE_NAME, verifyUnlockSession } from '@/lib/invite-unlock';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const unlockCookie = cookieStore.get(UNLOCK_COOKIE_NAME)?.value;
  const isUnlocked = await verifyUnlockSession(unlockCookie);
  if (!isUnlocked) {
    redirect('/');
  }

  return <>{children}</>;
}
