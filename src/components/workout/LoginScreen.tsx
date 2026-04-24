'use client';

import React from 'react';
import { useWorkoutUser } from '@/context/WorkoutUserContext';
import { USERS } from '@/types/workout';
import { useT } from '@/lib/workout-i18n';
import LanguageToggle from './LanguageToggle';
import WeightUnitToggle from './WeightUnitToggle';

export default function LoginScreen() {
  const { setCurrentUser } = useWorkoutUser();
  const t = useT();

  return (
    <div className="login-container">
      <div style={{ position: 'absolute', top: '16px', insetInlineEnd: '16px', display: 'flex', gap: '8px', alignItems: 'center' }}>
        <WeightUnitToggle />
        <LanguageToggle />
      </div>

      <h1 className="login-title">{t('login.title')}</h1>
      <p className="login-subtitle">{t('login.subtitle')}</p>

      <div className="login-buttons">
        {USERS.map(user => (
          <button
            key={user.id}
            className="login-user-btn"
            onClick={() => setCurrentUser(user)}
          >
            <div className="login-user-avatar">
              {user.name.charAt(0).toUpperCase()}
            </div>
            {user.name}
          </button>
        ))}
      </div>
    </div>
  );
}
