import Link from 'next/link';
import Icon from '@/components/icon';

export default function EventDetailsPage() {
  return (
    <>
      <section className="section-band section-band-title">
        <div className="container page-head">
          <h1 className="heading-with-icon">
            <Icon name="event" className="heading-icon" />
            <span>Event Details</span>
          </h1>
          <p>Morning service, followed by reception in the church hall.</p>
        </div>
      </section>

      <section className="section-band">
        <div className="container card">
          <h2 className="heading-with-icon">
            <Icon name="schedule" className="heading-icon" />
            <span>Schedule</span>
          </h2>
          <ol className="timeline">
            <li>
              <strong>Doors Open — W</strong>
              <p>Guest check-in begins and ushers will assist with seating.</p>
            </li>
            <li>
              <strong>Be Seated By — X</strong>
              <p>Please be seated before the bridal procession begins.</p>
            </li>
            <li>
              <strong>Service Starts — Y</strong>
              <p>Wedding service at The Singapore Thomson Road Baptist Church.</p>
            </li>
            <li>
              <strong>Reception — Z</strong>
              <p>Reception to follow in the church hall.</p>
            </li>
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
              rel="noreferrer"
            >
              Open in Maps
              <Icon name="arrow_outward" className="inline-icon" />
            </a>
          </p>
        </div>
      </section>

      <section className="section-band">
        <div className="container section-grid">
          <div className="card">
            <h2 className="heading-with-icon">
              <Icon name="local_taxi" className="heading-icon" />
              <span>Transport and Parking</span>
            </h2>
            <p>
              The venue is accessible by private-hire, taxi, and public transport routes near
              Thomson Road.
            </p>
            <p>
              Limited parking lots may be available on-site; nearby alternatives can be used if
              the church lots are full.
            </p>
          </div>
          <div className="card">
            <h2 className="heading-with-icon">
              <Icon name="style" className="heading-icon" />
              <span>What to Expect</span>
            </h2>
            <p>
              The service and reception are planned with a formal tone. We kindly ask guests to
              arrive punctually and be seated before the service begins.
            </p>
            <p>
              Reception refreshments, family photos, and fellowship will follow in the church hall.
            </p>
          </div>
        </div>
      </section>

      <section className="section-band">
        <div className="container cta-row">
          <Link href="/rsvp" className="button-primary">
            <Icon name="how_to_reg" className="button-icon" /> RSVP Now
          </Link>
        </div>
      </section>
    </>
  );
}
