import Link from 'next/link';
import Icon from '@/components/icon';
import { getVariantMeta } from '@/lib/design-variant';

export default function HomePage() {
  const variantMeta = getVariantMeta();

  return (
    <div className={`theme-page ${variantMeta.themeClass}`}>
      <section className={`jumbo ${variantMeta.heroClass}`}>
        <div className="container jumbo-inner">
          <div className="jumbo-content">
            <h1 className="jumbo-title">Samuel & Natasha</h1>
            <p className="jumbo-date">August 2026</p>
            <div className="cta-row">
              <Link href="/unlock" className="button-primary">
                <Icon name="lock_open" className="button-icon" /> Enter Invite
                Code
              </Link>
              <Link href="/unlock" className="button-secondary">
                <Icon name="how_to_reg" className="button-icon" /> RSVP With Us
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
              Once you enter your invite code, you will see ceremony timing,
              venue details, RSVP, and your guest dashboard.
            </p>
          </div>
          <div>
            <h2 className="heading-with-icon">
              <Icon name="schedule" className="heading-icon" />
              <span>Before You RSVP</span>
            </h2>
            <ol className="mini-timeline">
              <li>You can explore this welcome page at any time.</li>
              <li>Your invite code opens your private wedding details.</li>
              <li>After unlocking, you can RSVP and access your dashboard.</li>
              <li>If your code is missing, please contact us directly.</li>
            </ol>
          </div>
        </div>
      </section>

      <section className="section-band section-band-contrast">
        <div className="container quick-links">
          <Link href="/unlock" className="link-panel">
            <div className="panel-icon-wrap">
              <Icon name="lock_open" className="panel-icon" />
            </div>
            <h3>Enter Your Invite Code</h3>
            <p>
              Use your personal invite code to view timing, venue details,
              RSVP, and your guest dashboard.
            </p>
          </Link>
          <div className="link-panel">
            <div className="panel-icon-wrap">
              <Icon name="shield" className="panel-icon" />
            </div>
            <h3>Private Venue Details</h3>
            <p>
              Exact church address, maps, and service schedule are only visible
              after unlock.
            </p>
          </div>
          <div className="link-panel">
            <div className="panel-icon-wrap">
              <Icon name="info" className="panel-icon" />
            </div>
            <h3>Guest Info</h3>
            <p>
              Dress code and RSVP instructions are included in the private guest
              pages after unlock.
            </p>
            <p>
              Each guest should RSVP for themselves and invited companions.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
