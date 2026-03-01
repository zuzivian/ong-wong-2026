import Link from 'next/link';
import { cookies } from 'next/headers';
import Icon from '@/components/icon';
import HomeInvitationFocus from '@/components/home-invitation-focus';
import HomeUnlockCta from '@/components/home-unlock-cta';
import { DbConnection } from '@/module_bindings';
import { getVariantMeta } from '@/lib/design-variant';
import { UNLOCK_COOKIE_NAME, readUnlockSession } from '@/lib/invite-unlock';

const DEFAULT_QUERY_TIMEOUT_MS = 5000;

type GuestTableRow = {
  firstName: string;
  lastName: string;
};

function normalizeToWsUri(input: string): string {
  const parsed = new URL(input);
  if (parsed.protocol === 'https:') {
    parsed.protocol = 'wss:';
  } else if (parsed.protocol === 'http:') {
    parsed.protocol = 'ws:';
  }

  return parsed.toString();
}

function escapeSqlLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

function getSpacetimeConfig(): { host: string; databaseName: string } | null {
  const host = process.env.SPACETIMEDB_HOST ?? process.env.NEXT_PUBLIC_SPACETIMEDB_HOST ?? '';
  const databaseName =
    process.env.SPACETIMEDB_DB_NAME ?? process.env.NEXT_PUBLIC_SPACETIMEDB_DB_NAME ?? '';

  if (!host.trim() || !databaseName.trim()) {
    return null;
  }

  return { host: host.trim(), databaseName: databaseName.trim() };
}

function formatGuestName(row: GuestTableRow | undefined): string | undefined {
  if (!row) {
    return undefined;
  }

  const name = `${row.firstName ?? ''} ${row.lastName ?? ''}`.trim();
  return name.length > 0 ? name : undefined;
}

async function getGuestNameByInviteCode(inviteCode: string): Promise<string | undefined> {
  const config = getSpacetimeConfig();
  if (!config || !inviteCode.trim()) {
    return undefined;
  }

  return new Promise<string | undefined>((resolve) => {
    let connection: DbConnection | null = null;
    let settled = false;

    const settle = (value: string | undefined) => {
      if (settled) {
        return;
      }
      settled = true;
      clearTimeout(timeout);
      if (connection) {
        connection.disconnect();
      }
      resolve(value);
    };

    const timeout = setTimeout(() => {
      settle(undefined);
    }, DEFAULT_QUERY_TIMEOUT_MS);

    try {
      connection = DbConnection.builder()
        .withUri(normalizeToWsUri(config.host))
        .withDatabaseName(config.databaseName)
        .onConnect((ctx) => {
          const escapedInviteCode = escapeSqlLiteral(inviteCode.trim().toUpperCase());

          ctx.subscriptionBuilder()
            .onApplied((subscriptionCtx) => {
              const guestTable = (subscriptionCtx.db as Record<string, { iter(): Iterable<GuestTableRow> }>)
                .guest;
              const firstMatch = guestTable ? Array.from(guestTable.iter())[0] : undefined;
              settle(formatGuestName(firstMatch));
            })
            .onError(() => {
              settle(undefined);
            })
            .subscribe([`SELECT * FROM guest WHERE inviteCode = '${escapedInviteCode}'`]);
        })
        .onConnectError(() => {
          settle(undefined);
        })
        .build();
    } catch {
      settle(undefined);
    }
  });
}

