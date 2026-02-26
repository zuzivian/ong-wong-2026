import Link from 'next/link';
import Icon from '@/components/icon';

export default function DashboardPage() {
  return (
    <>
      <section className="page-head">
        <h1 className="heading-with-icon">
          <Icon name="dashboard" className="heading-icon" />
          <span>Guest Dashboard</span>
        </h1>
        <p>Manage your RSVP details and send us any questions.</p>
      </section>

      <section className="card">
        <h2 className="heading-with-icon">
          <Icon name="fact_check" className="heading-icon" />
          <span>Your RSVP</span>
        </h2>
        <p>Status: Attending (sample)</p>
        <p className="small-note">
          You may edit your RSVP until the global RSVP cutoff date.
        </p>
        <p>Primary guest: Samuel Wong</p>
        <p>Loved ones added: 1</p>
        <div className="cta-row">
          <Link href="/rsvp" className="button-secondary">
            <Icon name="edit_square" className="button-icon" /> Edit RSVP
          </Link>
        </div>
      </section>

      <section className="card">
        <h2 className="heading-with-icon">
          <Icon name="calendar_month" className="heading-icon" />
          <span>Event Day Snapshot</span>
        </h2>
        <ol className="mini-timeline">
          <li>Doors open at W</li>
          <li>Be seated by X</li>
          <li>Service starts at Y</li>
          <li>Reception at Z</li>
        </ol>
      </section>

      <section className="card">
        <h2 className="heading-with-icon">
          <Icon name="mail" className="heading-icon" />
          <span>Questions</span>
        </h2>
        <p className="small-note">We'll respond as soon as possible.</p>
        <form className="form-stack">
          <label>
            Message
            <textarea rows={5} placeholder="Type your question here." />
          </label>
          <button type="button" className="button-primary">
            <Icon name="send" className="button-icon" /> Send Message
          </button>
        </form>
      </section>
    </>
  );
}
