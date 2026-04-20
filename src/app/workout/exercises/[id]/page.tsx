'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useWorkoutUser } from '@/context/WorkoutUserContext';
import { useWorkoutLanguage } from '@/context/WorkoutLanguageContext';
import { useT, formatDate, getCategoryLabel, getLocalizedTemplateName } from '@/lib/workout-i18n';
import { getLocalizedExercise } from '@/lib/exercise-translations';
import LoginScreen from '@/components/workout/LoginScreen';
import Header from '@/components/workout/Header';
import BottomNav from '@/components/workout/BottomNav';
import { ExerciseHistoryEntry, PersonalBest, ExerciseDefinition } from '@/types/workout';
import { getExerciseById } from '@/data/exercise-library';

export default function ExerciseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { currentUser, isLoading } = useWorkoutUser();
  const { language } = useWorkoutLanguage();
  const t = useT();
  
  const exerciseId = params?.id as string;
  
  const [exercise, setExercise] = useState<ExerciseDefinition | null>(null);
  const [history, setHistory] = useState<ExerciseHistoryEntry[]>([]);
  const [personalBests, setPersonalBests] = useState<Record<string, PersonalBest>>({});
  const [loadingExercise, setLoadingExercise] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(true);

  // Fetch exercise info (check library first, then custom)
  const fetchExercise = useCallback(async () => {
    if (!exerciseId) return;
    
    // Check static library first
    const libraryExercise = getExerciseById(exerciseId);
    if (libraryExercise) {
      setExercise(libraryExercise);
      setLoadingExercise(false);
      return;
    }
    
    // If not in library, fetch from custom exercises
    if (!currentUser) {
      setLoadingExercise(false);
      return;
    }
    
    try {
      const res = await fetch(`/api/workout/exercises/custom?userId=${currentUser.id}`);
      if (res.ok) {
        const customExercises = await res.json();
        const customExercise = customExercises.find((e: ExerciseDefinition) => e.id === exerciseId);
        if (customExercise) {
          setExercise(customExercise);
        }
      }
    } catch (error) {
      console.error('Error fetching custom exercise:', error);
    } finally {
      setLoadingExercise(false);
    }
  }, [exerciseId, currentUser]);

  // Fetch exercise history
  const fetchHistory = useCallback(async () => {
    if (!currentUser || !exerciseId) return;
    
    setLoadingHistory(true);
    try {
      const res = await fetch(
        `/api/workout/exercises/history?userId=${currentUser.id}&exerciseId=${exerciseId}`
      );
      if (res.ok) {
        const data = await res.json();
        setHistory(data);
      }
    } catch (error) {
      console.error('Error fetching history:', error);
    } finally {
      setLoadingHistory(false);
    }
  }, [currentUser, exerciseId]);

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
    fetchExercise();
    fetchHistory();
    fetchPersonalBests();
  }, [fetchExercise, fetchHistory, fetchPersonalBests]);

  // Loading state
  if (isLoading || loadingExercise) {
    return (
      <main className="workout-main">
        <div className="loading-spinner" />
      </main>
    );
  }

  // Not logged in
  if (!currentUser) {
    return <LoginScreen />;
  }

  // Exercise not found
  if (!exercise) {
    return (
      <main className="workout-main">
        <Header title={t('exercise_detail.fallback_title')} showBack onBack={() => router.back()} />
        <div className="workout-page">
          <div className="empty-state">
            <div className="empty-state-icon">❓</div>
            <div className="empty-state-text">{t('exercise_detail.not_found')}</div>
          </div>
        </div>
        <BottomNav />
      </main>
    );
  }

  const pb = personalBests[exerciseId];
  const localized = getLocalizedExercise(exercise, language);

  return (
    <main className="workout-main">
      <Header title={localized.name} showBack onBack={() => router.back()} />

      <div className="workout-page">
        {/* Exercise header card */}
        <div className="workout-card" style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
            <div
              style={{
                width: '80px',
                height: '80px',
                borderRadius: '12px',
                backgroundColor: 'var(--workout-bg-secondary)',
                backgroundImage: exercise.defaultPhoto
                  ? `url(${exercise.defaultPhoto})`
                  : 'none',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '32px',
                flexShrink: 0,
              }}
            >
              {!exercise.defaultPhoto && '🏋️'}
            </div>
            <div style={{ flex: 1 }}>
              <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '8px' }}>
                {localized.name}
                {exercise.isCustom && (
                  <span style={{
                    fontSize: '12px',
                    color: 'var(--workout-blue)',
                    backgroundColor: 'rgba(59, 130, 246, 0.2)',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    marginInlineStart: '8px',
                    verticalAlign: 'middle',
                  }}>
                    {t('picker.custom_badge')}
                  </span>
                )}
              </h2>
              <div style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '6px',
                marginBottom: '12px',
              }}>
                {exercise.categories.map(cat => (
                  <span
                    key={cat}
                    style={{
                      padding: '4px 8px',
                      backgroundColor: 'var(--workout-bg-secondary)',
                      borderRadius: '4px',
                      fontSize: '12px',
                      color: 'var(--workout-text-secondary)',
                    }}
                  >
                    {getCategoryLabel(cat, language)}
                  </span>
                ))}
              </div>
              {pb && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {pb.completedKg !== null ? (
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 12px',
                        backgroundColor: 'var(--workout-gold-dim)',
                        borderRadius: '8px',
                        border: '1px solid var(--workout-gold)',
                      }}
                    >
                      <span style={{ fontSize: '20px' }}>🥇</span>
                      <span style={{ fontWeight: 700, color: 'var(--workout-gold)' }}>
                        {t('exercise_detail.pb_label')}: {pb.completedKg}{t('card.kg_suffix')} ({pb.completedReps.join('×')})
                      </span>
                    </div>
                  ) : (
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '8px 12px',
                        backgroundColor: 'var(--workout-bg-secondary)',
                        borderRadius: '8px',
                        border: '1px solid var(--workout-border)',
                      }}
                    >
                      <span style={{ fontSize: '20px' }}>💪</span>
                      <span style={{ fontWeight: 700, color: 'var(--workout-text-secondary)' }}>
                        {t('exercise_detail.working_label')}: {pb.currentKg}{t('card.kg_suffix')} ({pb.currentReps.join('×')})
                      </span>
                    </div>
                  )}
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 10px',
                      backgroundColor: 'rgba(251, 191, 36, 0.15)',
                      borderRadius: '6px',
                      fontSize: '14px',
                    }}
                  >
                    <span>💡</span>
                    <span style={{ color: 'var(--workout-accent)' }}>
                      {t('exercise_detail.next_rec_label')}: <strong>{pb.recommendedKg}{t('card.kg_suffix')}</strong>
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* History table */}
        <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '12px' }}>
          {t('exercise_detail.history_title')}
        </h3>

        {loadingHistory ? (
          <div className="loading-spinner" />
        ) : history.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📊</div>
            <div className="empty-state-text">{t('card.history_empty')}</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {history.map((entry, index) => (
              <div
                key={index}
                className={`workout-card ${entry.isPB ? 'workout-card-pb' : ''} ${entry.isCompleted ? 'workout-card-completed' : ''}`}
                style={{ padding: '12px' }}
              >
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: '4px',
                }}>
                  <div style={{ fontWeight: 600 }}>
                    {entry.isPB && <span style={{ marginInlineEnd: '4px' }}>🥇</span>}
                    {formatDate(entry.date, language, {
                      weekday: 'short',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </div>
                  {entry.isCompleted && (
                    <span style={{
                      fontSize: '12px',
                      color: 'var(--workout-green)',
                      fontWeight: 600,
                    }}>
                      {t('card.history_completed')}
                    </span>
                  )}
                </div>
                {(entry.workoutName || entry.order > 0) && (
                  <div style={{
                    fontSize: '12px',
                    color: 'var(--workout-text-muted)',
                    marginBottom: '8px',
                  }}>
                    {entry.workoutName
                      ? getLocalizedTemplateName(entry.workoutName, language)
                      : t('workout.title')}
                    {entry.order > 0 && ` · #${entry.order}`}
                  </div>
                )}
                <div style={{
                  display: 'flex',
                  gap: '8px',
                  flexWrap: 'wrap',
                }}>
                  {entry.sets.map((set, setIndex) => (
                    <div
                      key={setIndex}
                      style={{
                        padding: '6px 10px',
                        backgroundColor: 'var(--workout-bg-secondary)',
                        borderRadius: '6px',
                        fontSize: '13px',
                      }}
                    >
                      <span style={{ color: 'var(--workout-text-secondary)' }}>S{setIndex + 1}: </span>
                      <span style={{ fontWeight: 600 }}>
                        {set.kg ?? '-'}{t('card.kg_suffix')} × {set.reps ?? '-'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <BottomNav />
    </main>
  );
}
