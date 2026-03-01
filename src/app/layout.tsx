import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import Icon from '@/components/icon';
import SiteMotion from '@/components/site-motion';
import SpacetimeAppProvider from '@/components/spacetimedb-app-provider';
import './globals.css';

export const metadata: Metadata = {
  title: 'Samuel and Natasha | Wedding',
  description: 'Wedding website and RSVP for Samuel and Natasha.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
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
