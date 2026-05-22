import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import Navbar from '@/components/Navbar';
import { getAllAuthorizedEmails } from '@/models/AuthorizedEmail';
import { OWNER_EMAILS } from '@/types/auth';
import AllowlistManager from './AllowlistManager';
import './admin.css';

export const dynamic = 'force-dynamic';

export default async function AllowlistPage() {
  const session = await auth();
  if (!session?.user) {
    redirect('/login?from=/admin/allowlist');
  }
  if (!session.user.isOwner) {
    redirect('/');
  }

  const initial = await getAllAuthorizedEmails();

  return (
    <>
      <Navbar />
      <main className="admin-page">
        <div className="admin-container">
          <header className="admin-hero">
            <h1>Authorized emails</h1>
            <p>
              Owners ({OWNER_EMAILS.join(', ')}) are always allowed. Anyone else who should be
              able to sign in needs an entry below.
            </p>
          </header>
          <AllowlistManager initial={initial} />
        </div>
      </main>
    </>
  );
}
