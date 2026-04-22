'use client';

import React from 'react';
import { useWorkoutLanguage } from '@/context/WorkoutLanguageContext';
import HelpButton from './HelpButton';

// Thin client wrapper that applies `dir` and `lang` based on the current
// language, so the CSS and screen readers see the right direction. Also
// mounts the floating help FAB so it's available on every workout page.
export default function WorkoutShell({ children }: { children: React.ReactNode }) {
  const { dir, language } = useWorkoutLanguage();
  return (
    <div className="workout-app" dir={dir} lang={language}>
      {children}
      <HelpButton />
    </div>
  );
}
