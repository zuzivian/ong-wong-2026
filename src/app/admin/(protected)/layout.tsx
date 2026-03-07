import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ADMIN_COOKIE_NAME, readAdminSession } from '@/lib/admin-auth';

export default async function AdminProtectedLayout({ children }: { children: React.ReactNode }) {
  const cookie = cookies().get(ADMIN_COOKIE_NAME)?.value;
  const isValid = await readAdminSession(cookie);
  if (!isValid) {
    redirect('/admin/login');
  }

  return children;
}
