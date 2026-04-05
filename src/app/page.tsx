import Image from "next/image";
import { cookies } from "next/headers";
import Icon from "@/components/icon";
import HomeInvitationFocus from "@/components/home-invitation-focus";
import HomeRsvpCta from "@/components/home-rsvp-cta";
import HomeUnlockCta from "@/components/home-unlock-cta";
import { getVariantMeta } from "@/lib/design-variant";
import { buildWeddingGoogleCalendarUrl } from "@/lib/google-calendar";
import { getGuestSessionSummary } from "@/lib/guest-session-summary";
import { UNLOCK_COOKIE_NAME, readUnlockSession } from "@/lib/invite-unlock";

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

export default async function HomePage() {
  const variantMeta = getVariantMeta();
  const googleCalendarUrl = buildWeddingGoogleCalendarUrl();
  const cookieStore = await cookies();
  const unlockCookie = cookieStore.get(UNLOCK_COOKIE_NAME)?.value;
  const unlockSession = await readUnlockSession(unlockCookie);
  const isUnlocked = unlockSession !== undefined;
  const guestSessionSummary = unlockSession?.inviteCode
    ? await getGuestSessionSummary(unlockSession.inviteCode)
    : undefined;
  const guestName = guestSessionSummary?.guestName;
  const rsvpSubmitted = guestSessionSummary?.rsvpSubmitted ?? false;

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
            <p className="eyebrow">Saturday • 15 August 2026<br />Thomson Road Baptist Church</p>
            <h1 className="jumbo-title">Samuel & Natasha</h1>
            <p className="jumbo-date jumbo-date-lg">We look forward to having you with us on this special day as we enter into holy matrimony.</p>
            <div className="cta-row">
              {isUnlocked ? (
                <>
                  <HomeRsvpCta
                    initialSubmitted={rsvpSubmitted}
                  />
                  <a
                    href={googleCalendarUrl}
                    className="button-secondary"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Icon name="calendar_month" className="button-icon" /> Add
                    to Google Calendar
                  </a>
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
            <h2 className="heading-with-icon">
              <Icon name="auto_awesome" className="heading-icon" />
              <span>Welcome</span>
            </h2>
            <p>
              Please enter your invite code to view more details and submit your
              RSVP. Kindly RSVP by <strong>28 April 2026</strong>.
            </p>
            <p>
              You may revisit the page anytime using your personalised code to
              update your RSVP before the deadline.
            </p>
            <p>
              For changes after 28 April 2026, please reach out to Samuel or
              Natasha.
            </p>
          </div>
          <div className="home-photo-stack" aria-label="Ring photo">
            <figure className="home-photo-frame home-photo-frame-detail">
              <Image
                src="/photos/photo-3.jpg"
                alt="Close-up of Samuel and Natasha holding hands, showing Natasha's engagement ring."
                fill
                sizes="(max-width: 760px) 100vw, (max-width: 980px) 42vw, 24vw"
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
                <p className="eyebrow">Invitation</p>
                <h2 className="invitation-card-title">Samuel &amp; Natasha</h2>
                <p className="invitation-card-subtitle">
                  We would be honored by your presence as we celebrate our wedding day.
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
                  <HomeRsvpCta
                    inviteCode={unlockSession?.inviteCode ?? ""}
                    initialSubmitted={rsvpSubmitted}
                    hideWhenSubmitted
                    className="button-primary invitation-card-rsvp"
                  />
                  <a
                    href={googleCalendarUrl}
                    className="button-secondary invitation-card-calendar"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Icon name="calendar_month" className="button-icon" /> Add
                    to Google Calendar
                  </a>
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
      ) : null}
    </div>
  );
}
