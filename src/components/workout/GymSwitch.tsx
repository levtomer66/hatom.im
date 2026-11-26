'use client';

// PROTOTYPE — two-button switch for the gym you're training at.

import React from 'react';
import { GYMS } from '@/data/gym-machines';
import { useCurrentGym } from '@/lib/workout-gym';
import { useWorkoutLanguage } from '@/context/WorkoutLanguageContext';
import { useT } from '@/lib/workout-i18n';

export default function GymSwitch() {
  const [gymId, setGym] = useCurrentGym();
  const { language } = useWorkoutLanguage();
  const t = useT();
  return (
    <div className="gym-switch" role="radiogroup" aria-label={t('gym.label')}>
      <span className="gym-switch-label">📍 {t('gym.label')}</span>
      {GYMS.map((g) => (
        <button
          key={g.id}
          type="button"
          role="radio"
          aria-checked={gymId === g.id}
          className={`gym-switch-btn ${gymId === g.id ? 'active' : ''}`}
          onClick={() => setGym(g.id)}
        >
          {language === 'he' ? g.nameHe : g.name}
        </button>
      ))}
    </div>
  );
}
