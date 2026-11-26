import { headers } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { auth } from '@/auth';
import { localDevServer } from '@/lib/local-dev-login';
import { GYMS } from '@/data/gym-machines';
import GymBackoffice from './GymBackoffice';
import './gyms.css';

export const dynamic = 'force-dynamic';
export const metadata = { title: '🏋️ Gym backoffice' };

// Local-only backoffice: build the gyms users pick from in the workout app.
// Saving rewrites src/data/gyms.ts; commit that file to ship it.
export default async function GymsAdminPage() {
  if (!localDevServer((await headers()).get('host'))) notFound();
  const session = await auth();
  if (!session?.user) redirect('/login?from=/admin/gyms');
  if (!session.user.isOwner) redirect('/');
  return <GymBackoffice initialGyms={GYMS} />;
}
