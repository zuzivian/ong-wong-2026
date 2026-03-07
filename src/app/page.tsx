import Image from "next/image";
import Link from "next/link";
import { cookies } from "next/headers";
import Icon from "@/components/icon";
import HomeInvitationFocus from "@/components/home-invitation-focus";
import HomeUnlockCta from "@/components/home-unlock-cta";
import { DbConnection } from "@/module_bindings";
import { getVariantMeta } from "@/lib/design-variant";
import { UNLOCK_COOKIE_NAME, readUnlockSession } from "@/lib/invite-unlock";

const DEFAULT_QUERY_TIMEOUT_MS = 5000;

type GuestTableRow = {
  firstName: string;
  lastName: string;
};

const SCHEDULE_ITEMS = [
  {
    icon: "meeting_room",
    time: "9:30 AM",
    title: "Doors Open",
    description: "Guest check-in begins and ushers will assist with seating.",
  },
  {
    icon: "chair_alt",
    time: "9:50 AM",
    title: "Be Seated By",
    description: "Please be seated before the bridal procession begins.",
  },
  {
    icon: "favorite",
    time: "10:00 AM",
    title: "Service Starts",
    description:
      "Wedding service at The Singapore Thomson Road Baptist Church.",
  },
  {
    icon: "celebration",
    time: "12:00 PM",
    title: "Reception",
    description: "Reception to follow in the church hall.",
  },
] as const;

const BUS_STOPS = [
  {
    name: "Opp United Sq",
    stopCode: "50029",
    road: "Thomson Road",
    walkMinutes: 3,
    services: "56, 57, 131, 131A, 141, 166, 851, 980",
  },
  {
    name: "United Sq / Bef Novena Stn",
    stopCode: "50021",
    road: "Thomson Road",
    walkMinutes: 4,
    services: "56, 57, 131, 141, 166, 851, 980",
  },
  {
    name: "St. Joseph Instn Jnr",
    stopCode: "50119",
    road: "Moulmein Road",
    walkMinutes: 6,
    services: "21, 124, 518, 518A, 680, 681, 682, 683",
  },
] as const;

const MALL_PARKING_OPTIONS = [
  {
    name: "United Square",
    address: "101 Thomson Road",
    walkMinutes: 4,
    mapUrl: "https://maps.google.com/?q=101+Thomson+Road+Singapore",
  },
  {
    name: "Velocity @ Novena Square",
    address: "238 Thomson Road",
    walkMinutes: 8,
    mapUrl: "https://maps.google.com/?q=238+Thomson+Road+Singapore",
  },
  {
    name: "Square 2",
    address: "10 Sinaran Drive",
    walkMinutes: 10,
    mapUrl: "https://maps.google.com/?q=10+Sinaran+Drive+Singapore",
  },
  {
    name: "Goldhill Plaza",
    address: "1 Goldhill Plaza",
    walkMinutes: 6,
    mapUrl: "https://maps.google.com/?q=1+Goldhill+Plaza+Singapore",
  },
] as const;

const HDB_PARKING_OPTIONS = [
  {
    carpark: "KJM1",
    address: "Blk 37A Cambridge Road",
    walkMinutes: 7,
    note: "Multi-storey, short-term WHOLE DAY parking",
  },
  {
    carpark: "KJ3",
    address: "Blk 48/48A Durham Road",
    walkMinutes: 9,
    note: "Surface lot, short-term WHOLE DAY parking",
  },
  {
    carpark: "KJ2",
    address: "Blk 49/50 Dorset Road",
    walkMinutes: 11,
    note: "Surface lot, short-term WHOLE DAY parking",
  },
  {
    carpark: "BR9",
    address: "Blk 69 Moulmein Road",
    walkMinutes: 12,
    note: "Surface lot, short-term WHOLE DAY parking",
  },
] as const;

function normalizeToWsUri(input: string): string {
  const parsed = new URL(input);
  if (parsed.protocol === "https:") {
    parsed.protocol = "wss:";
  } else if (parsed.protocol === "http:") {
    parsed.protocol = "ws:";
  }

  return parsed.toString();
}

function escapeSqlLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

function getSpacetimeConfig(): { host: string; databaseName: string } | null {
  const host =
    process.env.SPACETIMEDB_HOST ??
    process.env.NEXT_PUBLIC_SPACETIMEDB_HOST ??
    "";
  const databaseName =
    process.env.SPACETIMEDB_DB_NAME ??
    process.env.NEXT_PUBLIC_SPACETIMEDB_DB_NAME ??
    "";

  if (!host.trim() || !databaseName.trim()) {
    return null;
  }

  return { host: host.trim(), databaseName: databaseName.trim() };
}

