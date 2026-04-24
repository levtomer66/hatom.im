'use client';

import React from 'react';
import { useWorkoutUser } from '@/context/WorkoutUserContext';
import { useT } from '@/lib/workout-i18n';
import LanguageToggle from './LanguageToggle';
import WeightUnitToggle from './WeightUnitToggle';

interface HeaderProps {
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
}

export default function Header({ title, showBack, onBack }: HeaderProps) {
  const { currentUser, logout } = useWorkoutUser();
  const t = useT();
  const effectiveTitle = title ?? t('workout.title');

  return (
    <header className="workout-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
        {showBack && (
          <button
            onClick={onBack}
            aria-label={t('generic.back')}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--workout-text)',
              fontSize: '20px',
              cursor: 'pointer',
              padding: '4px',
            }}
          >
            ←
          </button>
        )}
        <h1 className="workout-header-title" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {effectiveTitle}
        </h1>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <WeightUnitToggle size="sm" />
        <LanguageToggle size="sm" />
        {currentUser && (
          <button className="workout-header-user" onClick={logout}>
            <div className="workout-header-user-avatar">
              {currentUser.name.charAt(0).toUpperCase()}
            </div>
            <span>{currentUser.name}</span>
            <span style={{ fontSize: '12px', color: 'var(--workout-text-secondary)' }}>
              {t('header.switch_user')}
            </span>
          </button>
        )}
      </div>
    </header>
  );
}
