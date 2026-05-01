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
    time: "10:00 AM",
    title: "Doors Open",
    description: "Guests are warmly welcomed to arrive and register before the ceremony begins.",
  },
  {
    icon: "chair_alt",
    time: "10:25 AM",
    title: "Be Seated By",
    description: "Kindly be seated as we prepare to begin the ceremony shortly.",
  },
  {
    icon: "favorite",
    time: "10:30 AM",
    title: "Ceremony Begins",
    description:
      "Join us as we begin the wedding ceremony and exchange of vows.",
  },
  {
    icon: "celebration",
    time: "11:30 AM",
    title: "Reception",
    description: "Celebrate with us over food, drinks, and joyful moments following the ceremony.",
  },
] as const;

const BUS_ROUTES = [
  {
    road: "Thomson Road",
    stops:
      "United Sq / Bef Novena Stn (50021) - 3 min walk (250m) | Opp United Sq (50029) - 9 min walk (650m).",
    services: "56, 57, 131, 141, 166, 851, 980",
  },
  {
    road: "Bukit Timah Road",
    stops:
      "Aft Makepeace Rd (40029) - 10 min walk (700m) | Bef Winstedt Rd (50021) - 13 min walk (900m).",
    services: "48, 67, 170, 960",
  },
  {
    road: "Moulmein Road",
    stops: "St. Joseph Instn Jnr (50119) - 9 min walk (650m).",
    services: "21, 124, 518, 518A, 680, 681, 682, 683",
  },
] as const;

const PARKING_OPTIONS = [
  {
    name: "United Square",
    walkMinutes: 4,
    distance: "350m",
    mapUrl: "https://maps.google.com/?q=101+Thomson+Road+Singapore",
  },
  {
    name: "Goldhill Plaza",
    walkMinutes: 6,
    distance: "450m",
    mapUrl: "https://maps.google.com/?q=1+Goldhill+Plaza+Singapore",
  },
  {
    name: "Velocity @ Novena Square",
    walkMinutes: 8,
    distance: "550m",
    mapUrl: "https://maps.google.com/?q=238+Thomson+Road+Singapore",
  },
  {
    name: "Square 2",
    walkMinutes: 12,
    distance: "850m",
    mapUrl: "https://maps.google.com/?q=10+Sinaran+Drive+Singapore",
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
            <p className="eyebrow">Saturday • 15 August 2026<br />Singapore Thomson Road Baptist Church</p>
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
              RSVP. Kindly RSVP by <strong>31 May 2026</strong>.
            </p>
            <p>
              You may revisit the page anytime using your personalised code to
              update your RSVP before the deadline.
            </p>
            <p>
              For changes after 31 May 2026, please reach out to Samuel or
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
                    <dd>Saturday, 15 Aug 2026 at 10:30 AM</dd>
                  </div>
                  <div className="invitation-card-item">
                    <dt>Location</dt>
                    <dd>Singapore Thomson Road Baptist Church</dd>
                  </div>
                  <div className="invitation-card-item">
                    <dt>Attire</dt>
                    <dd>Semi-formal</dd>
                  </div>
                  <div className="invitation-card-item">
                    <dt>Refreshments</dt>
                    <dd>Buffet lunch will be catered after the ceremony</dd>
                  </div>
                </dl>
                <div className="invitation-card-footer">
                  <HomeRsvpCta
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
              <p>Singapore Thomson Road Baptist Church</p>
              <p>45 Thomson Road, Singapore 307584</p>
              <p>Main Sanctuary (Level 2) - Accessible via lift and staircase on the ground floor</p>
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
                <p className="detail-strong">🚇 By MRT</p>
                <p>
                  Nearest MRT Station: <strong>Novena MRT (NS20)</strong>.
                  Take an 8 minute walk (600m) from Exit B / Velocity to arrive
                  at the venue. Please note that the United Square exit is
                  closed due to construction works.
                </p>
                <p className="detail-strong">🚌 By bus</p>
                <ul className="mini-timeline">
                  {BUS_ROUTES.map((route) => (
                    <li key={route.road}>
                      <strong>{route.road}:</strong> {route.stops} Services:{" "}
                      {route.services}.
                    </li>
                  ))}
                </ul>
                <p className="detail-strong">🚖 By private hire</p>
                <p>
                  Please use <strong>Singapore Thomson Road Baptist Church</strong>{" "}
                  or <strong>Thomson Road Baptist Church</strong>.
                </p>
                <p className="detail-strong">🚘 By car</p>
                <p>
                  Limited parking at Singapore Thomson Road Baptist Church (20
                  lots).
                </p>
                <p className="detail-strong">Alternative parking</p>
                <ul className="mini-timeline">
                  {PARKING_OPTIONS.map((option) => (
                    <li key={option.name}>
                      <a href={option.mapUrl} target="_blank" rel="noreferrer">
                        <strong>{option.name}</strong>
                      </a>{" "}
                      - {option.walkMinutes} min walk ({option.distance}).
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
