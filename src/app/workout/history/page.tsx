'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useWorkoutUser } from '@/context/WorkoutUserContext';
import { useWorkoutLanguage } from '@/context/WorkoutLanguageContext';
import { useT, formatDate, exerciseCount, getLocalizedTemplateName } from '@/lib/workout-i18n';
import Header from '@/components/workout/Header';
import BottomNav from '@/components/workout/BottomNav';
import { WorkoutSummary } from '@/types/workout';

export default function HistoryPage() {
  const router = useRouter();
  const { currentUser, isLoading } = useWorkoutUser();
  const { language } = useWorkoutLanguage();
  const t = useT();

  useEffect(() => {
    if (!isLoading && !currentUser) {
      router.replace('/login?from=/workout/history');
    }
  }, [isLoading, currentUser, router]);
  
  const PAGE_SIZE = 20;
  // In-progress and completed are tracked separately: in-progress is loaded
  // unpaginated (an active session must always show, even with a deep history),
  // while completed is paginated with "Load more".
  const [inProgressWorkouts, setInProgressWorkouts] = useState<WorkoutSummary[]>([]);
  const [completedWorkouts, setCompletedWorkouts] = useState<WorkoutSummary[]>([]);
  const [loadingWorkouts, setLoadingWorkouts] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // Next page's skip for the COMPLETED list. Tracked in a ref (not derived
  // from length) so deleting a row doesn't shift the paging window.
  const nextSkipRef = useRef(0);
  // Guards against overlapping page loads (e.g. double-tapping "Load more").
  const inFlightRef = useRef(false);

  // Load one page of COMPLETED workouts (most-recent first) and append it.
  // Fetches PAGE_SIZE + 1 to detect "has more" without a trailing empty call.
  const loadCompletedPage = useCallback(async (skip: number) => {
    if (!currentUser || inFlightRef.current) return;
    inFlightRef.current = true;
    const initial = skip === 0;
    if (initial) setLoadingWorkouts(true);
    else setLoadingMore(true);
    try {
      const res = await fetch(`/api/workout/workouts?completed=true&limit=${PAGE_SIZE + 1}&skip=${skip}`);
      if (res.ok) {
        const batch: WorkoutSummary[] = await res.json();
        const more = batch.length > PAGE_SIZE;
        const page = more ? batch.slice(0, PAGE_SIZE) : batch;
        setCompletedWorkouts((prev) => {
          const base = initial ? [] : prev;
          const seen = new Set(base.map((w) => w.id));
          return [...base, ...page.filter((w) => !seen.has(w.id))];
        });
        nextSkipRef.current = skip + page.length;
        setHasMore(more);
        setLoadError(false);
      } else {
        setLoadError(true);
      }
    } catch (error) {
      console.error('Error fetching workouts:', error);
      setLoadError(true);
    } finally {
      inFlightRef.current = false;
      if (initial) setLoadingWorkouts(false);
      else setLoadingMore(false);
    }
  }, [currentUser]);

  // In-progress sessions — unpaginated (few, and must always be visible).
  const loadInProgress = useCallback(async () => {
    if (!currentUser) return;
    try {
      const res = await fetch('/api/workout/workouts?completed=false');
      if (res.ok) setInProgressWorkouts(await res.json());
    } catch (error) {
      console.error('Error fetching in-progress workouts:', error);
    }
  }, [currentUser]);

  useEffect(() => {
    loadInProgress();
    loadCompletedPage(0);
  }, [loadInProgress, loadCompletedPage]);

  // Delete workout — drop it from whichever list holds it.
  const deleteWorkout = async (workoutId: string) => {
    if (!confirm(t('history.delete_confirm'))) {
      return;
    }

    setDeletingId(workoutId);
    try {
      const res = await fetch(`/api/workout/workouts/${workoutId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setInProgressWorkouts(prev => prev.filter(w => w.id !== workoutId));
        setCompletedWorkouts(prev => prev.filter(w => w.id !== workoutId));
      }
    } catch (error) {
      console.error('Error deleting workout:', error);
    } finally {
      setDeletingId(null);
    }
  };

  // Resume workout (navigate to workout page)
  const resumeWorkout = (workoutId: string) => {
    // Store the workout ID to resume in sessionStorage
    sessionStorage.setItem('resumeWorkoutId', workoutId);
    router.push('/workout');
  };

  // Loading state — render the shell (Header + BottomNav) so the page
  // doesn't collapse to a bare spinner during fetches.
  if (isLoading) {
    return (
      <main className="workout-main">
        <Header title={t('history.title')} />
        <div className="workout-page">
          <div className="loading-spinner" />
        </div>
        <BottomNav />
      </main>
    );
  }

  // Not logged in → mid-redirect; same shell.
  if (!currentUser) {
    return (
      <main className="workout-main">
        <Header title={t('history.title')} />
        <div className="workout-page">
          <div className="loading-spinner" />
        </div>
        <BottomNav />
      </main>
    );
  }

  // in-progress and completed come from their own state (separate fetches).

  // Group completed workouts by month (localised month label)
  const groupedWorkouts = completedWorkouts.reduce((groups, workout) => {
    const date = new Date(workout.date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const monthLabel = formatDate(date, language, { year: 'numeric', month: 'long' });

    if (!groups[monthKey]) {
      groups[monthKey] = { label: monthLabel, workouts: [] };
    }
    groups[monthKey].workouts.push(workout);
    return groups;
  }, {} as Record<string, { label: string; workouts: WorkoutSummary[] }>);

  const sortedMonths = Object.keys(groupedWorkouts).sort().reverse();

  return (
    <main className="workout-main">
      <Header title={t('history.title')} />

      <div className="workout-page">
        {loadingWorkouts ? (
          <div className="loading-spinner" />
        ) : inProgressWorkouts.length === 0 && completedWorkouts.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">{loadError ? '⚠️' : '📊'}</div>
            <div className="empty-state-text">{loadError ? t('history.load_error') : t('history.empty')}</div>
          </div>
        ) : (
          <>
            {/* In-Progress Workouts */}
            {inProgressWorkouts.length > 0 && (
              <div style={{ marginBottom: '24px' }}>
                <h3 style={{ 
                  fontSize: '14px', 
                  fontWeight: 600, 
                  color: 'var(--workout-gold)',
                  marginBottom: '12px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}>
                  <span style={{
                    width: '8px',
                    height: '8px',
                    backgroundColor: 'var(--workout-gold)',
                    borderRadius: '50%',
                    animation: 'pulse 2s infinite',
                  }} />
                  {t('history.in_progress')}
                </h3>

                {inProgressWorkouts.map(workout => {
                  const n = workout.exerciseCount;
                  
                  return (
                    <div
                      key={workout.id}
                      className="workout-card"
                      style={{ 
                        borderColor: 'var(--workout-gold)',
                        borderWidth: '2px',
                      }}
                    >
                      <div style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'space-between',
                      }}>
                        <div 
                          style={{ flex: 1, cursor: 'pointer' }}
                          onClick={() => router.push(`/workout/history/${workout.id}`)}
                        >
                          <div className="history-item-type">
                            🏋️ {getLocalizedTemplateName(workout.workoutName, language)}
                          </div>
                          <div className="history-item-date">
                            {formatDate(workout.date, language, {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                            })}
                            {' · '}
                            {exerciseCount(n, language)}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <button
                            className="workout-btn workout-btn-primary"
                            style={{ padding: '8px 16px', fontSize: '14px' }}
                            onClick={() => resumeWorkout(workout.id)}
                            aria-label={t('history.resume_aria')}
                          >
                            {t('history.resume')}
                          </button>
                          <button
                            className="exercise-card-action"
                            style={{
                              backgroundColor: 'var(--workout-red)',
                              color: 'white',
                              opacity: deletingId === workout.id ? 0.5 : 1,
                            }}
                            onClick={() => deleteWorkout(workout.id)}
                            disabled={deletingId === workout.id}
                            aria-label={t('history.delete_aria')}
                            title={t('history.delete_aria')}
                          >
                            🗑
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Completed Workouts */}
            {sortedMonths.length > 0 && (
              <>
                {inProgressWorkouts.length > 0 && (
                  <h3 style={{ 
                    fontSize: '14px', 
                    fontWeight: 600, 
                    color: 'var(--workout-text-secondary)',
                    marginBottom: '12px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                  }}>
                    {t('history.completed')}
                  </h3>
                )}
                
                {sortedMonths.map(monthKey => {
                  const { label, workouts: monthWorkouts } = groupedWorkouts[monthKey];
                  
                  return (
                    <div key={monthKey} style={{ marginBottom: '24px' }}>
                      <h4 style={{ 
                        fontSize: '13px', 
                        fontWeight: 500, 
                        color: 'var(--workout-text-muted)',
                        marginBottom: '8px',
                      }}>
                        {label}
                      </h4>
                      
                      {monthWorkouts.map(workout => {
                        const n = workout.exerciseCount;

                        return (
                          <div
                            key={workout.id}
                            className="history-item"
                          >
                            <div
                              style={{ flex: 1, cursor: 'pointer' }}
                              onClick={() => router.push(`/workout/history/${workout.id}`)}
                            >
                              <div className="history-item-info">
                                <div className="history-item-type">
                                  🏋️ {getLocalizedTemplateName(workout.workoutName, language)}
                                </div>
                                <div className="history-item-date">
                                  {formatDate(workout.date, language, {
                                    weekday: 'short',
                                    month: 'short',
                                    day: 'numeric',
                                  })}
                                </div>
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span className="history-item-count">
                                {n}
                              </span>
                              {/* Completed workouts get "View" → read-only
                                  detail page. Clicking Resume on a
                                  completed entry used to silently flip the
                                  isCompleted flag back to false (B1).
                                  Use the explicit Resume action on the
                                  in-progress section above instead. */}
                              <button
                                className="workout-btn workout-btn-secondary"
                                style={{ padding: '6px 12px', fontSize: '12px' }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  router.push(`/workout/history/${workout.id}`);
                                }}
                                aria-label={t('history.view_aria')}
                              >
                                {t('history.view')}
                              </button>
                              <button
                                className="exercise-card-action"
                                style={{
                                  backgroundColor: 'var(--workout-red)',
                                  color: 'white',
                                  opacity: deletingId === workout.id ? 0.5 : 1,
                                  width: '32px',
                                  height: '32px',
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  deleteWorkout(workout.id);
                                }}
                                disabled={deletingId === workout.id}
                                aria-label={t('history.delete_aria')}
                                title={t('history.delete_aria')}
                              >
                                🗑
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </>
            )}

            {hasMore && (
              <button
                className="workout-btn workout-btn-secondary workout-btn-full"
                onClick={() => loadCompletedPage(nextSkipRef.current)}
                disabled={loadingMore}
                style={{ marginTop: '8px', opacity: loadingMore ? 0.6 : 1 }}
              >
                {loadingMore ? t('history.loading_more') : t('history.load_more')}
              </button>
            )}
          </>
        )}
      </div>

      <BottomNav />

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </main>
  );
}
