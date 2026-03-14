import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { Suspense } from 'react';
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
  const cookieStore = await cookies();
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
                  <span className="brand-text">
                    <span className="brand-title">Samuel & Natasha</span>
                    <span className="brand-subtext">Wedding Celebration</span>
                  </span>
                </Link>
                <nav className="top-nav" aria-label="Primary navigation">
                  <Link href="/">Home</Link>
                  <Link href="/faq">FAQ</Link>
                  <Link href="/dashboard" className="rsvp-button">Your RSVP</Link>
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
