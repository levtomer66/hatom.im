'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useWorkoutUser } from '@/context/WorkoutUserContext';
import { useWorkoutLanguage } from '@/context/WorkoutLanguageContext';
import { useCustomExercises } from '@/context/WorkoutCustomExercisesContext';
import { useT, formatDate, exerciseCount, getLocalizedTemplateName } from '@/lib/workout-i18n';
import Header from '@/components/workout/Header';
import BottomNav from '@/components/workout/BottomNav';
import ExerciseCard from '@/components/workout/ExerciseCard';
import { buildSupersetGroups, supersetLabel } from '@/lib/superset';
import { Workout, WorkoutExercise, PersonalBest, ExerciseDefinition } from '@/types/workout';
import { EXERCISE_LIBRARY } from '@/data/exercise-library';

export default function WorkoutDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { currentUser, isLoading } = useWorkoutUser();
  const { language } = useWorkoutLanguage();
  const { customExercises, ensureLoaded } = useCustomExercises();
  const t = useT();

  const workoutId = params?.id as string;

  useEffect(() => {
    if (!isLoading && !currentUser) {
      router.replace(`/login?from=/workout/history/${workoutId}`);
    }
  }, [isLoading, currentUser, router, workoutId]);
  
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [personalBests, setPersonalBests] = useState<Record<string, PersonalBest>>({});
  const [loadingWorkout, setLoadingWorkout] = useState(true);

  // Library + custom lookup map, so a workout row that references a `custom-*`
  // id renders its name/photo. (ExerciseCard still falls back to
  // getExerciseById for legacy/retired-custom aliases when a row isn't here.)
  const exerciseMap = useMemo(() => {
    const map: Record<string, ExerciseDefinition> = {};
    EXERCISE_LIBRARY.forEach(e => { map[e.id] = e; });
    customExercises.forEach(e => { map[e.id] = e; });
    return map;
  }, [customExercises]);

  // Fetch workout
  const fetchWorkout = useCallback(async () => {
    if (!workoutId) return;
    
    setLoadingWorkout(true);
    try {
      const res = await fetch(`/api/workout/workouts/${workoutId}`);
      if (res.ok) {
        const data = await res.json();
        setWorkout(data);
      }
    } catch (error) {
      console.error('Error fetching workout:', error);
    } finally {
      setLoadingWorkout(false);
    }
  }, [workoutId]);

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

  useEffect(() => {
    fetchWorkout();
    fetchPersonalBests();
  }, [fetchWorkout, fetchPersonalBests]);

  // Load custom exercises so a custom id in this workout resolves to a name.
  useEffect(() => {
    ensureLoaded();
  }, [ensureLoaded]);

  // Loading / not-logged-in / workout-loading all share the same shell so
  // the screen never collapses to a bare spinner (B11).
  if (isLoading || !currentUser || loadingWorkout) {
    return (
      <main className="workout-main">
        <Header title={t('workout.title')} showBack onBack={() => router.back()} />
        <div className="workout-page">
          <div className="loading-spinner" />
        </div>
        <BottomNav />
      </main>
    );
  }

  // Workout not found
  if (!workout) {
    return (
      <main className="workout-main">
        <Header title={t('workout.title')} showBack onBack={() => router.back()} />
        <div className="workout-page">
          <div className="empty-state">
            <div className="empty-state-icon">❓</div>
            <div className="empty-state-text">{t('history_detail.not_found')}</div>
          </div>
        </div>
        <BottomNav />
      </main>
    );
  }

  return (
    <main className="workout-main">
      <Header 
        title={`🏋️ ${getLocalizedTemplateName(workout.workoutName, language)}`}
        showBack 
        onBack={() => router.back()} 
      />
      
      <div className="workout-page">
        {/* Workout header */}
        <div 
          style={{
            padding: '16px',
            backgroundColor: 'var(--workout-bg-card)',
            borderRadius: '12px',
            marginBottom: '16px',
          }}
        >
          <div style={{
            fontSize: '16px',
            fontWeight: 600,
            marginBottom: '4px',
          }}>
            {formatDate(workout.date, language, {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </div>
          <div style={{
            fontSize: '14px',
            color: 'var(--workout-text-secondary)',
          }}>
            {exerciseCount(workout.exercises.length, language)}
          </div>
        </div>

        {/* Protocol text + example link, if this workout carried them. */}
        {(workout.description || workout.instagramUrl) && (
          <div className="workout-protocol-banner">
            {workout.description && (
              <div className="workout-protocol-text">{workout.description}</div>
            )}
            {workout.instagramUrl && (
              <a
                href={workout.instagramUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="workout-watch-link"
              >
                ▶ {t('workout.watch_example')}
              </a>
            )}
          </div>
        )}

        {/* Exercise cards (read-only) */}
        {workout.exercises.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <div className="empty-state-text">{t('history_detail.no_exercises')}</div>
          </div>
        ) : (
          buildSupersetGroups(workout.exercises).map((group) => {
            const renderCard = ({ item: exercise }: { item: WorkoutExercise }) => (
              <ExerciseCard
                key={exercise.id}
                exercise={exercise}
                exerciseDefinition={exerciseMap[exercise.exerciseId] || null}
                pb={personalBests[exercise.exerciseId] || null}
                mode="readonly"
                exerciseMap={exerciseMap}
              />
            );
            if (group.items.length < 2) return renderCard(group.items[0]);
            return (
              <div key={`ss-${group.key}`} className="superset-group">
                <div className="superset-group-header">
                  🔗 {t('workout.superset')} {supersetLabel(group.supersetGroup)}
                </div>
                <div className="superset-group-body">{group.items.map(renderCard)}</div>
              </div>
            );
          })
        )}
      </div>

      <BottomNav />
    </main>
  );
}
