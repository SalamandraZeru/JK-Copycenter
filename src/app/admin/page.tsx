import { redirect } from 'next/navigation';
import { getAdminSession } from '@/lib/auth/admin';

export default async function AdminPage() {
  const session = await getAdminSession();
  if (session) {
    redirect('/admin/dashboard');
  } else {
    redirect('/admin/login');
  }
}
