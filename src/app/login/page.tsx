import { redirect } from 'next/navigation';
import { signIn } from '@/auth';
import { auth } from '@/auth';
import Navbar from '@/components/Navbar';
import './login.css';

interface LoginPageProps {
  searchParams: Promise<{ from?: string; error?: string }>;
}

// Reject protocol-relative (`//evil.com/...`) and backslash (`/\evil.com`)
// redirects — both are treated as absolute URLs by browsers. We only
// accept paths that start with a single `/` followed by a non-slash,
// non-backslash character. Plain `/` is allowed.
function safeRedirectTarget(target: string | undefined): string {
  if (!target) return '/';
  if (target === '/') return '/';
  return /^\/[^/\\]/.test(target) ? target : '/';
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const session = await auth();
  const { from, error } = await searchParams;
  const callbackUrl = safeRedirectTarget(from);

  // If already signed in, bounce straight back to where they came from.
  if (session?.user) {
    redirect(callbackUrl);
  }

  const accessDenied = error === 'AccessDenied';

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

          {accessDenied && (
            <div className="login-error" role="alert">
              That email isn&apos;t on the allowlist yet. Ask Tom or Tomer to add you.
            </div>
          )}

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
