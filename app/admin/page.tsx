import { getAdminSession } from '@/lib/admin-auth';
import { AdminClient } from './AdminClient';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const initialAuthed = await getAdminSession();
  return <AdminClient initialAuthed={initialAuthed} />;
}
