'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { UserId, User, USERS } from '@/types/workout';

interface WorkoutUserContextType {
  currentUser: User | null;
  setCurrentUser: (user: User | null) => void;
  logout: () => void;
  isLoading: boolean;
}

const WorkoutUserContext = createContext<WorkoutUserContextType | undefined>(undefined);

const STORAGE_KEY = 'workout-app-user';

export function WorkoutUserProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUserState] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Load user from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const userId = JSON.parse(stored) as UserId;
        const user = USERS.find(u => u.id === userId);
        if (user) {
          setCurrentUserState(user);
        }
      } catch (e) {
        console.error('Failed to parse stored user:', e);
        localStorage.removeItem(STORAGE_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  const setCurrentUser = (user: User | null) => {
    setCurrentUserState(user);
    if (user) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(user.id));
    } else {
      localStorage.removeItem(STORAGE_KEY);
    }
  };

  const logout = () => {
    setCurrentUser(null);
  };

  return (
    <WorkoutUserContext.Provider value={{ currentUser, setCurrentUser, logout, isLoading }}>
      {children}
    </WorkoutUserContext.Provider>
  );
}

export function useWorkoutUser() {
  const context = useContext(WorkoutUserContext);
  if (context === undefined) {
    throw new Error('useWorkoutUser must be used within a WorkoutUserProvider');
  }
  return context;
}
