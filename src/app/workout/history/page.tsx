'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useWorkoutUser } from '@/context/WorkoutUserContext';
import LoginScreen from '@/components/workout/LoginScreen';
import Header from '@/components/workout/Header';
import BottomNav from '@/components/workout/BottomNav';
import { Workout } from '@/types/workout';

export default function HistoryPage() {
  const router = useRouter();
  const { currentUser, isLoading } = useWorkoutUser();
  
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loadingWorkouts, setLoadingWorkouts] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Fetch all workouts (both completed and in-progress)
  const fetchWorkouts = useCallback(async () => {
    if (!currentUser) return;
    
    setLoadingWorkouts(true);
    try {
      const res = await fetch(`/api/workout/workouts?userId=${currentUser.id}`);
      if (res.ok) {
        const data = await res.json();
        setWorkouts(data);
      }
    } catch (error) {
      console.error('Error fetching workouts:', error);
    } finally {
      setLoadingWorkouts(false);
    }
  }, [currentUser]);

  useEffect(() => {
    fetchWorkouts();
  }, [fetchWorkouts]);

  // Delete workout
  const deleteWorkout = async (workoutId: string) => {
    if (!confirm('Delete this workout? This action cannot be undone.')) {
      return;
    }
    
    setDeletingId(workoutId);
    try {
      const res = await fetch(`/api/workout/workouts/${workoutId}`, {
        method: 'DELETE',
      });
      
      if (res.ok) {
        setWorkouts(prev => prev.filter(w => w.id !== workoutId));
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

  // Loading state
  if (isLoading) {
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

  // Separate in-progress and completed workouts
  const inProgressWorkouts = workouts.filter(w => !w.isCompleted);
  const completedWorkouts = workouts.filter(w => w.isCompleted);

  // Group completed workouts by month
  const groupedWorkouts = completedWorkouts.reduce((groups, workout) => {
    const date = new Date(workout.date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    const monthLabel = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
    
    if (!groups[monthKey]) {
      groups[monthKey] = { label: monthLabel, workouts: [] };
    }
    groups[monthKey].workouts.push(workout);
    return groups;
  }, {} as Record<string, { label: string; workouts: Workout[] }>);

  const sortedMonths = Object.keys(groupedWorkouts).sort().reverse();

  return (
    <main className="workout-main">
      <Header title="History" />
      
      <div className="workout-page">
        {loadingWorkouts ? (
          <div className="loading-spinner" />
        ) : workouts.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📊</div>
            <div className="empty-state-text">No workouts yet</div>
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
                  In Progress
                </h3>
                
                {inProgressWorkouts.map(workout => {
                  const exerciseCount = workout.exercises.length;
                  
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
                            🏋️ {workout.workoutName}
                          </div>
                          <div className="history-item-date">
                            {new Date(workout.date).toLocaleDateString('en-US', {
                              weekday: 'short',
                              month: 'short',
                              day: 'numeric',
                            })}
                            {' · '}
                            {exerciseCount} exercise{exerciseCount !== 1 ? 's' : ''}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <button
                            className="workout-btn workout-btn-primary"
                            style={{ padding: '8px 16px', fontSize: '14px' }}
                            onClick={() => resumeWorkout(workout.id)}
                          >
                            Resume
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
                    Completed
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
                        const exerciseCount = workout.exercises.length;
                        
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
                                  🏋️ {workout.workoutName}
                                </div>
                                <div className="history-item-date">
                                  {new Date(workout.date).toLocaleDateString('en-US', {
                                    weekday: 'short',
                                    month: 'short',
                                    day: 'numeric',
                                  })}
                                </div>
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <span className="history-item-count">
                                {exerciseCount}
                              </span>
                              <button
                                className="workout-btn workout-btn-secondary"
                                style={{ padding: '6px 12px', fontSize: '12px' }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  resumeWorkout(workout.id);
                                }}
                              >
                                Resume
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
