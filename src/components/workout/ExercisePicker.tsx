'use client';

import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { ExerciseDefinition, ExerciseCategory, EXERCISE_FILTER_CATEGORIES } from '@/types/workout';
import { EXERCISE_LIBRARY } from '@/data/exercise-library';
import { getLocalizedExercise, getExerciseSearchNames } from '@/lib/exercise-translations';
import { useWorkoutUser } from '@/context/WorkoutUserContext';
import { useWorkoutLanguage } from '@/context/WorkoutLanguageContext';
import { useT, getCategoryLabel } from '@/lib/workout-i18n';
import AddExerciseForm from './AddExerciseForm';

// Muscle group filter IDs (labels come from getCategoryLabel in the render).
const MUSCLE_GROUP_IDS: ExerciseCategory[] = [
  'chest', 'back', 'shoulders', 'biceps', 'triceps', 'legs', 'abs', 'glutes',
];

interface ExercisePickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (exercises: ExerciseDefinition[]) => void;
  excludeIds?: string[];
  // When true, picker behaves as single-select: tapping a row commits
  // onSelect([one]) immediately and closes. Used by the replace flow so
  // the user doesn't have to tap twice (select → confirm) for one swap.
  replaceMode?: boolean;
}

export default function ExercisePicker({
  isOpen,
  onClose,
  onSelect,
  excludeIds = [],
  replaceMode = false,
}: ExercisePickerProps) {
  const { currentUser } = useWorkoutUser();
  const { language } = useWorkoutLanguage();
  const t = useT();
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
      
      // Filter by muscle group: match against the exercise's categories,
      // not a name-prefix heuristic (which misses entries like "Active Hang"
      // or "Nordic Hamstring Curl" whose categories are set but whose English
      // name doesn't start with the muscle label).
      if (muscleFilters.size > 0) {
        const matchesMuscle = exercise.categories.some(cat => muscleFilters.has(cat));
        if (!matchesMuscle) return false;
      }
      
      // Filter by search — match against English name and every known translation.
      if (search) {
        const searchLower = search.toLowerCase();
        return getExerciseSearchNames(exercise)
          .some(n => n.toLowerCase().includes(searchLower));
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
    if (replaceMode) {
      // Single-select: commit immediately. No intermediate checkbox state
      // and no confirm button — one tap swaps and closes.
      const picked = allExercises.find(e => e.id === id);
      if (!picked) return;
      onSelect([picked]);
      setSelectedIds(new Set());
      setSearch('');
      setMuscleFilters(new Set());
      setCategoryFilters(new Set());
      onClose();
      return;
    }
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
    if (replaceMode) {
      // In replace flow, creating a custom exercise is the swap target —
      // commit immediately and close, matching one-tap semantics.
      onSelect([exercise]);
      setSelectedIds(new Set());
      setSearch('');
      setMuscleFilters(new Set());
      setCategoryFilters(new Set());
      onClose();
      return;
    }
    // Optionally auto-select the new exercise
    setSelectedIds(prev => new Set([...prev, exercise.id]));
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="workout-modal-overlay" onClick={handleClose}>
        <div className="workout-modal" onClick={(e) => e.stopPropagation()}>
          <div className="workout-modal-header">
            <h2 className="workout-modal-title">{t(replaceMode ? 'picker.replace_title' : 'picker.title')}</h2>
            <button className="workout-modal-close" onClick={handleClose} aria-label={t('generic.close')}>
              ✕
            </button>
          </div>

          <div className="workout-modal-body">
            <div className="exercise-picker-search">
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  className="workout-input"
                  placeholder={t('picker.search')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button
                  className="workout-btn workout-btn-primary"
                  onClick={() => setShowAddForm(true)}
                  style={{ padding: '12px 16px', whiteSpace: 'nowrap' }}
                >
                  + {t('picker.add_selected_one').charAt(0).toUpperCase() + t('picker.add_selected_one').slice(1)}
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
                    <span>{getCategoryLabel(category.id, language)}</span>
                  </button>
                ))}
              </div>

              {/* Muscle group filters */}
              <div className="muscle-filter-row">
                {MUSCLE_GROUP_IDS.map(muscleId => (
                  <button
                    key={muscleId}
                    className={`muscle-filter-btn ${muscleFilters.has(muscleId) ? 'active' : ''}`}
                    onClick={() => toggleMuscleFilter(muscleId)}
                  >
                    {getCategoryLabel(muscleId, language)}
                  </button>
                ))}
              </div>
            </div>

            <div className="exercise-picker-grid">
              {sortedExercises.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">🔍</div>
                  <div className="empty-state-text">{t('picker.none_found')}</div>
                  <button
                    className="workout-btn workout-btn-secondary"
                    onClick={() => setShowAddForm(true)}
                    style={{ marginTop: '16px' }}
                  >
                    {t('picker.create_custom')}
                  </button>
                </div>
              ) : (
                sortedExercises.map(exercise => {
                  const exName = getLocalizedExercise(exercise, language).name;
                  return (
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
                        <span className="exercise-picker-name">{exName}</span>
                        {exercise.isCustom && (
                          <span style={{
                            fontSize: '11px',
                            color: 'var(--workout-blue)',
                            display: 'block',
                            marginTop: '2px',
                          }}>
                            {t('picker.custom_badge')}
                          </span>
                        )}
                      </div>
                      <div className="exercise-picker-check">
                        {selectedIds.has(exercise.id) && '✓'}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
          
          {!replaceMode && (
            <div className="workout-modal-footer">
              <button
                className="workout-btn workout-btn-primary workout-btn-full"
                onClick={handleConfirm}
                disabled={selectedIds.size === 0}
                style={{ opacity: selectedIds.size === 0 ? 0.5 : 1 }}
              >
                {t('picker.add_selected_prefix')}{selectedIds.size > 0 ? ` ${selectedIds.size} ${selectedIds.size === 1 ? t('picker.add_selected_one') : t('picker.add_selected_many')}` : ` ${t('picker.add_selected_many')}`}
              </button>
            </div>
          )}
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
