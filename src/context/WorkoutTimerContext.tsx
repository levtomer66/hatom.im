'use client';

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  ReactNode,
} from 'react';

interface TimerState {
  startedAt: number | null;   // epoch ms; null = idle
  durationSec: number;        // target countdown length
  label: string | null;       // shown in the bar
  justFinishedAt: number | null;  // epoch ms when last completion fired; bar lingers ~3s
}

interface TimerPrefs {
  defaultRestSec: number;
  sound: boolean;
}

interface WorkoutTimerContextType {
  state: TimerState;
  prefs: TimerPrefs;
  remainingSec: number;
  isRunning: boolean;
  start: (durationSec: number, label?: string | null) => void;
  add: (deltaSec: number) => void;
  skip: () => void;
  setDefaultRestSec: (n: number) => void;
  setSound: (on: boolean) => void;
}

const WorkoutTimerContext = createContext<WorkoutTimerContextType | undefined>(undefined);

const STATE_KEY = 'workout-timer-state';
const PREFS_KEY = 'workout-timer-prefs';
const COMPLETION_LINGER_MS = 3000;

const DEFAULT_PREFS: TimerPrefs = { defaultRestSec: 90, sound: true };
const IDLE: TimerState = { startedAt: null, durationSec: 0, label: null, justFinishedAt: null };

function loadPrefs(): TimerPrefs {
  if (typeof window === 'undefined') return DEFAULT_PREFS;
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return DEFAULT_PREFS;
    const parsed = JSON.parse(raw) as Partial<TimerPrefs>;
    return {
      defaultRestSec:
        typeof parsed.defaultRestSec === 'number' && parsed.defaultRestSec > 0
          ? parsed.defaultRestSec
          : DEFAULT_PREFS.defaultRestSec,
      sound: typeof parsed.sound === 'boolean' ? parsed.sound : DEFAULT_PREFS.sound,
    };
  } catch {
    return DEFAULT_PREFS;
  }
}

function loadState(): TimerState {
  if (typeof window === 'undefined') return IDLE;
  try {
    const raw = localStorage.getItem(STATE_KEY);
    if (!raw) return IDLE;
    const parsed = JSON.parse(raw) as Partial<TimerState>;
    if (typeof parsed.startedAt !== 'number' || typeof parsed.durationSec !== 'number') {
      return IDLE;
    }
    // If the persisted countdown has already elapsed past its grace window,
    // drop it — we don't want to silently fire a beep on next page load.
    const elapsed = (Date.now() - parsed.startedAt) / 1000;
    if (elapsed > parsed.durationSec + COMPLETION_LINGER_MS / 1000) return IDLE;
    return {
      startedAt: parsed.startedAt,
      durationSec: parsed.durationSec,
      label: parsed.label ?? null,
      justFinishedAt: null,
    };
  } catch {
    return IDLE;
  }
}

function persistState(s: TimerState) {
  if (typeof window === 'undefined') return;
  if (s.startedAt === null) {
    localStorage.removeItem(STATE_KEY);
    return;
  }
  localStorage.setItem(
    STATE_KEY,
    JSON.stringify({ startedAt: s.startedAt, durationSec: s.durationSec, label: s.label })
  );
}

function persistPrefs(p: TimerPrefs) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(PREFS_KEY, JSON.stringify(p));
}

// Web Audio short beep. AudioContext can only be created after a user
// interaction (autoplay policies) — start() is always called from a click,
// so we lazy-init on first beep.
let audioCtx: AudioContext | null = null;
function beep() {
  try {
    if (typeof window === 'undefined') return;
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    if (!audioCtx) audioCtx = new Ctx();
    const ctx = audioCtx;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + 0.01);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.45);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch {
    /* swallow — non-critical */
  }
}

function vibrate() {
  try {
    if (typeof navigator === 'undefined') return;
    navigator.vibrate?.([120, 80, 120]);
  } catch {
    /* swallow */
  }
}

export function WorkoutTimerProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TimerState>(IDLE);
  const [prefs, setPrefs] = useState<TimerPrefs>(DEFAULT_PREFS);
  const [now, setNow] = useState<number>(() => Date.now());
  const completedRef = useRef<number | null>(null);

  // Hydrate from localStorage post-mount (SSR-safe).
  useEffect(() => {
    setPrefs(loadPrefs());
    setState(loadState());
  }, []);

  // 1Hz tick while running, including the post-finish linger so the bar can
  // animate out gracefully.
  useEffect(() => {
    if (state.startedAt === null && state.justFinishedAt === null) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [state.startedAt, state.justFinishedAt]);

  // Compute remainingSec from authoritative `startedAt + durationSec`.
  const elapsedMs = state.startedAt !== null ? now - state.startedAt : 0;
  const remainingSec =
    state.startedAt !== null
      ? Math.max(0, Math.ceil(state.durationSec - elapsedMs / 1000))
      : 0;
  const isRunning = state.startedAt !== null && remainingSec > 0;

  // Fire completion side-effects once when remaining hits 0.
  useEffect(() => {
    if (state.startedAt === null) return;
    if (remainingSec > 0) return;
    if (completedRef.current === state.startedAt) return; // already fired for this session
    completedRef.current = state.startedAt;
    if (prefs.sound) beep();
    vibrate();
    setState(prev => ({
      startedAt: null,
      durationSec: prev.durationSec,
      label: prev.label,
      justFinishedAt: Date.now(),
    }));
  }, [state.startedAt, remainingSec, prefs.sound]);

  // Linger expiry — drop the "Rest done!" badge after COMPLETION_LINGER_MS.
  useEffect(() => {
    if (state.justFinishedAt === null) return;
    const t = setTimeout(() => {
      setState(prev =>
        prev.justFinishedAt === state.justFinishedAt
          ? { ...prev, justFinishedAt: null, label: null }
          : prev
      );
    }, COMPLETION_LINGER_MS);
    return () => clearTimeout(t);
  }, [state.justFinishedAt]);

  // Persist state changes.
  useEffect(() => {
    persistState(state);
  }, [state]);

  const start = useCallback((durationSec: number, label: string | null = null) => {
    if (durationSec <= 0) return;
    completedRef.current = null;
    setState({ startedAt: Date.now(), durationSec, label, justFinishedAt: null });
    setNow(Date.now());
  }, []);

  const add = useCallback((deltaSec: number) => {
    setState(prev => {
      if (prev.startedAt === null) return prev;
      const newDuration = Math.max(1, prev.durationSec + deltaSec);
      return { ...prev, durationSec: newDuration };
    });
  }, []);

  const skip = useCallback(() => {
    completedRef.current = null;
    setState({ startedAt: null, durationSec: 0, label: null, justFinishedAt: null });
  }, []);

  const setDefaultRestSec = useCallback((n: number) => {
    const clamped = Math.max(15, Math.min(600, Math.round(n)));
    setPrefs(prev => {
      const next = { ...prev, defaultRestSec: clamped };
      persistPrefs(next);
      return next;
    });
  }, []);

  const setSound = useCallback((on: boolean) => {
    setPrefs(prev => {
      const next = { ...prev, sound: on };
      persistPrefs(next);
      return next;
    });
  }, []);

  return (
    <WorkoutTimerContext.Provider
      value={{ state, prefs, remainingSec, isRunning, start, add, skip, setDefaultRestSec, setSound }}
    >
      {children}
    </WorkoutTimerContext.Provider>
  );
}

export function useWorkoutTimer() {
  const ctx = useContext(WorkoutTimerContext);
  if (ctx === undefined) {
    throw new Error('useWorkoutTimer must be used within a WorkoutTimerProvider');
  }
  return ctx;
}