function formatGuestName(row: GuestTableRow | undefined): string | undefined {
  if (!row) {
    return undefined;
  }

  const name = `${row.firstName ?? ""} ${row.lastName ?? ""}`.trim();
  return name.length > 0 ? name : undefined;
}

async function getGuestNameByInviteCode(
  inviteCode: string,
): Promise<string | undefined> {
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
          const escapedInviteCode = escapeSqlLiteral(
            inviteCode.trim().toUpperCase(),
          );

          ctx
            .subscriptionBuilder()
            .onApplied((subscriptionCtx) => {
              const guestTable = (
                subscriptionCtx.db as Record<
                  string,
                  { iter(): Iterable<GuestTableRow> }
                >
              ).guest;
              const firstMatch = guestTable
                ? Array.from(guestTable.iter())[0]
                : undefined;
              settle(formatGuestName(firstMatch));
            })
            .onError(() => {
              settle(undefined);
            })
            .subscribe([
              `SELECT * FROM guest WHERE inviteCode = '${escapedInviteCode}'`,
            ]);
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
      {isUnlocked ? (
        <HomeInvitationFocus targetId="home-invitation-card" />
      ) : null}

      <section
        className={`jumbo ${variantMeta.heroClass} ${isUnlocked ? "" : "jumbo-fullscreen"}`}
      >
        <div className="container jumbo-inner">
          <div className="jumbo-content">
            <p className="eyebrow">The matrimony of</p>
            <h1 className="jumbo-title">Samuel & Natasha</h1>
            <p className="jumbo-date">15 Aug 2026</p>
            <div className="cta-row">
              {isUnlocked ? (
                <>
                  <Link href="/rsvp" className="button-primary">
                    <Icon name="how_to_reg" className="button-icon" /> Submit
                    RSVP
                  </Link>
                  <a href="#schedule" className="button-secondary">
                    <Icon name="event_note" className="button-icon" /> Event
                    Details
                  </a>
                </>
              ) : (
                <HomeUnlockCta />
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="section-band home-photo-band">
        <div className="container home-photo-layout">
          <div className="home-photo-copy">
            <p className="eyebrow">A little glimpse</p>
            <h2>Moments that led us here</h2>
            <p>
              The day itself will move quickly, so we wanted the homepage to
              hold a few quieter moments too: one from the journey, and one from
              the promise we are preparing to make.
            </p>
          </div>
          <div className="home-photo-stack" aria-label="Engagement photos">
            <figure className="home-photo-frame home-photo-frame-detail">
              <Image
                src="/photos/photo-3.jpg"
                alt="Close-up of Samuel and Natasha holding hands, showing Natasha's engagement ring."
                fill
                sizes="(max-width: 760px) 100vw, (max-width: 980px) 42vw, 24vw"
                className="home-photo-image"
              />
            </figure>
            <figure className="home-photo-frame home-photo-frame-portrait">
              <Image
                src="/photos/photo-1.jpg"
                alt="Samuel and Natasha standing together on a forest boardwalk."
                fill
                sizes="(max-width: 760px) 100vw, (max-width: 980px) 60vw, 34vw"
                className="home-photo-image"
              />
            </figure>
          </div>
        </div>
      </section>

      {isUnlocked ? (
        <>
          <section
            id="home-invitation-card"
            className="section-band invite-card-band"
          >
            <div className="container">
              <article className="invitation-card">
                <div className="invitation-ornaments" aria-hidden="true">
                  <span className="invitation-ornament invitation-ornament-tl">
                    ✦
                  </span>
                  <span className="invitation-ornament invitation-ornament-tr">
                    ✦
                  </span>
                  <span className="invitation-ornament invitation-ornament-bl">
                    ✦
                  </span>
                  <span className="invitation-ornament invitation-ornament-br">
                    ✦
                  </span>
                </div>
                <p className="eyebrow">Invitation</p>
                <h2 className="invitation-card-title">Samuel &amp; Natasha</h2>
                <p className="invitation-card-subtitle">
                  With joy, we invite you to celebrate our wedding day.
                </p>
                <dl className="invitation-card-grid">
                  <div className="invitation-card-item">
                    <dt>Name</dt>
                    <dd>{guestName ?? "Honored Guest"}</dd>
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
                  <Link
                    href="/rsvp"
                    className="button-primary invitation-card-rsvp"
                  >
                    <Icon name="how_to_reg" className="button-icon" /> RSVP Now
                  </Link>
                </div>
              </article>
            </div>
          </section>

          <section id="schedule" className="section-band">
            <div className="container card">
              <h2 className="heading-with-icon">
                <Icon name="schedule" className="heading-icon" />
                <span>Schedule</span>
              </h2>
              <ol className="timeline">
                {SCHEDULE_ITEMS.map((item) => (
                  <li key={`${item.time}-${item.title}`}>
                    <div className="timeline-stop-head">
                      <span className="timeline-marker">
                        <Icon
                          name={item.icon}
                          className="timeline-marker-icon"
                        />
                      </span>
                      <p className="timeline-time">{item.time}</p>
                    </div>
                    <div className="timeline-card">
                      <strong className="timeline-title">{item.title}</strong>
                      <p>{item.description}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          <section className="section-band section-band-contrast">
            <div className="container card card-inverse">
              <h2 className="heading-with-icon">
                <Icon name="location_on" className="heading-icon" />
                <span>Venue</span>
              </h2>
              <p>The Singapore Thomson Road Baptist Church</p>
              <p>45 Thomson Road, Singapore 307584</p>
              <div className="map-wrap">
                <iframe
                  title="The Singapore Thomson Road Baptist Church map"
                  src="https://maps.google.com/maps?q=45%20Thomson%20Road%20Singapore%20307584&z=15&output=embed"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
              <p>
                <a
                  href="https://maps.google.com/?q=45+Thomson+Road+Singapore+307584"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open in Maps
                  <Icon name="arrow_outward" className="inline-icon" />
                </a>
              </p>
            </div>
          </section>

          <section className="section-band">
            <div className="container section-grid section-grid-stack">
              <div className="card">
                <h2 className="heading-with-icon">
                  <Icon name="local_taxi" className="heading-icon" />
                  <span>Getting There and Parking</span>
                </h2>
                <p>
                  The closest MRT is <strong>Novena (NS20)</strong>. If you are
                  taking taxi or ride-hail, set drop-off as{" "}
                  <strong>45 Thomson Road, Singapore 307584</strong>.
                </p>
                <p className="detail-strong">By MRT (recommended)</p>
                <ol className="mini-timeline">
                  <li>Take the North-South Line to Novena (NS20).</li>
                  <li>Use Exit A toward Velocity / United Square.</li>
                  <li>
                    Walk south along Thomson Road for about 8 to 10 minutes
                    (around 700m).
                  </li>
                  <li>
                    The church is at 45 Thomson Road, before the Balestier Road
                    junction.
                  </li>
                </ol>
                <p className="detail-strong">By bus (closest stops)</p>
                <ul className="mini-timeline">
                  {BUS_STOPS.map((stop) => (
                    <li key={stop.stopCode}>
                      <strong>
                        {stop.name} ({stop.stopCode})
                      </strong>{" "}
                      on {stop.road} - about {stop.walkMinutes} minutes&apos;
                      walk. Services: {stop.services}.
                    </li>
                  ))}
                </ul>
                <p className="detail-strong">Nearby mall parking</p>
                <ul className="mini-timeline">
                  {MALL_PARKING_OPTIONS.map((option) => (
                    <li key={option.name}>
                      <a href={option.mapUrl} target="_blank" rel="noreferrer">
                        <strong>{option.name}</strong>
                      </a>{" "}
                      ({option.address}) - around {option.walkMinutes}{" "}
                      minutes&apos; walk.
                    </li>
                  ))}
                </ul>
                <p className="detail-strong">Nearby HDB parking alternatives</p>
                <ul className="mini-timeline">
                  {HDB_PARKING_OPTIONS.map((option) => (
                    <li key={option.carpark}>
                      <strong>
                        HDB {option.carpark} - {option.address}
                      </strong>{" "}
                      ({option.note}), around {option.walkMinutes} minutes&apos;
                      walk.
                    </li>
                  ))}
                </ul>
                <p>
                  Church parking is limited. We strongly recommend allowing a
                  small buffer for weekend traffic and parking queues.
                </p>
                <p className="small-note">
                  Transport and parking details were cross-checked on 1 Mar
                  2026.
                </p>
              </div>
              <div className="card">
                <h2 className="heading-with-icon">
                  <Icon name="style" className="heading-icon" />
                  <span>What to Expect</span>
                </h2>
                <p>
                  We are so grateful to celebrate this joyful day with you.
                  Please come as you are, arrive a little early, and settle in
                  before the service begins.
                </p>
                <p>
                  Our ceremony is a Christian wedding service held at Thomson
                  Road Baptist Church, shaped by the faith community Samuel
                  calls home at Bethesda Bedok Tampines Church. You can expect
                  worship songs, a short Bible message, prayers, and the
                  exchange of vows. After the service, we&apos;ll continue the
                  celebration with refreshments, photos, and fellowship in the
                  church hall.
                </p>
              </div>
            </div>
          </section>
        </>
      ) : (
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
                  Confirm your availability for Saturday,{" "}
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
      )}
    </div>
  );
}
