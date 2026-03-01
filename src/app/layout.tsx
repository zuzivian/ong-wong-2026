import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { Suspense } from 'react';
import Icon from '@/components/icon';
import LogoutButton from '@/components/logout-button';
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
          {isUnlocked ? (
            <header className="site-header">
              <div className="container nav-wrap">
                <Link href="/" className="brand">
                  <Icon name="auto_awesome" className="brand-icon" />
                  <span className="brand-text">
                    <span className="brand-title">Samuel & Natasha</span>
                    <span className="brand-subtext">15 Aug 2026</span>
                  </span>
                </Link>
                <nav className="top-nav" aria-label="Primary navigation">
                  <Link href="/">
                    <Icon name="home" className="nav-icon" />
                    <span>Home</span>
                  </Link>
                  <Link href="/dashboard">
                    <Icon name="dashboard" className="nav-icon" />
                    <span>Guest Information</span>
                  </Link>
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
                    <span>RSVP</span>
                  </Link>
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
        </SpacetimeAppProvider>
      </body>
    </html>
  );
}
