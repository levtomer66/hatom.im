'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  DndContext,
  DragEndEvent,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useWorkoutUser } from '@/context/WorkoutUserContext';
import { useWorkoutLanguage } from '@/context/WorkoutLanguageContext';
import { useWorkoutUnit } from '@/context/WorkoutUnitContext';
import { useT, formatDate, getLocalizedTemplateName } from '@/lib/workout-i18n';
import Header from '@/components/workout/Header';
import BottomNav from '@/components/workout/BottomNav';
import SortableExerciseCard from '@/components/workout/SortableExerciseCard';
import ExercisePicker from '@/components/workout/ExercisePicker';
import TemplateSelector from '@/components/workout/TemplateSelector';
import TemplateEditor from '@/components/workout/TemplateEditor';
import {
  Workout,
  WorkoutSummary,
  WorkoutExercise,
  WorkoutSet,
  WorkoutTemplate,
  PersonalBest,
  ExerciseDefinition,
  createDefaultSets,
  isTimeSet,
  DEFAULT_NUM_SETS,
} from '@/types/workout';
import { EXERCISE_LIBRARY } from '@/data/exercise-library';
import { v4 as uuidv4 } from 'uuid';

export default function WorkoutsPage() {
  const router = useRouter();
  const { currentUser, isLoading } = useWorkoutUser();
  const { language } = useWorkoutLanguage();
  const { data: session } = useSession();
  const isOwner = session?.user?.isOwner === true;
  const t = useT();

  // No session → bounce to /login. PR 4 retired the in-app user picker.
  useEffect(() => {
    if (!isLoading && !currentUser) {
      router.replace('/login?from=/workout');
    }
  }, [isLoading, currentUser, router]);
  
  // State
  const [activeWorkout, setActiveWorkout] = useState<Workout | null>(null);
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [sharedTemplates, setSharedTemplates] = useState<WorkoutTemplate[]>([]);
  // Owner-only: { templateId → count } for shared templates. Empty for
  // non-owners. Populated alongside template fetch.
  const [templateUsage, setTemplateUsage] = useState<Record<string, number>>({});
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<WorkoutTemplate | null>(null);
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  // Summary modal shown after a successful Complete. Holds the workout
  // snapshot so the modal can summarize sets/volume even after we've
  // cleared activeWorkout from state.
  const [completedSummary, setCompletedSummary] = useState<Workout | null>(null);
  // Bumped any time activeWorkout changes via the editor — distinct from
  // the workout-id changing — so the autosave effect can debounce on
  // real edits without firing for purely cosmetic state updates (modal
  // open/close, etc.).
  const [editTick, setEditTick] = useState(0);
  // Index of the exercise the user tapped "replace" on. null = no replace flow
  // active. Held at page level (not card level) so the picker modal lives at
  // the page root and doesn't unmount with the card when it collapses.
  const [replaceExerciseIndex, setReplaceExerciseIndex] = useState<number | null>(null);
  const [personalBests, setPersonalBests] = useState<Record<string, PersonalBest>>({});
  const [customExercises, setCustomExercises] = useState<ExerciseDefinition[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [hasInProgressWorkout, setHasInProgressWorkout] = useState(false);

  // Create exercise lookup map
  const exerciseMap = useMemo(() => {
    const map: Record<string, ExerciseDefinition> = {};
    EXERCISE_LIBRARY.forEach(e => { map[e.id] = e; });
    customExercises.forEach(e => { map[e.id] = e; });
    return map;
  }, [customExercises]);

  // Fetch personal bests
  const fetchPersonalBests = useCallback(async () => {
    if (!currentUser) return;
    
    try {
      const res = await fetch(`/api/workout/exercises/pb?userId=${currentUser.id}`);
      if (res.ok) {
        const data = await res.json();
        setPersonalBests(data);
      }
    } catch (error) {
      console.error('Error fetching PBs:', error);
    }
  }, [currentUser]);

  // Fetch custom exercises
  const fetchCustomExercises = useCallback(async () => {
    if (!currentUser) return;
    
    try {
      const res = await fetch(`/api/workout/exercises/custom?userId=${currentUser.id}`);
      if (res.ok) {
        const data = await res.json();
        setCustomExercises(data);
      }
    } catch (error) {
      console.error('Error fetching custom exercises:', error);
    }
  }, [currentUser]);

  // Fetch the caller's own templates AND any templates an owner has
  // marked as shared (visible to every signed-in workout user). Owners
  // additionally get a per-template usage count so the selector can
  // surface "X sessions" badges on their own shared templates.
  // All three calls run in parallel — independent endpoints.
  const fetchTemplates = useCallback(async () => {
    if (!currentUser) return;

    try {
      const promises = [
        fetch(`/api/workout/templates?userId=${currentUser.id}`),
        fetch('/api/workout/templates?scope=shared'),
      ];
      if (isOwner) promises.push(fetch('/api/workout/templates/usage'));
      const [mineRes, sharedRes, usageRes] = await Promise.all(promises);
      if (mineRes && mineRes.ok) setTemplates(await mineRes.json());
      if (sharedRes && sharedRes.ok) setSharedTemplates(await sharedRes.json());
      if (usageRes && usageRes.ok) setTemplateUsage(await usageRes.json());
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  }, [currentUser, isOwner]);

  // Owner toggle: flip sharedByOwner on one of MY templates. Optimistic
  // update + revert on server failure. The server silently drops the
  // field for non-owners, so guard at the call site too just in case
  // (the share button isn't rendered for non-owners anyway).
  const handleToggleShare = useCallback(async (template: WorkoutTemplate) => {
    if (!isOwner) return;
    const next = !template.sharedByOwner;
    setTemplates(prev =>
      prev.map(t => (t.id === template.id ? { ...t, sharedByOwner: next } : t)),
    );
    try {
      const res = await fetch(`/api/workout/templates/${template.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sharedByOwner: next }),
      });
      if (!res.ok) throw new Error('share toggle failed');
      // Refetch shared list so the "Workouts by Tomer" tab matches reality.
      const sharedRes = await fetch('/api/workout/templates?scope=shared');
      if (sharedRes.ok) setSharedTemplates(await sharedRes.json());
    } catch (err) {
      console.error(err);
      setTemplates(prev =>
        prev.map(t => (t.id === template.id ? { ...t, sharedByOwner: !next } : t)),
      );
    }
  }, [isOwner]);

  // Auto-resume: Check for in-progress workout and automatically resume it
  const checkAndResumeWorkout = useCallback(async () => {
    if (!currentUser) {
      setInitialLoadDone(true);
      return;
    }
    
    try {
      // First check if there's a specific workout to resume (from History tab)
      const resumeWorkoutId = sessionStorage.getItem('resumeWorkoutId');
      if (resumeWorkoutId) {
        sessionStorage.removeItem('resumeWorkoutId');
        
        const res = await fetch(`/api/workout/workouts/${resumeWorkoutId}`);
        if (res.ok) {
          const workout = await res.json();
          // Resume if it belongs to current user (can resume both completed and in-progress)
          if (workout.userId === currentUser.id) {
            // If resuming a completed workout, mark it as not completed
            if (workout.isCompleted) {
              workout.isCompleted = false;
            }
            setActiveWorkout(workout);
            setHasInProgressWorkout(true);
            setInitialLoadDone(true);
            return;
          }
        }
      }
      
      // Otherwise, check for any in-progress workout and auto-resume.
      // The list endpoint now returns lightweight summaries (no
      // `exercises`), so once we find the in-progress summary we fetch
      // its full document by id before resuming.
      const res = await fetch(`/api/workout/workouts?userId=${currentUser.id}`);
      if (res.ok) {
        const summaries: WorkoutSummary[] = await res.json();
        const inProgress = summaries.find((w) => !w.isCompleted);

        if (inProgress) {
          const fullRes = await fetch(`/api/workout/workouts/${inProgress.id}`);
          if (fullRes.ok) {
            const full: Workout = await fullRes.json();
            setActiveWorkout(full);
            setHasInProgressWorkout(true);
          } else {
            setHasInProgressWorkout(false);
          }
        } else {
          setHasInProgressWorkout(false);
        }
      }
    } catch (error) {
      console.error('Error checking workouts:', error);
    }
    
    setInitialLoadDone(true);
  }, [currentUser]);

  // Wait for user context to finish loading before checking resume
  useEffect(() => {
    if (isLoading) return; // Wait for user context
    
    fetchPersonalBests();
    fetchCustomExercises();
    fetchTemplates();
    checkAndResumeWorkout();
  }, [isLoading, fetchPersonalBests, fetchCustomExercises, fetchTemplates, checkAndResumeWorkout]);

  // Auto-save workout changes
  const saveWorkout = useCallback(async (workout: Workout) => {
    if (!workout.id) return;

    setIsSaving(true);
    try {
      await fetch(`/api/workout/workouts/${workout.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(workout),
      });
    } catch (error) {
      console.error('Error saving workout:', error);
    } finally {
      setIsSaving(false);
    }
  }, []);

  // Debounced save — fires 900 ms after the last edit. Bumped from 500 ms
  // to coalesce bursty input (typing a number is multiple state updates)
  // and to play nicer with the PWA offline-queue: fewer queued PUTs to
  // drain when the user reconnects.
  useEffect(() => {
    if (!activeWorkout || editTick === 0) return;
    const snapshot = activeWorkout;
    const timeoutId = setTimeout(() => {
      saveWorkout(snapshot);
    }, 900);
    return () => clearTimeout(timeoutId);
  }, [activeWorkout, editTick, saveWorkout]);

  // Wrapper for setActiveWorkout that also bumps the edit counter so the
  // autosave effect actually fires. Use this for ANY user-driven edit
  // (set value changes, sets +/-, exercise add/remove, reorder, etc.).
  // Programmatic state updates that shouldn't autosave (initial fetch,
  // Complete handler, etc.) use setActiveWorkout directly.
  const editActiveWorkout = useCallback((updater: Workout | ((prev: Workout) => Workout)) => {
    setActiveWorkout((prev) => {
      if (!prev) return prev;
      const next = typeof updater === 'function' ? updater(prev) : updater;
      return next;
    });
    setEditTick((n) => n + 1);
  }, []);

  // Start new workout from template — carry per-exercise defaults
  // (numSets, notes) AND prefill each set's KG from the user's most
  // recent occurrence (per PB endpoint's `lastSets`). REPS are NOT
  // prefilled — those represent what you actually did *this* session,
  // so they belong to the user, not history. Prior reps surface as
  // placeholder text on each input instead, giving a clear target
  // without faking data.
  //
  // For time-mode prior sets (planks, hangs), we still copy the kg
  // (often 0 for bodyweight) and set seconds=0 so the discriminator
  // keeps the row in time mode; the stopwatch then starts at 0.
  const startWorkoutFromTemplate = async (template: WorkoutTemplate) => {
    if (!currentUser) return;

    try {
      const templateExercises = template.exercises ?? [];
      const exercises: WorkoutExercise[] = templateExercises.map((te, index) => {
        const prior = personalBests[te.exerciseId]?.lastSets;
        const numSets = te.numSets;
        let sets: WorkoutSet[];
        if (prior && prior.length > 0) {
          // Fill the first min(numSets, prior.length) from history, pad
          // any extra slots with blanks so the template's numSets wins.
          sets = Array.from({ length: numSets }, (_, i) => {
            const p = prior[Math.min(i, prior.length - 1)];
            if (!p) return { kg: null, reps: null, seconds: null };
            const wasTime = p.seconds != null;
            return {
              kg: p.kg ?? null,
              reps: null,                          // leave for the user — prior reps render as placeholder
              seconds: wasTime ? 0 : null,         // preserve time-mode discriminator
            };
          });
        } else {
          sets = createDefaultSets(numSets);
        }
        return {
          id: uuidv4(),
          exerciseId: te.exerciseId,
          order: index + 1,  // 1-based order matches array position
          sets,
          notes: te.notes ?? '',
          photos: [],
        };
      });

      const res = await fetch('/api/workout/workouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          templateId: template.id,
          workoutName: template.name,
          date: new Date().toISOString().split('T')[0],
          // Idempotency: a client-minted UUID so a PWA offline-queue
          // replay of this same POST collapses to the same workout
          // server-side instead of creating a duplicate.
          clientRequestId: uuidv4(),
        }),
      });
      
      if (res.ok) {
        const workout = await res.json();
        // Add the exercises from the template
        workout.exercises = exercises;
        setActiveWorkout(workout);
        // Bump editTick so the autosave effect fires once and persists
        // the template-loaded exercises onto the freshly-created workout
        // document. Without this the POST creates an empty workout and
        // the exercises only live in client state — reloading or
        // navigating away loses them.
        setEditTick((n) => n + 1);
        setHasInProgressWorkout(true);
        setShowTemplateSelector(false);
      }
    } catch (error) {
      console.error('Error starting workout:', error);
    }
  };

  // Handle template save (create or update)
  const handleTemplateSave = (template: WorkoutTemplate) => {
    setTemplates(prev => {
      const existing = prev.findIndex(t => t.id === template.id);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = template;
        return updated;
      }
      return [template, ...prev];
    });
  };

  // Handle template delete
  const handleTemplateDelete = async (template: WorkoutTemplate) => {
    try {
      const res = await fetch(`/api/workout/templates/${template.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setTemplates(prev => prev.filter(t => t.id !== template.id));
      }
    } catch (error) {
      console.error('Error deleting template:', error);
    }
  };

  // Complete workout (end it) — renumber order so stored data has no gaps.
  // Confirms first because finalizing is irreversible from the active
  // view (you can't accidentally re-mark a completed workout incomplete
  // anymore — that's gated behind a Resume tap on a clearly-labeled
  // completed entry in History).
  const completeWorkout = async () => {
    if (!activeWorkout) return;
    if (!confirm(t('workout.complete_confirm'))) return;

    const exercises = activeWorkout.exercises.map((ex, i) => ({ ...ex, order: i + 1 }));
    const updated = { ...activeWorkout, exercises, isCompleted: true };
    await saveWorkout(updated);
    setCompletedSummary(updated);  // Show summary modal (Imp 1)
    setActiveWorkout(null);
    setHasInProgressWorkout(false);
    fetchPersonalBests(); // Refresh PBs after completing workout
  };

  // Back arrow from active workout view — clears local active state so
  // the page falls back to the "Ready to train?" prompt. The workout
  // itself stays in DB as in-progress, recoverable via History → Resume.
  // No data is lost; we just exit the editor.
  const exitActiveWorkout = () => {
    setActiveWorkout(null);
  };

  // Add exercises
  const addExercises = (exerciseDefs: ExerciseDefinition[]) => {
    if (!activeWorkout) return;

    // Start order from current exercise count + 1
    const startOrder = activeWorkout.exercises.length + 1;

    const newExercises: WorkoutExercise[] = exerciseDefs.map((def, index) => {
      const prior = personalBests[def.id]?.lastSets;
      // Same KG-only prefill rule as startWorkoutFromTemplate above —
      // history hints today's weight, reps stay user-owned (placeholder).
      //
      // Mid-workout adds always start with the default set count
      // (DEFAULT_NUM_SETS = 3). If history has fewer than 3 sets, repeat
      // the last prior entry into the remaining slots instead of
      // truncating — same shape rule the template start path uses, so
      // the user gets consistent slot counts regardless of how an
      // exercise lands in the workout. (Codex P2)
      const sets: WorkoutSet[] = prior && prior.length > 0
        ? Array.from({ length: DEFAULT_NUM_SETS }, (_, i) => {
            const p = prior[Math.min(i, prior.length - 1)];
            const wasTime = p.seconds != null;
            return { kg: p.kg ?? null, reps: null, seconds: wasTime ? 0 : null };
          })
        : createDefaultSets();
      return {
        id: uuidv4(),
        exerciseId: def.id,
        order: startOrder + index,  // Continues from current order
        sets,
        notes: '',
        photos: [],
      };
    });

    editActiveWorkout((prev) => ({
      ...prev,
      exercises: [...prev.exercises, ...newExercises],
    }));
  };

  // Update exercise
  const updateExercise = (index: number, exercise: WorkoutExercise) => {
    editActiveWorkout((prev) => {
      const exercises = [...prev.exercises];
      exercises[index] = exercise;
      return { ...prev, exercises };
    });
  };

  // Replace exercise in the active workout. Preserves sets (with their
  // logged kg/reps), notes, photos, and order — only the exerciseId
  // changes. The previous exerciseId is stored on replacedFromExerciseId
  // so history views can surface "swapped from X". If the user keeps
  // swapping, we preserve the ORIGINAL replacedFrom (the actual starting
  // exercise), not the intermediate hop. If the user swaps back to that
  // original, clear the marker entirely — otherwise history would render
  // "X swapped from X".
  const replaceExerciseAt = (index: number, newExerciseDef: ExerciseDefinition) => {
    if (!activeWorkout) return;
    const current = activeWorkout.exercises[index];
    if (!current) return;
    if (current.exerciseId === newExerciseDef.id) return;

    const originalReplacedFrom = current.replacedFromExerciseId ?? current.exerciseId;
    const isRevert = newExerciseDef.id === originalReplacedFrom;
    editActiveWorkout((prev) => {
      const exercises = [...prev.exercises];
      exercises[index] = {
        ...current,
        exerciseId: newExerciseDef.id,
        replacedFromExerciseId: isRevert ? null : originalReplacedFrom,
      };
      return { ...prev, exercises };
    });
  };

  // Remove exercise — renumber remaining so order stays 1..N. Confirm is
  // handled inside ExerciseCard before this is called.
  const removeExercise = (index: number) => {
    editActiveWorkout((prev) => ({
      ...prev,
      exercises: prev.exercises
        .filter((_, i) => i !== index)
        .map((ex, i) => ({ ...ex, order: i + 1 })),
    }));
  };

  // Reorder exercise (via drag-and-drop) — renumber order to match new array position
  const moveExercise = (fromId: string, toId: string) => {
    if (!activeWorkout || fromId === toId) return;
    const from = activeWorkout.exercises.findIndex(e => e.id === fromId);
    const to = activeWorkout.exercises.findIndex(e => e.id === toId);
    if (from < 0 || to < 0) return;
    editActiveWorkout((prev) => ({
      ...prev,
      exercises: arrayMove(prev.exercises, from, to)
        .map((ex, i) => ({ ...ex, order: i + 1 })),
    }));
  };

  // dnd-kit sensors for the active-workout exercise list
  const dragSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    moveExercise(String(active.id), String(over.id));
  };

  // Progress: how many exercises have at least one set with usable data?
  // Used by both the loading-screen header presence and the in-workout
  // progress bar so the user can see "3/8 done" at a glance.
  const progress = useMemo(() => {
    if (!activeWorkout) return { done: 0, total: 0 };
    const done = activeWorkout.exercises.filter((ex) =>
      ex.sets.some((s) =>
        (s.kg !== null && s.reps !== null && s.reps > 0) ||
        (isTimeSet(s) && (s.seconds ?? 0) > 0),
      ),
    ).length;
    return { done, total: activeWorkout.exercises.length };
  }, [activeWorkout]);

  // Loading state — render the shell (BottomNav stays) so the page doesn't
  // collapse to a blank screen during fetches. The header is suppressed
  // because we don't know the eventual title yet.
  if (isLoading || !initialLoadDone) {
    return (
      <main className="workout-main">
        <Header title={t('workout.title')} />
        <div className="workout-page">
          <div className="loading-spinner" />
        </div>
        <BottomNav />
      </main>
    );
  }

  // Not signed in → useEffect above is mid-redirect; render the shell.
  if (!currentUser) {
    return (
      <main className="workout-main">
        <Header title={t('workout.title')} />
        <div className="workout-page">
          <div className="loading-spinner" />
        </div>
        <BottomNav />
      </main>
    );
  }

  return (
    <main className="workout-main">
      <Header
        title={activeWorkout ? `🏋️ ${getLocalizedTemplateName(activeWorkout.workoutName, language)}` : t('workout.title')}
        showBack={!!activeWorkout}
        onBack={exitActiveWorkout}
      />

      <div className="workout-page">
        {!activeWorkout ? (
          // No active workout - show start button
          <div style={{ textAlign: 'center', paddingTop: '40px' }}>
            <div style={{ fontSize: '64px', marginBottom: '24px' }}>🏋️</div>
            <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>
              {t('workout.ready_title')}
            </h2>
            <p style={{ color: 'var(--workout-text-secondary)', marginBottom: '32px' }}>
              {hasInProgressWorkout
                ? t('workout.hint_in_progress')
                : templates.length > 0
                  ? t('workout.hint_select')
                  : t('workout.hint_first')}
            </p>
            <button
              className="workout-btn workout-btn-primary workout-btn-large"
              onClick={() => setShowTemplateSelector(true)}
            >
              {templates.length > 0 ? t('workout.start_button') : t('workout.create_button')}
            </button>
            <p style={{
              color: 'var(--workout-text-muted)',
              marginTop: '24px',
              fontSize: '14px',
            }}>
              {t('workout.resume_tip')}
            </p>
          </div>
        ) : (
          // Active workout
          <>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '8px',
              padding: '12px 16px',
              backgroundColor: 'var(--workout-bg-card)',
              borderRadius: '12px',
            }}>
              <div>
                <div style={{ fontSize: '14px', color: 'var(--workout-text-secondary)' }}>
                  {formatDate(activeWorkout.date, language, {
                    weekday: 'long',
                    month: 'short',
                    day: 'numeric',
                  })}
                </div>
                <div
                  style={{
                    fontSize: '12px',
                    color: isSaving ? 'var(--workout-gold)' : 'var(--workout-green)',
                    marginTop: '4px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                  aria-live="polite"
                >
                  {/* Subtle cloud icon distinguishes "saved to server" from
                      the gold ✓ which often signals "logged set" elsewhere. */}
                  <span aria-hidden="true">{isSaving ? '☁︎' : '☁︎ ✓'}</span>
                  {isSaving ? t('workout.saving') : t('workout.saved')}
                </div>
              </div>
              <button
                className="workout-btn workout-btn-primary"
                onClick={completeWorkout}
                style={{ padding: '10px 20px', fontSize: '14px', fontWeight: 600 }}
              >
                {t('workout.complete_button')}
              </button>
            </div>

            {/* Progress bar — exercises with at least one logged set out of
                the total. Updates live as the user fills sets. */}
            {progress.total > 0 && (
              <div
                style={{ marginBottom: '16px', padding: '0 4px' }}
                role="progressbar"
                aria-valuenow={progress.done}
                aria-valuemin={0}
                aria-valuemax={progress.total}
                aria-label={t('workout.progress_label')}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '12px',
                    color: 'var(--workout-text-muted)',
                    marginBottom: '6px',
                  }}
                >
                  <span>{t('workout.progress_label')}</span>
                  <span>
                    {progress.done} / {progress.total}
                  </span>
                </div>
                <div
                  style={{
                    height: '6px',
                    borderRadius: '999px',
                    background: 'var(--workout-bg-secondary)',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${progress.total > 0 ? (progress.done / progress.total) * 100 : 0}%`,
                      height: '100%',
                      background: 'var(--workout-green)',
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
              </div>
            )}

            {/* Exercise cards (drag-sortable) */}
            {activeWorkout.exercises.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📋</div>
                <div className="empty-state-text">
                  {t('workout.no_exercises')}
                </div>
              </div>
            ) : (
              <DndContext
                sensors={dragSensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={activeWorkout.exercises.map(e => e.id)}
                  strategy={verticalListSortingStrategy}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {activeWorkout.exercises.map((exercise, index) => (
                      <SortableExerciseCard
                        key={exercise.id}
                        id={exercise.id}
                        exercise={exercise}
                        exerciseDefinition={exerciseMap[exercise.exerciseId] || null}
                        pb={personalBests[exercise.exerciseId] || null}
                        onUpdate={(updated) => updateExercise(index, updated)}
                        onRemove={() => removeExercise(index)}
                        onReplace={() => setReplaceExerciseIndex(index)}
                        exerciseMap={exerciseMap}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
            )}

            {/* Add exercise button */}
            <button
              className="workout-btn workout-btn-secondary workout-btn-full"
              onClick={() => setShowExercisePicker(true)}
              style={{ marginTop: '16px' }}
            >
              {t('workout.add_exercise')}
            </button>
          </>
        )}
      </div>

      <BottomNav />

      {/* Modals */}
      <TemplateSelector
        isOpen={showTemplateSelector}
        templates={templates}
        sharedTemplates={sharedTemplates}
        templateUsage={templateUsage}
        exerciseMap={exerciseMap}
        isOwner={isOwner}
        onClose={() => setShowTemplateSelector(false)}
        onSelect={(template) => {
          startWorkoutFromTemplate(template);
        }}
        onEdit={(template) => {
          setEditingTemplate(template);
          setShowTemplateSelector(false);
          setShowTemplateEditor(true);
        }}
        onDelete={handleTemplateDelete}
        onCreateNew={() => {
          setEditingTemplate(null);
          setShowTemplateSelector(false);
          setShowTemplateEditor(true);
        }}
        onToggleShare={handleToggleShare}
      />

      <TemplateEditor
        isOpen={showTemplateEditor}
        template={editingTemplate}
        onClose={() => {
          // Close editor → return to the selector (the modal we came
          // from), not to the bare /workout page. Fixes B7.
          setShowTemplateEditor(false);
          setEditingTemplate(null);
          setShowTemplateSelector(true);
        }}
        onSave={(template) => {
          handleTemplateSave(template);
          setShowTemplateEditor(false);
          setEditingTemplate(null);
          setShowTemplateSelector(true);
        }}
      />

      {activeWorkout && (
        <ExercisePicker
          isOpen={showExercisePicker}
          onClose={() => setShowExercisePicker(false)}
          onSelect={addExercises}
          excludeIds={activeWorkout.exercises.map(e => e.exerciseId)}
        />
      )}

      {activeWorkout && replaceExerciseIndex !== null && (
        <ExercisePicker
          isOpen={true}
          onClose={() => setReplaceExerciseIndex(null)}
          replaceMode
          onSelect={(exercises) => {
            // replaceMode always commits with exactly one exercise.
            if (exercises[0]) replaceExerciseAt(replaceExerciseIndex, exercises[0]);
            setReplaceExerciseIndex(null);
          }}
          // Exclude every exercise already in the workout so the user can't
          // pick a duplicate. The current slot is implicitly excluded too —
          // it's already in that list.
          excludeIds={activeWorkout.exercises.map(e => e.exerciseId)}
        />
      )}

      {/* Completion summary — appears once after a successful Complete.
          Shows what the user just achieved (sets logged, exercises done,
          volume) so the irreversible action has tangible feedback. */}
      {completedSummary && (
        <CompletionSummary
          workout={completedSummary}
          onClose={() => setCompletedSummary(null)}
        />
      )}
    </main>
  );
}

