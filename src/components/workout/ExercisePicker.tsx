'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { ExerciseDefinition, ExerciseCategory, EXERCISE_FILTER_CATEGORIES } from '@/types/workout';
import { EXERCISE_LIBRARY } from '@/data/exercise-library';
import { useWorkoutUser } from '@/context/WorkoutUserContext';
import AddExerciseForm from './AddExerciseForm';

// Muscle group filters
const MUSCLE_GROUPS = [
  { id: 'chest', label: 'Chest', icon: '🫁' },
  { id: 'back', label: 'Back', icon: '🔙' },
  { id: 'shoulders', label: 'Shoulders', icon: '💪' },
  { id: 'biceps', label: 'Biceps', icon: '💪' },
  { id: 'triceps', label: 'Triceps', icon: '💪' },
  { id: 'legs', label: 'Legs', icon: '🦵' },
  { id: 'abs', label: 'Abs', icon: '🎯' },
  { id: 'glutes', label: 'Glutes', icon: '🍑' },
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

interface ExercisePickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (exercises: ExerciseDefinition[]) => void;
  excludeIds?: string[];
}

export default function ExercisePicker({
  isOpen,
  onClose,
  onSelect,
  excludeIds = [],
}: ExercisePickerProps) {
  const { currentUser } = useWorkoutUser();
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [customExercises, setCustomExercises] = useState<ExerciseDefinition[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [muscleFilters, setMuscleFilters] = useState<Set<string>>(new Set());
  const [categoryFilters, setCategoryFilters] = useState<Set<ExerciseCategory>>(new Set());

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
    if (isOpen) {
      fetchCustomExercises();
    }
  }, [isOpen, fetchCustomExercises]);

  // Combine library and custom exercises
  const allExercises = useMemo(() => {
    return [...EXERCISE_LIBRARY, ...customExercises];
  }, [customExercises]);

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

  // Toggle category filter (Push/Pull/Legs)
  const toggleCategoryFilter = (categoryId: ExerciseCategory) => {
    setCategoryFilters(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  // Filter exercises based on category filters, muscle filters, and search
  const filteredExercises = useMemo(() => {
    return allExercises.filter(exercise => {
      // Exclude already added exercises
      if (excludeIds.includes(exercise.id)) return false;
      
      // Filter by category (Push/Pull/Legs) - if any selected
      if (categoryFilters.size > 0) {
        const matchesCategory = exercise.categories.some(cat => 
          categoryFilters.has(cat)
        );
        if (!matchesCategory) return false;
      }
      
      // Filter by muscle group (if any selected)
      if (muscleFilters.size > 0) {
        const exerciseMuscle = getMuscleGroup(exercise.name);
        if (!exerciseMuscle || !muscleFilters.has(exerciseMuscle)) return false;
      }
      
      // Filter by search
      if (search) {
        const searchLower = search.toLowerCase();
        return exercise.name.toLowerCase().includes(searchLower);
      }
      
      return true;
    });
  }, [search, excludeIds, allExercises, muscleFilters, categoryFilters]);

  // Sort: custom exercises first, then alphabetically
  const sortedExercises = useMemo(() => {
    return [...filteredExercises].sort((a, b) => {
      // Custom exercises first
      if (a.isCustom && !b.isCustom) return -1;
      if (!a.isCustom && b.isCustom) return 1;
      // Then alphabetically
      return a.name.localeCompare(b.name);
    });
  }, [filteredExercises]);

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleConfirm = () => {
    const selected = allExercises.filter(e => selectedIds.has(e.id));
    onSelect(selected);
    setSelectedIds(new Set());
    setSearch('');
    setMuscleFilters(new Set());
    setCategoryFilters(new Set());
    onClose();
  };

  const handleClose = () => {
    setSelectedIds(new Set());
    setSearch('');
    setMuscleFilters(new Set());
    setCategoryFilters(new Set());
    onClose();
  };

  const handleExerciseCreated = (exercise: ExerciseDefinition) => {
    setCustomExercises(prev => [...prev, exercise]);
    // Optionally auto-select the new exercise
    setSelectedIds(prev => new Set([...prev, exercise.id]));
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="workout-modal-overlay" onClick={handleClose}>
        <div className="workout-modal" onClick={(e) => e.stopPropagation()}>
          <div className="workout-modal-header">
            <h2 className="workout-modal-title">Add Exercises</h2>
            <button className="workout-modal-close" onClick={handleClose}>
              ✕
            </button>
          </div>
          
          <div className="workout-modal-body">
            <div className="exercise-picker-search">
              <div style={{ display: 'flex', gap: '8px' }}>
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
              
              {/* Category filters (Push/Pull/Legs) */}
              <div className="category-filter-row">
                {EXERCISE_FILTER_CATEGORIES.slice(0, 4).map(category => (
                  <button
                    key={category.id}
                    className={`category-filter-btn ${categoryFilters.has(category.id) ? 'active' : ''}`}
                    onClick={() => toggleCategoryFilter(category.id)}
                  >
                    <span>{category.icon}</span>
                    <span>{category.label}</span>
                  </button>
                ))}
              </div>
              
              {/* Muscle group filters */}
              <div className="muscle-filter-row">
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
            </div>
            
            <div className="exercise-picker-grid">
              {sortedExercises.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">🔍</div>
                  <div className="empty-state-text">No exercises found</div>
                  <button
                    className="workout-btn workout-btn-secondary"
                    onClick={() => setShowAddForm(true)}
                    style={{ marginTop: '16px' }}
                  >
                    + Create Custom Exercise
                  </button>
                </div>
              ) : (
                sortedExercises.map(exercise => (
                  <div
                    key={exercise.id}
                    className={`exercise-picker-item ${selectedIds.has(exercise.id) ? 'selected' : ''}`}
                    onClick={() => toggleSelection(exercise.id)}
                  >
                    <div 
                      className="exercise-picker-photo"
                      style={{
                        backgroundImage: exercise.defaultPhoto 
                          ? `url(${exercise.defaultPhoto})` 
                          : 'none',
                        backgroundColor: exercise.defaultPhoto ? undefined : 'var(--workout-bg-card)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '20px',
                      }}
                    >
                      {!exercise.defaultPhoto && '🏋️'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span className="exercise-picker-name">{exercise.name}</span>
                      {exercise.isCustom && (
                        <span style={{ 
                          fontSize: '11px', 
                          color: 'var(--workout-blue)',
                          display: 'block',
                          marginTop: '2px',
                        }}>
                          Custom
                        </span>
                      )}
                    </div>
                    <div className="exercise-picker-check">
                      {selectedIds.has(exercise.id) && '✓'}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          
          <div className="workout-modal-footer">
            <button 
              className="workout-btn workout-btn-primary workout-btn-full"
              onClick={handleConfirm}
              disabled={selectedIds.size === 0}
              style={{ opacity: selectedIds.size === 0 ? 0.5 : 1 }}
            >
              Add {selectedIds.size > 0 ? `${selectedIds.size} Exercise${selectedIds.size > 1 ? 's' : ''}` : 'Exercises'}
            </button>
          </div>
        </div>
      </div>

      <AddExerciseForm
        isOpen={showAddForm}
        onClose={() => setShowAddForm(false)}
        onCreated={handleExerciseCreated}
      />
    </>
  );
}
