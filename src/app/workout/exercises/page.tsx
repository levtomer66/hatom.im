'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useWorkoutUser } from '@/context/WorkoutUserContext';
import LoginScreen from '@/components/workout/LoginScreen';
import Header from '@/components/workout/Header';
import BottomNav from '@/components/workout/BottomNav';
import AddExerciseForm from '@/components/workout/AddExerciseForm';
import { PersonalBest, ExerciseDefinition } from '@/types/workout';
import { EXERCISE_LIBRARY } from '@/data/exercise-library';

// Muscle group filters
const MUSCLE_GROUPS = [
  { id: 'chest', label: 'Chest' },
  { id: 'back', label: 'Back' },
  { id: 'shoulders', label: 'Shoulders' },
  { id: 'biceps', label: 'Biceps' },
  { id: 'triceps', label: 'Triceps' },
  { id: 'legs', label: 'Legs' },
  { id: 'abs', label: 'Abs' },
  { id: 'glutes', label: 'Glutes' },
];

// Get muscle group from exercise name
function getMuscleGroup(exerciseName: string): string | null {
  const nameLower = exerciseName.toLowerCase();
  if (nameLower.startsWith('chest')) return 'chest';
  if (nameLower.startsWith('back')) return 'back';
  if (nameLower.startsWith('shoulder')) return 'shoulders';
  if (nameLower.startsWith('bicep')) return 'biceps';
  if (nameLower.startsWith('tricep')) return 'triceps';
  if (nameLower.startsWith('leg') || nameLower.startsWith('calf') || nameLower.startsWith('squat') || nameLower.includes('deadlift')) return 'legs';
  if (nameLower.startsWith('hip') || nameLower.startsWith('glute')) return 'glutes';
  if (nameLower.startsWith('ab') || nameLower.includes('crunch') || nameLower.includes('plank')) return 'abs';
  return null;
}

export default function ExercisesPage() {
  const router = useRouter();
  const { currentUser, isLoading } = useWorkoutUser();
  
  const [personalBests, setPersonalBests] = useState<Record<string, PersonalBest>>({});
  const [customExercises, setCustomExercises] = useState<ExerciseDefinition[]>([]);
  const [search, setSearch] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [muscleFilters, setMuscleFilters] = useState<Set<string>>(new Set());

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
    fetchPersonalBests();
    fetchCustomExercises();
  }, [fetchPersonalBests, fetchCustomExercises]);

  // Toggle muscle filter
  const toggleMuscleFilter = (muscleId: string) => {
    setMuscleFilters(prev => {
      const next = new Set(prev);
      if (next.has(muscleId)) {
        next.delete(muscleId);
      } else {
        next.add(muscleId);
      }
      return next;
    });
  };

  // Combine library and custom exercises
  const allExercises = useMemo(() => {
    return [...EXERCISE_LIBRARY, ...customExercises];
  }, [customExercises]);

  // Filter exercises by muscle group and search
  const filteredExercises = useMemo(() => {
    return allExercises.filter(exercise => {
      // Filter by muscle group (if any selected)
      if (muscleFilters.size > 0) {
        const exerciseMuscle = getMuscleGroup(exercise.name);
        if (!exerciseMuscle || !muscleFilters.has(exerciseMuscle)) return false;
      }
      
      // Filter by search
      if (search) {
        return exercise.name.toLowerCase().includes(search.toLowerCase());
      }
      
      return true;
    });
  }, [allExercises, search, muscleFilters]);

  // Sort exercises: those with PBs first, custom next, then alphabetically
  const sortedExercises = useMemo(() => {
    return [...filteredExercises].sort((a, b) => {
      const aPB = personalBests[a.id];
      const bPB = personalBests[b.id];
      
      // PBs first
      if (aPB && !bPB) return -1;
      if (!aPB && bPB) return 1;
      
      // Custom next
      if (a.isCustom && !b.isCustom) return -1;
      if (!a.isCustom && b.isCustom) return 1;
      
      return a.name.localeCompare(b.name);
    });
  }, [filteredExercises, personalBests]);

  const handleExerciseCreated = (exercise: ExerciseDefinition) => {
    setCustomExercises(prev => [...prev, exercise]);
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

  return (
    <main className="workout-main">
      <Header title="Exercises" />
      
      <div className="workout-page">
        {/* Search and Add */}
        <div style={{ marginBottom: '12px', display: 'flex', gap: '8px' }}>
          <input
            type="text"
            className="workout-input"
            placeholder="Search exercises..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1 }}
          />
          <button
            className="workout-btn workout-btn-primary"
            onClick={() => setShowAddForm(true)}
            style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}
          >
            + New
          </button>
        </div>
        
        {/* Muscle group filters */}
        <div className="muscle-filter-row" style={{ marginBottom: '16px' }}>
          {MUSCLE_GROUPS.map(muscle => (
            <button
              key={muscle.id}
              className={`muscle-filter-btn ${muscleFilters.has(muscle.id) ? 'active' : ''}`}
              onClick={() => toggleMuscleFilter(muscle.id)}
            >
              {muscle.label}
            </button>
          ))}
        </div>

        {/* Exercise list */}
        <div>
          {sortedExercises.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🔍</div>
              <div className="empty-state-text">No exercises found</div>
            </div>
          ) : (
            sortedExercises.map(exercise => {
              const pb = personalBests[exercise.id];
              
              return (
                <div
                  key={exercise.id}
                  className="history-item"
                  onClick={() => router.push(`/workout/exercises/${exercise.id}`)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div 
                      style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '8px',
                        backgroundColor: 'var(--workout-bg-secondary)',
                        backgroundImage: exercise.defaultPhoto 
                          ? `url(${exercise.defaultPhoto})` 
                          : 'none',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '20px',
                        flexShrink: 0,
                      }}
                    >
                      {!exercise.defaultPhoto && '🏋️'}
                    </div>
                    <div className="history-item-info">
                      <div className="history-item-type">
                        {exercise.name}
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        {pb && pb.completedKg !== null && (
                          <span style={{ fontSize: '13px', color: 'var(--workout-gold)' }}>
                            🥇 {pb.completedKg}kg: {pb.completedReps.join('×')}
                          </span>
                        )}
                        {pb && pb.completedKg === null && (
                          <span style={{ fontSize: '13px', color: 'var(--workout-text-secondary)' }}>
                            💪 {pb.currentKg}kg: {pb.currentReps.join('×')}
                          </span>
                        )}
                        {pb && (
                          <span style={{ 
                            fontSize: '12px', 
                            color: 'var(--workout-accent)',
                            backgroundColor: 'rgba(251, 191, 36, 0.15)',
                            padding: '2px 6px',
                            borderRadius: '4px',
                          }}>
                            Next: {pb.recommendedKg}kg
                          </span>
                        )}
                        {exercise.isCustom && (
                          <span style={{ 
                            fontSize: '12px', 
                            color: 'var(--workout-blue)',
                            backgroundColor: 'rgba(59, 130, 246, 0.2)',
                            padding: '2px 6px',
                            borderRadius: '4px',
                          }}>
                            Custom
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <span style={{ fontSize: '20px', color: 'var(--workout-text-muted)' }}>›</span>
                </div>
              );
            })
          )}
        </div>
      </div>

      <BottomNav />

      <AddExerciseForm
        isOpen={showAddForm}
        onClose={() => setShowAddForm(false)}
        onCreated={handleExerciseCreated}
      />
    </main>
  );
}
