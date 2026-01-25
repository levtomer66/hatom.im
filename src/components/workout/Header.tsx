'use client';

import React from 'react';
import { useWorkoutUser } from '@/context/WorkoutUserContext';

interface HeaderProps {
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
}

export default function Header({ title = 'Workout', showBack, onBack }: HeaderProps) {
  const { currentUser, logout } = useWorkoutUser();

  return (
    <header className="workout-header">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {showBack && (
          <button 
            onClick={onBack}
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
        <h1 className="workout-header-title">{title}</h1>
      </div>
      
      {currentUser && (
        <button className="workout-header-user" onClick={logout}>
          <div className="workout-header-user-avatar">
            {currentUser.name.charAt(0).toUpperCase()}
          </div>
          <span>{currentUser.name}</span>
          <span style={{ fontSize: '12px', color: 'var(--workout-text-secondary)' }}>
            Switch
          </span>
        </button>
      )}
    </header>
  );
}
