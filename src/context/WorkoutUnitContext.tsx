'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { WeightUnit, isWeightUnit } from '@/types/workout';

interface WorkoutUnitContextType {
  unit: WeightUnit;
  setUnit: (unit: WeightUnit) => void;
}

const WorkoutUnitContext = createContext<WorkoutUnitContextType | undefined>(undefined);

const STORAGE_KEY = 'workout-app-unit';

export function WorkoutUnitProvider({ children }: { children: ReactNode }) {
  const [unit, setUnitState] = useState<WeightUnit>('kg');

  // Hydrate from localStorage on mount. Default is kg — matching the way
  // every stored value is written.
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && isWeightUnit(stored)) {
      setUnitState(stored);
    }
  }, []);

  const setUnit = useCallback((next: WeightUnit) => {
    setUnitState(next);
    localStorage.setItem(STORAGE_KEY, next);
  }, []);

  return (
    <WorkoutUnitContext.Provider value={{ unit, setUnit }}>
      {children}
    </WorkoutUnitContext.Provider>
  );
}

export function useWorkoutUnit() {
  const context = useContext(WorkoutUnitContext);
  if (context === undefined) {
    throw new Error('useWorkoutUnit must be used within a WorkoutUnitProvider');
  }
  return context;
}
