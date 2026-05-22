'use client';

import React, { createContext, useContext, ReactNode, useMemo } from 'react';
import { signOut, useSession } from 'next-auth/react';
import { User, getUserDisplayName } from '@/types/workout';

// Workout module's idea of "the current user" is now derived directly
// from the Auth.js session. The localStorage picker that used to live
// here was retired in the SSO rollout (PR 4) — there's nothing to set
// from inside the workout app any more.
interface WorkoutUserContextType {
  currentUser: User | null;
  logout: () => void;
  isLoading: boolean;
}

const WorkoutUserContext = createContext<WorkoutUserContextType | undefined>(undefined);

export function WorkoutUserProvider({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();

  const value = useMemo<WorkoutUserContextType>(() => {
    const email = session?.user?.email ?? null;
    const currentUser: User | null = email
      ? { id: email, name: getUserDisplayName(email) }
      : null;
    return {
      currentUser,
      logout: () => signOut({ callbackUrl: '/' }),
      isLoading: status === 'loading',
    };
  }, [session, status]);

  return (
    <WorkoutUserContext.Provider value={value}>
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
