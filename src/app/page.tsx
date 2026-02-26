import Link from 'next/link';
import Icon from '@/components/icon';
import { getVariantMeta, parseVariant } from '@/lib/design-variant';

type HomePageProps = {
  searchParams?: {
    v?: string;
  };
};

export default function HomePage({ searchParams }: HomePageProps) {
  const variant = parseVariant(searchParams?.v);
  const variantMeta = getVariantMeta(variant);

  return (
    <div className={`theme-page ${variantMeta.themeClass}`}>
      <section className={`jumbo ${variantMeta.heroClass}`}>
        <div className="container jumbo-inner">
          <div className="jumbo-content">
            <h1 className="jumbo-title">Samuel & Natasha</h1>
            <p className="jumbo-date">15 Aug 2026</p>
            <div className="cta-row">
              <Link href={`/rsvp?v=${variant}`} className="button-primary">
                <Icon name="how_to_reg" className="button-icon" /> RSVP Now
              </Link>
              <Link href="/event-details" className="button-secondary">
                <Icon name="arrow_outward" className="button-icon" /> Event
                Details
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="section-band">
        <div className="container section-grid">
          <div>
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
              This site includes schedule updates, venue guidance, and your RSVP
              dashboard in one place.
            </p>
          </div>
          <div>
            <h2 className="heading-with-icon">
              <Icon name="schedule" className="heading-icon" />
              <span>Schedule Snapshot</span>
            </h2>
            <ol className="mini-timeline">
              <li>Doors open at W</li>
              <li>Please be seated by X</li>
              <li>Service starts at Y</li>
              <li>Reception in church hall at Z</li>
            </ol>
          </div>
        </div>
      </section>

      <section className="section-band section-band-contrast">
        <div className="container quick-links">
          <Link href="/event-details" className="link-panel">
            <div className="panel-icon-wrap">
              <Icon name="event_note" className="panel-icon" />
            </div>
            <h3>Event Details</h3>
            <ol className="mini-timeline">
              <li>Doors open at W</li>
              <li>Please be seated by X</li>
              <li>Service starts at Y</li>
              <li>Reception at Z</li>
            </ol>
          </Link>
          <div className="link-panel">
            <div className="panel-icon-wrap">
              <Icon name="location_on" className="panel-icon" />
            </div>
            <h3>Venue</h3>
            <p>The Singapore Thomson Road Baptist Church</p>
            <p>45 Thomson Road, Singapore 307584</p>
            <p>
              Ceremony in the sanctuary, reception immediately after in the
              hall.
            </p>
            <div className="map-wrap">
              <iframe
                title="Wedding venue map"
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
          <div className="link-panel">
            <div className="panel-icon-wrap">
              <Icon name="info" className="panel-icon" />
            </div>
            <h3>Guest Info</h3>
            <p>
              Current scheme: <strong>{variantMeta.label}</strong>
            </p>
            <p>
              RSVP deadline: to be confirmed once catering timeline is
              finalized.
            </p>
            <p>Dress code: formal with modest church-appropriate attire.</p>
            <p>
              For common guest questions, visit <Link href="/faq">FAQ</Link>.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