// Summary card shown after Complete — counts logged sets, completed
// exercises, and total volume (kg). Kept inline because it's owned by
// this page's life cycle and never reused elsewhere.
function CompletionSummary({ workout, onClose }: { workout: Workout; onClose: () => void }) {
  const t = useT();
  const { language } = useWorkoutLanguage();
  const { unit } = useWorkoutUnit();

  const stats = useMemo(() => {
    let setsLogged = 0;
    let exercisesDone = 0;
    let totalVolumeKg = 0;
    for (const ex of workout.exercises) {
      let anySet = false;
      for (const s of ex.sets) {
        if (s.kg !== null && s.reps !== null && s.reps > 0) {
          setsLogged += 1;
          totalVolumeKg += (s.kg ?? 0) * s.reps;
          anySet = true;
        } else if (isTimeSet(s) && (s.seconds ?? 0) > 0) {
          setsLogged += 1;
          anySet = true;
        }
      }
      if (anySet) exercisesDone += 1;
    }
    return { setsLogged, exercisesDone, totalVolumeKg };
  }, [workout]);

  const volumeDisplay = unit === 'lb'
    ? `${Math.round(stats.totalVolumeKg * 2.20462).toLocaleString()} lb`
    : `${Math.round(stats.totalVolumeKg).toLocaleString()} kg`;

  return (
    <div className="workout-modal-overlay" onClick={onClose}>
      <div
        className="workout-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 420 }}
      >
        <div className="workout-modal-header">
          <h2 className="workout-modal-title">🎉 {t('workout.summary.title')}</h2>
          <button className="workout-modal-close" onClick={onClose} aria-label={t('generic.close')}>
            ✕
          </button>
        </div>
        <div className="workout-modal-body" style={{ textAlign: 'center', padding: '8px 16px 24px' }}>
          <div style={{ fontSize: '14px', color: 'var(--workout-text-secondary)', marginBottom: 24 }}>
            {getLocalizedTemplateName(workout.workoutName, language)} ·{' '}
            {formatDate(workout.date, language, { weekday: 'long', month: 'short', day: 'numeric' })}
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 12,
              marginBottom: 20,
            }}
          >
            <SummaryStat label={t('workout.summary.sets')} value={String(stats.setsLogged)} />
            <SummaryStat
              label={t('workout.summary.exercises')}
              value={`${stats.exercisesDone}/${workout.exercises.length}`}
            />
            <SummaryStat label={t('workout.summary.volume')} value={volumeDisplay} />
          </div>
          <button
            className="workout-btn workout-btn-primary workout-btn-full"
            onClick={onClose}
          >
            {t('workout.summary.cta')}
          </button>
        </div>
      </div>
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        padding: '12px 8px',
        background: 'var(--workout-bg-secondary)',
        borderRadius: 10,
      }}
    >
      <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--workout-accent)' }}>{value}</div>
      <div style={{ fontSize: 11, color: 'var(--workout-text-muted)', marginTop: 4 }}>{label}</div>
    </div>
  );
}
