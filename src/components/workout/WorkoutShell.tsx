'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useWorkoutLanguage } from '@/context/WorkoutLanguageContext';
import { hasPermission } from '@/lib/permissions';
import HelpButton from './HelpButton';
import RestTimerBar from './RestTimerBar';

export default function WorkoutShell({ children }: { children: React.ReactNode }) {
  const { dir, language } = useWorkoutLanguage();
  const router = useRouter();
  const { data: session, status } = useSession();

  // Centralised "do you hold the workout permission?" check — keeps every
  // /workout/* page from re-implementing the same redirect. Middleware
  // already gates anonymous + insufficient-permission traffic at the
  // edge, but a client-side fallback covers the brief window between
  // session refresh and Next's next request, plus any future static
  // export / soft-nav edge case.
  useEffect(() => {
    if (status === 'loading') return;
    if (!session?.user) return; // page-level useEffect handles /login bounce
    if (!hasPermission(session, 'workout')) {
      router.replace('/');
    }
  }, [session, status, router]);

  return (
    <div className="workout-app" dir={dir} lang={language}>
      {children}
      <RestTimerBar />
      <HelpButton />
    </div>
  );
}
