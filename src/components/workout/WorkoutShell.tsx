'use client';

import React from 'react';
import { useWorkoutLanguage } from '@/context/WorkoutLanguageContext';

// Thin client wrapper that applies `dir` and `lang` based on the current
// language, so the CSS and screen readers see the right direction.
export default function WorkoutShell({ children }: { children: React.ReactNode }) {
  const { dir, language } = useWorkoutLanguage();
  return (
    <div className="workout-app" dir={dir} lang={language}>
      {children}
    </div>
  );
}
