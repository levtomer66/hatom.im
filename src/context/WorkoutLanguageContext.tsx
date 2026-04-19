'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { Language, isLanguage } from '@/types/workout';

interface WorkoutLanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  dir: 'ltr' | 'rtl';
}

const WorkoutLanguageContext = createContext<WorkoutLanguageContextType | undefined>(undefined);

const STORAGE_KEY = 'workout-app-language';

export function WorkoutLanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');

  // Hydrate from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored && isLanguage(stored)) {
      setLanguageState(stored);
    }
  }, []);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem(STORAGE_KEY, lang);
  }, []);

  const dir: 'ltr' | 'rtl' = language === 'he' ? 'rtl' : 'ltr';

  return (
    <WorkoutLanguageContext.Provider value={{ language, setLanguage, dir }}>
      {children}
    </WorkoutLanguageContext.Provider>
  );
}

export function useWorkoutLanguage() {
  const context = useContext(WorkoutLanguageContext);
  if (context === undefined) {
    throw new Error('useWorkoutLanguage must be used within a WorkoutLanguageProvider');
  }
  return context;
}