export default async function HomePage() {
  const variantMeta = getVariantMeta();
  const unlockCookie = cookies().get(UNLOCK_COOKIE_NAME)?.value;
  const unlockSession = await readUnlockSession(unlockCookie);
  const isUnlocked = unlockSession !== undefined;
  const guestName = unlockSession?.inviteCode
    ? await getGuestNameByInviteCode(unlockSession.inviteCode)
    : undefined;

  return (
    <div className={`theme-page ${variantMeta.themeClass}`}>
      {isUnlocked ? <HomeInvitationFocus targetId="home-invitation-card" /> : null}

      <section className={`jumbo ${variantMeta.heroClass} ${isUnlocked ? '' : 'jumbo-fullscreen'}`}>
        <div className="container jumbo-inner">
          <div className="jumbo-content">
            <p className="eyebrow">The matrimony of</p>
            <h1 className="jumbo-title">Samuel & Natasha</h1>
            <p className="jumbo-date">15 Aug 2026</p>
            <div className="cta-row">
              {isUnlocked ? (
                <>
                  <Link href="/rsvp" className="button-primary">
                    <Icon name="how_to_reg" className="button-icon" /> Submit RSVP
                  </Link>
                  <Link href="/event-details" className="button-secondary">
                    <Icon name="event_note" className="button-icon" /> View
                    Event Details
                  </Link>
                </>
              ) : (
                <HomeUnlockCta />
              )}
            </div>
          </div>
        </div>
      </section>

      {isUnlocked ? (
        <section id="home-invitation-card" className="section-band invite-card-band">
          <div className="container">
            <article className="invitation-card">
              <div className="invitation-ornaments" aria-hidden="true">
                <span className="invitation-ornament invitation-ornament-tl">✦</span>
                <span className="invitation-ornament invitation-ornament-tr">✦</span>
                <span className="invitation-ornament invitation-ornament-bl">✦</span>
                <span className="invitation-ornament invitation-ornament-br">✦</span>
              </div>
              <p className="eyebrow">Invitation</p>
              <h2 className="invitation-card-title">Samuel &amp; Natasha</h2>
              <p className="invitation-card-subtitle">With joy, we invite you to celebrate our wedding day.</p>
              <dl className="invitation-card-grid">
                <div className="invitation-card-item">
                  <dt>Name</dt>
                  <dd>{guestName ?? 'Honored Guest'}</dd>
                </div>
                <div className="invitation-card-item">
                  <dt>Invited to</dt>
                  <dd>Samuel and Natasha&apos;s Wedding</dd>
                </div>
                <div className="invitation-card-item">
                  <dt>Date and time</dt>
                  <dd>Saturday, 15 Aug 2026 at 10:00 AM</dd>
                </div>
                <div className="invitation-card-item">
                  <dt>Location</dt>
                  <dd>The Singapore Thomson Road Baptist Church</dd>
                </div>
                <div className="invitation-card-item">
                  <dt>Attire</dt>
                  <dd>Formal</dd>
                </div>
                <div className="invitation-card-item">
                  <dt>Refreshments</dt>
                  <dd>Refreshments will be served after the ceremony.</dd>
                </div>
              </dl>
              <div className="invitation-card-footer">
                <Link href="/rsvp" className="button-primary invitation-card-rsvp">
                  <Icon name="how_to_reg" className="button-icon" /> RSVP Now
                </Link>
              </div>
            </article>
          </div>
        </section>
      ) : null}

      <section className="section-band">
        <div className="container section-grid home-intro-grid">
          <article className="home-info-card">
            <h2 className="heading-with-icon">
              <Icon name="auto_awesome" className="heading-icon" />
              <span>Welcome</span>
            </h2>
            <p>
              We warmly invite you to celebrate our covenant service and
              reception. Your love, prayers, and presence mean a great deal to
              us and our families.
            </p>
            <p>
              Our wedding is on <strong>15 Aug 2026</strong>. Once you enter
              your invite code, you will see ceremony timing, venue details,
              RSVP, and your guest information.
            </p>
          </article>
          <article className="home-info-card">
            <h2 className="heading-with-icon">
              <Icon name="schedule" className="heading-icon" />
              <span>Before You Submit Your RSVP</span>
            </h2>
            <ol className="mini-timeline">
              <li>
                Confirm your availability for Saturday,{' '}
                <strong>15 Aug 2026</strong> before submitting.
              </li>
              <li>
                Prepare details for each invited guest, including attendance,
                meal preferences, and any access needs.
              </li>
              <li>
                Use your invite code to unlock your private page with ceremony
                timing, venue guidance, and the RSVP form.
              </li>
              <li>
                If your plans change, return to your dashboard to review and
                update your response.
              </li>
            </ol>
          </article>
        </div>
      </section>
    </div>
  );
}
