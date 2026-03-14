import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { Suspense } from 'react';
import NavRsvpLink from '@/components/nav-rsvp-link';
import LogoutButton from '@/components/logout-button';
import SiteMotion from '@/components/site-motion';
import SpacetimeAppProvider from '@/components/spacetimedb-app-provider';
import { getGuestSessionSummary } from '@/lib/guest-session-summary';
import { readUnlockSession, UNLOCK_COOKIE_NAME } from '@/lib/invite-unlock';
import './globals.css';

export const metadata: Metadata = {
  title: 'Samuel and Natasha | Wedding',
  description: 'Wedding website and RSVP for Samuel and Natasha.',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const unlockCookie = cookieStore.get(UNLOCK_COOKIE_NAME)?.value;
  const unlockSession = await readUnlockSession(unlockCookie);
  const isUnlocked = unlockSession !== undefined;
  const guestSessionSummary = isUnlocked
    ? await getGuestSessionSummary(unlockSession.inviteCode)
    : undefined;
  const rsvpSubmitted = guestSessionSummary?.rsvpSubmitted ?? false;

  return (
    <html lang="en">
      <body>
        <SpacetimeAppProvider>
          {isUnlocked ? (
            <header className="site-header">
              <div className="container nav-wrap">
                <Link href="/" className="brand">
                  <span className="brand-text">
                    <span className="brand-title">Samuel & Natasha</span>
                    <span className="brand-subtext">Wedding Celebration</span>
                  </span>
                </Link>
                <nav className="top-nav" aria-label="Primary navigation">
                  <Link href="/">Home</Link>
                  <Link href="/faq">FAQ</Link>
                  <NavRsvpLink
                    initialInviteCode={guestSessionSummary?.inviteCode ?? unlockSession?.inviteCode}
                    initialSubmitted={rsvpSubmitted}
                  />
                  <LogoutButton />
                </nav>
              </div>
            </header>
          ) : null}
          <main className="site-main">
            <Suspense fallback={children}>
              <SiteMotion>{children}</SiteMotion>
            </Suspense>
          </main>
          <footer className="site-footer">
            <p className="site-footer-note">Samuel & Natasha, 15 August 2026</p>
            <Link href="/admin" className="site-footer-admin-link">
              admin
            </Link>
          </footer>
        </SpacetimeAppProvider>
      </body>
    </html>
  );
}
