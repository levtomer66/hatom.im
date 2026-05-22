import { redirect } from 'next/navigation';
import { signIn } from '@/auth';
import { auth } from '@/auth';
import Navbar from '@/components/Navbar';
import './login.css';

interface LoginPageProps {
  searchParams: Promise<{ from?: string }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await auth();
  const { from } = await searchParams;

  // If already signed in, bounce straight back to where they came from.
  if (session?.user) {
    redirect(from && from.startsWith('/') ? from : '/');
  }

  const callbackUrl = from && from.startsWith('/') ? from : '/';

  return (
    <>
      <Navbar />
      <main className="login-page">
        <div className="login-card">
          <h1 className="login-title">התומ.ים</h1>
          <p className="login-sub">
            Sign in to view personal pages.<br />
            <span className="login-sub-fine">Public pages stay open to everyone.</span>
          </p>

          <form
            action={async () => {
              'use server';
              await signIn('google', { redirectTo: callbackUrl });
            }}
          >
            <button type="submit" className="login-google-btn">
              <span className="login-google-glyph" aria-hidden="true">G</span>
              <span>Sign in with Google</span>
            </button>
          </form>

          <p className="login-fine">
            We use your Gmail address only to identify you on this site.
          </p>
        </div>
      </main>
    </>
  );
}
