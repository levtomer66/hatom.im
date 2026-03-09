'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { WorkoutTemplate, ExerciseDefinition, ExerciseCategory, EXERCISE_FILTER_CATEGORIES } from '@/types/workout';
import { EXERCISE_LIBRARY } from '@/data/exercise-library';
import { useWorkoutUser } from '@/context/WorkoutUserContext';

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

interface TemplateEditorProps {
  isOpen: boolean;
  template: WorkoutTemplate | null;  // null = creating new template
  onClose: () => void;
  onSave: (template: WorkoutTemplate) => void;
}

export default function TemplateEditor({
  isOpen,
  template,
  onClose,
  onSave,
}: TemplateEditorProps) {
  const { currentUser } = useWorkoutUser();
  const [name, setName] = useState('');
  const [selectedExerciseIds, setSelectedExerciseIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [categoryFilters, setCategoryFilters] = useState<Set<ExerciseCategory>>(new Set());
  const [muscleFilters, setMuscleFilters] = useState<Set<string>>(new Set());
  const [customExercises, setCustomExercises] = useState<ExerciseDefinition[]>([]);
  const [isSaving, setIsSaving] = useState(false);

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

  // Initialize form when template changes
  useEffect(() => {
    if (isOpen) {
      fetchCustomExercises();
      if (template) {
        setName(template.name);
        setSelectedExerciseIds(new Set(template.exerciseIds));
      } else {
        setName('');
        setSelectedExerciseIds(new Set());
      }
      setSearch('');
      setCategoryFilters(new Set());
      setMuscleFilters(new Set());
    }
  }, [isOpen, template, fetchCustomExercises]);

  // Combine library and custom exercises
  const allExercises = useMemo(() => {
    return [...EXERCISE_LIBRARY, ...customExercises];
  }, [customExercises]);

  // Create exercise map for quick lookup
  const exerciseMap = useMemo(() => {
    const map: Record<string, ExerciseDefinition> = {};
    allExercises.forEach(e => { map[e.id] = e; });
    return map;
  }, [allExercises]);

  // Filter exercises
  const filteredExercises = useMemo(() => {
    return allExercises.filter(exercise => {
      // Filter by category
      if (categoryFilters.size > 0) {
        const matchesCategory = exercise.categories.some(cat => categoryFilters.has(cat));
        if (!matchesCategory) return false;
      }
      
      // Filter by muscle group
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
  }, [allExercises, categoryFilters, muscleFilters, search]);

  // Sort: selected first, then custom, then alphabetically
  const sortedExercises = useMemo(() => {
    return [...filteredExercises].sort((a, b) => {
      // Selected first
      const aSelected = selectedExerciseIds.has(a.id);
      const bSelected = selectedExerciseIds.has(b.id);
      if (aSelected && !bSelected) return -1;
      if (!aSelected && bSelected) return 1;
      // Custom exercises next
      if (a.isCustom && !b.isCustom) return -1;
      if (!a.isCustom && b.isCustom) return 1;
      // Alphabetically
      return a.name.localeCompare(b.name);
    });
  }, [filteredExercises, selectedExerciseIds]);

  const toggleExercise = (id: string) => {
    setSelectedExerciseIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

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

  const handleSave = async () => {
    if (!name.trim() || !currentUser) return;
    
    setIsSaving(true);
    try {
      const exerciseIds = Array.from(selectedExerciseIds);
      
      if (template) {
        // Update existing template
        const res = await fetch(`/api/workout/templates/${template.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name.trim(), exerciseIds }),
        });
        
        if (res.ok) {
          const updated = await res.json();
          onSave(updated);
          onClose();
        }
      } else {
        // Create new template
        const res = await fetch('/api/workout/templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: currentUser.id,
            name: name.trim(),
            exerciseIds,
          }),
        });
        
        if (res.ok) {
          const created = await res.json();
          onSave(created);
          onClose();
        }
      }
    } catch (error) {
      console.error('Error saving template:', error);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  // Get selected exercises for display
  const selectedExercises = Array.from(selectedExerciseIds)
    .map(id => exerciseMap[id])
    .filter(Boolean);

  return (
    <div className="workout-modal-overlay" onClick={onClose}>
      <div className="workout-modal" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '90vh' }}>
        <div className="workout-modal-header">
          <h2 className="workout-modal-title">
            {template ? 'Edit Workout' : 'Create Workout'}
          </h2>
          <button className="workout-modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        
        <div className="workout-modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Workout Name */}
          <div>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px', 
              fontSize: '14px',
              fontWeight: 600,
              color: 'var(--workout-text-secondary)' 
            }}>
              Workout Name
            </label>
            <input
              type="text"
              className="workout-input"
              placeholder="e.g., Push Day, Leg Day A..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={50}
            />
          </div>

          {/* Selected Exercises Preview */}
          {selectedExercises.length > 0 && (
            <div>
              <label style={{ 
                display: 'block', 
                marginBottom: '8px', 
                fontSize: '14px',
                fontWeight: 600,
                color: 'var(--workout-text-secondary)' 
              }}>
                Selected Exercises ({selectedExercises.length})
              </label>
              <div style={{ 
                display: 'flex', 
                flexWrap: 'wrap', 
                gap: '6px',
                padding: '12px',
                backgroundColor: 'var(--workout-bg-secondary)',
                borderRadius: '8px',
              }}>
                {selectedExercises.map(ex => (
                  <span 
                    key={ex.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '4px 10px',
                      backgroundColor: 'var(--workout-green-dim)',
                      border: '1px solid var(--workout-green)',
                      borderRadius: '16px',
                      fontSize: '12px',
                      fontWeight: 500,
                    }}
                  >
                    {ex.name}
                    <button
                      onClick={() => toggleExercise(ex.id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'var(--workout-text-secondary)',
                        cursor: 'pointer',
                        padding: 0,
                        fontSize: '14px',
                      }}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Exercise Selection */}
          <div style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px', 
              fontSize: '14px',
              fontWeight: 600,
              color: 'var(--workout-text-secondary)' 
            }}>
              Add Exercises
            </label>

            {/* Search */}
            <input
              type="text"
              className="workout-input"
              placeholder="Search exercises..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ marginBottom: '12px', flexShrink: 0 }}
            />

            {/* Category filters - wrap on multiple lines */}
            <div style={{ 
              display: 'flex', 
              flexWrap: 'wrap', 
              gap: '8px', 
              marginBottom: '10px',
              flexShrink: 0,
            }}>
              {EXERCISE_FILTER_CATEGORIES.slice(0, 4).map(category => (
                <button
                  key={category.id}
                  className={`category-filter-btn ${categoryFilters.has(category.id) ? 'active' : ''}`}
                  onClick={() => toggleCategoryFilter(category.id)}
                  style={{ flexShrink: 0 }}
                >
                  <span>{category.icon}</span>
                  <span>{category.label}</span>
                </button>
              ))}
            </div>

            {/* Muscle group filters */}
            <div style={{ 
              display: 'flex', 
              flexWrap: 'wrap', 
              gap: '6px', 
              marginBottom: '12px',
              flexShrink: 0,
            }}>
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

            {/* Exercise list - scrollable */}
            <div style={{ 
              flex: 1, 
              overflowY: 'auto', 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '8px',
              minHeight: '200px',
              maxHeight: '40vh',
              paddingRight: '4px',
            }}>
              {sortedExercises.length === 0 ? (
                <div style={{ 
                  textAlign: 'center', 
                  padding: '24px',
                  color: 'var(--workout-text-muted)',
                }}>
                  No exercises found
                </div>
              ) : (
                sortedExercises.map(exercise => (
                  <div
                    key={exercise.id}
                    className={`exercise-picker-item ${selectedExerciseIds.has(exercise.id) ? 'selected' : ''}`}
                    onClick={() => toggleExercise(exercise.id)}
                    style={{ 
                      padding: '12px', 
                      cursor: 'pointer',
                      flexShrink: 0,
                    }}
                  >
                    <div 
                      className="exercise-picker-photo"
                      style={{
                        width: '40px',
                        height: '40px',
                        flexShrink: 0,
                        backgroundImage: exercise.defaultPhoto 
                          ? `url(${exercise.defaultPhoto})` 
                          : 'none',
                        backgroundColor: exercise.defaultPhoto ? undefined : 'var(--workout-bg-card)',
                      }}
                    >
                      {!exercise.defaultPhoto && '🏋️'}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <span className="exercise-picker-name" style={{ fontSize: '14px' }}>
                        {exercise.name}
                      </span>
                      {exercise.isCustom && (
                        <span style={{ 
                          fontSize: '11px', 
                          color: 'var(--workout-blue)',
                          display: 'block',
                        }}>
                          Custom
                        </span>
                      )}
                    </div>
                    <div className="exercise-picker-check" style={{ width: '24px', height: '24px', flexShrink: 0 }}>
                      {selectedExerciseIds.has(exercise.id) && '✓'}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
        
        <div className="workout-modal-footer">
          <button 
            className="workout-btn workout-btn-primary workout-btn-full"
            onClick={handleSave}
            disabled={!name.trim() || isSaving}
            style={{ opacity: (!name.trim() || isSaving) ? 0.5 : 1 }}
          >
            {isSaving ? 'Saving...' : (template ? 'Save Changes' : 'Create Workout')}
          </button>
        </div>
      </div>
    </div>
  );
}
