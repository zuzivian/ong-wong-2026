import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Icon from '@/components/icon';
import { ADMIN_COOKIE_NAME, readAdminSession } from '@/lib/admin-auth';

export default async function AdminProtectedLayout({ children }: { children: React.ReactNode }) {
  const cookie = cookies().get(ADMIN_COOKIE_NAME)?.value;
  const isValid = await readAdminSession(cookie);
  if (!isValid) {
    redirect('/admin/login');
  }

  return (
    <>
      <section className="page-head" style={{ paddingBottom: 0 }}>
        <nav style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexWrap: 'wrap' }}>
          <span className="eyebrow" style={{ marginRight: '0.3rem' }}>Admin</span>
          <Link href="/admin/guests" className="button-back-small">
            <Icon name="groups" className="button-icon" />
            Guest RSVP
          </Link>
          <Link href="/admin/cutoff" className="button-back-small">
            <Icon name="schedule" className="button-icon" />
            RSVP Cutoff
          </Link>
        </nav>
      </section>
      {children}
    </>
  );
}
