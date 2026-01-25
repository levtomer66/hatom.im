'use client';

import React from 'react';
import { useWorkoutUser } from '@/context/WorkoutUserContext';
import { USERS } from '@/types/workout';

export default function LoginScreen() {
  const { setCurrentUser } = useWorkoutUser();

  return (
    <div className="login-container">
      <h1 className="login-title">💪 Workout Tracker</h1>
      <p className="login-subtitle">Select your profile to continue</p>
      
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
