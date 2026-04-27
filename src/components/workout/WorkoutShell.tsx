'use client';

import React from 'react';
import { useWorkoutLanguage } from '@/context/WorkoutLanguageContext';
import HelpButton from './HelpButton';
import RestTimerBar from './RestTimerBar';

export default function WorkoutShell({ children }: { children: React.ReactNode }) {
  const { dir, language } = useWorkoutLanguage();
  return (
    <div className="workout-app" dir={dir} lang={language}>
      {children}
      <RestTimerBar />
      <HelpButton />
    </div>
  );
}
