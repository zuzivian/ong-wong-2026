import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { Suspense } from 'react';
import Icon from '@/components/icon';
import SiteMotion from '@/components/site-motion';
import SpacetimeAppProvider from '@/components/spacetimedb-app-provider';
import { UNLOCK_COOKIE_NAME, verifyUnlockSession } from '@/lib/invite-unlock';
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
  const cookieStore = cookies();
  const unlockCookie = cookieStore.get(UNLOCK_COOKIE_NAME)?.value;
  const isUnlocked = await verifyUnlockSession(unlockCookie);

  return (
    <html lang="en">
      <body>
        <SpacetimeAppProvider>
          <header className="site-header">
            <div className="container nav-wrap">
              <Link href="/" className="brand">
                <Icon name="auto_awesome" className="brand-icon" />
                <span>Samuel & Natasha</span>
              </Link>
              <nav className="top-nav" aria-label="Primary navigation">
                {isUnlocked ? (
                  <>
                    <Link href="/event-details">
                      <Icon name="event" className="nav-icon" />
                      <span>Event Details</span>
                    </Link>
                    <Link href="/faq">
                      <Icon name="help" className="nav-icon" />
                      <span>FAQ</span>
                    </Link>
                    <Link href="/rsvp" className="rsvp-button">
                      <Icon name="how_to_reg" className="nav-icon" />
                      <span>RSVP Now</span>
                    </Link>
                  </>
                ) : (
                  <Link href="/unlock" className="rsvp-button">
                    <Icon name="lock_open" className="nav-icon" />
                    <span>Unlock Invite</span>
                  </Link>
                )}
              </nav>
            </div>
          </header>
          <main className="site-main">
            <Suspense fallback={children}>
              <SiteMotion>{children}</SiteMotion>
            </Suspense>
          </main>
        </SpacetimeAppProvider>
      </body>
    </html>
  );
}
