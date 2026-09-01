'use client';

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  ReactNode,
} from 'react';
import { ExerciseLoadPref, WorkoutUserSettings } from '@/types/workout';
import { useWorkoutUser } from './WorkoutUserContext';

// Per-user workout settings shared across the workout screens: the global
// current bodyweight (feature 1) and the per-exercise entry/gear overrides
// (feature 2). The /workout page seeds this from its single /bootstrap
// response; standalone pages (history detail) call ensureLoaded() to fetch
// once on demand. Updates are optimistic and PATCHed to /api/workout/settings.
interface SettingsContextType {
  bodyweightKg: number | null;
  exerciseLoad: Record<string, ExerciseLoadPref>;
  loaded: boolean;
  seed: (settings: WorkoutUserSettings | undefined | null) => void;
  ensureLoaded: () => void;
  // Set (or clear with null) the global bodyweight; returns the request promise
  // so callers can await/rollback if needed.
  setBodyweight: (kg: number | null) => Promise<void>;
  // Set (or clear with null) one exercise's entry/gear override.
  setExerciseLoadPref: (exerciseId: string, pref: ExerciseLoadPref | null) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function WorkoutSettingsProvider({ children }: { children: ReactNode }) {
  const { currentUser } = useWorkoutUser();
  const [bodyweightKg, setBodyweightState] = useState<number | null>(null);
  const [exerciseLoad, setExerciseLoad] = useState<Record<string, ExerciseLoadPref>>({});
  const [loaded, setLoaded] = useState(false);
  const loadedRef = useRef(false);
  const fetchingRef = useRef(false);

  const applySettings = useCallback((s: WorkoutUserSettings) => {
    setBodyweightState(s.bodyweightKg ?? null);
    setExerciseLoad(s.exerciseLoad ?? {});
    loadedRef.current = true;
    setLoaded(true);
  }, []);

  const seed = useCallback((s: WorkoutUserSettings | undefined | null) => {
    if (s) applySettings(s);
    else {
      loadedRef.current = true;
      setLoaded(true);
    }
  }, [applySettings]);

  const ensureLoaded = useCallback(async () => {
    if (loadedRef.current || fetchingRef.current || !currentUser) return;
    fetchingRef.current = true;
    try {
      const res = await fetch('/api/workout/settings');
      if (res.ok) applySettings(await res.json());
    } catch (error) {
      console.error('Error loading workout settings:', error);
    } finally {
      fetchingRef.current = false;
    }
  }, [currentUser, applySettings]);

  const setBodyweight = useCallback(async (kg: number | null) => {
    const prev = bodyweightKg;
    setBodyweightState(kg); // optimistic
    try {
      const res = await fetch('/api/workout/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bodyweightKg: kg }),
      });
      if (!res.ok) setBodyweightState(prev);
    } catch (error) {
      console.error('Error saving bodyweight:', error);
      setBodyweightState(prev);
    }
  }, [bodyweightKg]);

  const setExerciseLoadPref = useCallback(
    async (exerciseId: string, pref: ExerciseLoadPref | null) => {
      const prev = exerciseLoad;
      setExerciseLoad((cur) => {
        const next = { ...cur };
        if (pref) next[exerciseId] = pref;
        else delete next[exerciseId];
        return next;
      });
      try {
        const res = await fetch('/api/workout/settings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ exerciseId, pref }),
        });
        if (!res.ok) setExerciseLoad(prev);
      } catch (error) {
        console.error('Error saving exercise load pref:', error);
        setExerciseLoad(prev);
      }
    },
    [exerciseLoad],
  );

  return (
    <SettingsContext.Provider
      value={{ bodyweightKg, exerciseLoad, loaded, seed, ensureLoaded, setBodyweight, setExerciseLoadPref }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useWorkoutSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) {
    throw new Error('useWorkoutSettings must be used within a WorkoutSettingsProvider');
  }
  return ctx;
}
