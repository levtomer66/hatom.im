'use client';

// PROTOTYPE — the gym the user is training at, kept per device in
// localStorage. The real version stores it on the workout document.

import { useCallback, useSyncExternalStore } from 'react';
import { GYMS } from '@/data/gym-machines';

const KEY = 'workout.gymId';
const EVENT = 'workout-gym-change';

function read(): string {
  try {
    const v = window.localStorage.getItem(KEY);
    if (v && GYMS.some((g) => g.id === v)) return v;
  } catch {
    /* storage blocked — fall through */
  }
  return GYMS[0].id;
}

function subscribe(cb: () => void): () => void {
  window.addEventListener(EVENT, cb);
  window.addEventListener('storage', cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener('storage', cb);
  };
}

export function useCurrentGym(): [string, (id: string) => void] {
  const gymId = useSyncExternalStore(subscribe, read, () => GYMS[0].id);
  const setGym = useCallback((id: string) => {
    try {
      window.localStorage.setItem(KEY, id);
    } catch {
      /* ignore */
    }
    window.dispatchEvent(new Event(EVENT));
  }, []);
  return [gymId, setGym];
}
