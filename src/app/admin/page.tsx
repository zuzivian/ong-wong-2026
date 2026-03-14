import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ADMIN_COOKIE_NAME, readAdminSession } from '@/lib/admin-auth';

export default async function AdminLandingPage() {
  const cookieStore = await cookies();
  const cookie = cookieStore.get(ADMIN_COOKIE_NAME)?.value;
  const isValid = await readAdminSession(cookie);
  redirect(isValid ? '/admin/guests' : '/admin/login');
}
