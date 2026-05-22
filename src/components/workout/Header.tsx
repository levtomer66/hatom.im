'use client';

import React from 'react';
import { useT } from '@/lib/workout-i18n';
import LanguageToggle from './LanguageToggle';
import WeightUnitToggle from './WeightUnitToggle';
import TimerPrefsMenu from './TimerPrefsMenu';

interface HeaderProps {
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
}

// The workout user is now identified by Google SSO (PR 4 of the SSO
// rollout). The Navbar's right-side cluster owns sign-in / sign-out, so
// this header no longer renders a per-page "switch user" button.
export default function Header({ title, showBack, onBack }: HeaderProps) {
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
        <TimerPrefsMenu />
        <WeightUnitToggle size="sm" />
        <LanguageToggle size="sm" />
      </div>
    </header>
  );
}
