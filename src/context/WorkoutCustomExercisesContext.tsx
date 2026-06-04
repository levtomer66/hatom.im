'use client';

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  ReactNode,
} from 'react';
import { ExerciseDefinition } from '@/types/workout';
import { useWorkoutUser } from './WorkoutUserContext';

// Shared per-user custom-exercise state. One fetch backs every workout screen
// (picker, exercises list, exercise/history detail, template editor) so a
// custom exercise renders its name/photo everywhere it's referenced, and a
// freshly-created one shows up instantly without a refetch.
//
// The /workout page seeds this from its single /bootstrap response (no extra
// round trip on cold load); standalone pages call ensureLoaded() which fetches
// once on demand (and the workout service worker caches that GET).
interface CustomExercisesContextType {
  customExercises: ExerciseDefinition[];
  loaded: boolean;
  // Seed from an already-fetched list (e.g. the bootstrap payload).
  seed: (list: ExerciseDefinition[] | undefined | null) => void;
  // Fetch once if not already loaded/seeded and a user is signed in.
  ensureLoaded: () => void;
  // Optimistically add a just-created custom so the UI updates immediately.
  addCustomExercise: (exercise: ExerciseDefinition) => void;
  // Flip the `retired` flag on a custom locally (mirrors the PATCH result).
  // Retired customs stay in the list so history still resolves their name;
  // the pickers filter them out themselves.
  setRetired: (exerciseId: string, retired: boolean) => void;
}

const CustomExercisesContext = createContext<CustomExercisesContextType | undefined>(undefined);

export function WorkoutCustomExercisesProvider({ children }: { children: ReactNode }) {
  const { currentUser } = useWorkoutUser();
  const [customExercises, setCustomExercises] = useState<ExerciseDefinition[]>([]);
  const [loaded, setLoaded] = useState(false);
  // Mirror `loaded` into a ref so ensureLoaded's identity depends only on
  // currentUser — not on the load flipping true, which would otherwise churn
  // every consumer's `useEffect([ensureLoaded])`.
  const loadedRef = useRef(false);
  // Guards against overlapping fetches when several screens mount at once.
  const fetchingRef = useRef(false);

  const markLoaded = useCallback(() => {
    loadedRef.current = true;
    setLoaded(true);
  }, []);

  const seed = useCallback((list: ExerciseDefinition[] | undefined | null) => {
    setCustomExercises(Array.isArray(list) ? list : []);
    markLoaded();
  }, [markLoaded]);

  const ensureLoaded = useCallback(async () => {
    if (loadedRef.current || fetchingRef.current || !currentUser) return;
    fetchingRef.current = true;
    try {
      const res = await fetch('/api/workout/exercises/custom');
      if (res.ok) {
        const data = await res.json();
        setCustomExercises(Array.isArray(data) ? data : []);
        markLoaded();
      }
    } catch (error) {
      console.error('Error loading custom exercises:', error);
    } finally {
      fetchingRef.current = false;
    }
  }, [currentUser, markLoaded]);

  const addCustomExercise = useCallback((exercise: ExerciseDefinition) => {
    setCustomExercises((prev) =>
      prev.some((e) => e.id === exercise.id) ? prev : [exercise, ...prev],
    );
    markLoaded();
  }, [markLoaded]);

  const setRetired = useCallback((exerciseId: string, retired: boolean) => {
    setCustomExercises((prev) =>
      prev.map((e) => (e.id === exerciseId ? { ...e, retired } : e)),
    );
  }, []);

  return (
    <CustomExercisesContext.Provider
      value={{ customExercises, loaded, seed, ensureLoaded, addCustomExercise, setRetired }}
    >
      {children}
    </CustomExercisesContext.Provider>
  );
}

export function useCustomExercises() {
  const ctx = useContext(CustomExercisesContext);
  if (!ctx) {
    throw new Error('useCustomExercises must be used within WorkoutCustomExercisesProvider');
  }
  return ctx;
}
