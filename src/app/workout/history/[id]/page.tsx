'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useWorkoutUser } from '@/context/WorkoutUserContext';
import LoginScreen from '@/components/workout/LoginScreen';
import Header from '@/components/workout/Header';
import BottomNav from '@/components/workout/BottomNav';
import ExerciseCard from '@/components/workout/ExerciseCard';
import { Workout, PersonalBest, ExerciseDefinition } from '@/types/workout';
import { EXERCISE_LIBRARY } from '@/data/exercise-library';

export default function WorkoutDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { currentUser, isLoading } = useWorkoutUser();
  
  const workoutId = params?.id as string;
  
  const [workout, setWorkout] = useState<Workout | null>(null);
  const [personalBests, setPersonalBests] = useState<Record<string, PersonalBest>>({});
  const [customExercises, setCustomExercises] = useState<ExerciseDefinition[]>([]);
  const [loadingWorkout, setLoadingWorkout] = useState(true);

  // Create exercise lookup map
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

  useEffect(() => {
    fetchWorkout();
    fetchPersonalBests();
    fetchCustomExercises();
  }, [fetchWorkout, fetchPersonalBests, fetchCustomExercises]);

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

  // Workout loading
  if (loadingWorkout) {
    return (
      <main className="workout-main">
        <Header title="Workout" showBack onBack={() => router.back()} />
        <div className="loading-spinner" />
        <BottomNav />
      </main>
    );
  }

  // Workout not found
  if (!workout) {
    return (
      <main className="workout-main">
        <Header title="Workout" showBack onBack={() => router.back()} />
        <div className="workout-page">
          <div className="empty-state">
            <div className="empty-state-icon">❓</div>
            <div className="empty-state-text">Workout not found</div>
          </div>
        </div>
        <BottomNav />
      </main>
    );
  }

  return (
    <main className="workout-main">
      <Header 
        title={`🏋️ ${workout.workoutName}`} 
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
            {new Date(workout.date).toLocaleDateString('en-US', {
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
            {workout.exercises.length} exercise{workout.exercises.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Exercise cards (read-only) */}
        {workout.exercises.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📋</div>
            <div className="empty-state-text">No exercises in this workout</div>
          </div>
        ) : (
          workout.exercises.map((exercise) => (
            <ExerciseCard
              key={exercise.id}
              exercise={exercise}
              exerciseDefinition={exerciseMap[exercise.exerciseId] || null}
              pb={personalBests[exercise.exerciseId] || null}
              mode="readonly"
            />
          ))
        )}
      </div>

      <BottomNav />
    </main>
  );
}
