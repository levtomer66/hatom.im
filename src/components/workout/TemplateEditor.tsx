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
  useSortable,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  WorkoutTemplate,
  TemplateExercise,
  ExerciseDefinition,
  ExerciseCategory,
  EXERCISE_FILTER_CATEGORIES,
  DEFAULT_NUM_SETS,
  MIN_SETS,
  MAX_SETS,
} from '@/types/workout';
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

// One sortable row in the "Selected Exercises" list
function SelectedExerciseRow({
  entry,
  exerciseDef,
  onUpdate,
  onRemove,
}: {
  entry: TemplateExercise;
  exerciseDef: ExerciseDefinition | undefined;
  onUpdate: (next: TemplateExercise) => void;
  onRemove: () => void;
}) {
  const {
    setNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: entry.exerciseId });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1,
        zIndex: isDragging ? 10 : undefined,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        padding: '10px 12px',
        backgroundColor: 'var(--workout-bg-card)',
        border: '1px solid var(--workout-border)',
        borderRadius: '10px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <button
          type="button"
          className="exercise-card-action"
          title="Drag to reorder"
          style={{ cursor: 'grab', touchAction: 'none', flexShrink: 0 }}
          {...attributes}
          {...listeners}
        >
          ≡
        </button>
        <div style={{ flex: 1, minWidth: 0, fontSize: '14px', fontWeight: 500 }}>
          {exerciseDef?.name || entry.exerciseId}
        </div>
        <div className="set-count-controls" style={{ flexShrink: 0 }}>
          <button
            type="button"
            className="set-count-btn"
            onClick={() => onUpdate({ ...entry, numSets: Math.max(MIN_SETS, entry.numSets - 1) })}
            disabled={entry.numSets <= MIN_SETS}
          >
            −
          </button>
          <span className="set-count-value">{entry.numSets}</span>
          <button
            type="button"
            className="set-count-btn"
            onClick={() => onUpdate({ ...entry, numSets: Math.min(MAX_SETS, entry.numSets + 1) })}
            disabled={entry.numSets >= MAX_SETS}
          >
            +
          </button>
        </div>
        <button
          type="button"
          className="exercise-card-action"
          onClick={onRemove}
          title="Remove exercise"
          style={{ flexShrink: 0 }}
        >
          ✕
        </button>
      </div>
      <input
        type="text"
        className="workout-input"
        placeholder="Notes for this exercise (optional)…"
        value={entry.notes}
        onChange={(e) => onUpdate({ ...entry, notes: e.target.value })}
        style={{ fontSize: '13px', padding: '6px 10px' }}
      />
    </div>
  );
}

export default function TemplateEditor({
  isOpen,
  template,
  onClose,
  onSave,
}: TemplateEditorProps) {
  const { currentUser } = useWorkoutUser();
  const [name, setName] = useState('');
  const [selectedExercises, setSelectedExercises] = useState<TemplateExercise[]>([]);
  const [search, setSearch] = useState('');
  const [categoryFilters, setCategoryFilters] = useState<Set<ExerciseCategory>>(new Set());
  const [muscleFilters, setMuscleFilters] = useState<Set<string>>(new Set());
  const [customExercises, setCustomExercises] = useState<ExerciseDefinition[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

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
        setSelectedExercises(
          (template.exercises ?? []).map(e => ({
            exerciseId: e.exerciseId,
            numSets: e.numSets ?? DEFAULT_NUM_SETS,
            notes: e.notes ?? '',
          }))
        );
      } else {
        setName('');
        setSelectedExercises([]);
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

  const selectedIds = useMemo(
    () => new Set(selectedExercises.map(e => e.exerciseId)),
    [selectedExercises]
  );

  // Filter exercises
  const filteredExercises = useMemo(() => {
    return allExercises.filter(exercise => {
      if (categoryFilters.size > 0) {
        const matchesCategory = exercise.categories.some(cat => categoryFilters.has(cat));
        if (!matchesCategory) return false;
      }
      if (muscleFilters.size > 0) {
        const exerciseMuscle = getMuscleGroup(exercise.name);
        if (!exerciseMuscle || !muscleFilters.has(exerciseMuscle)) return false;
      }
      if (search) {
        return exercise.name.toLowerCase().includes(search.toLowerCase());
      }
      return true;
    });
  }, [allExercises, categoryFilters, muscleFilters, search]);

  // Sort: selected first, then custom, then alphabetically
  const sortedExercises = useMemo(() => {
    return [...filteredExercises].sort((a, b) => {
      const aSelected = selectedIds.has(a.id);
      const bSelected = selectedIds.has(b.id);
      if (aSelected && !bSelected) return -1;
      if (!aSelected && bSelected) return 1;
      if (a.isCustom && !b.isCustom) return -1;
      if (!a.isCustom && b.isCustom) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [filteredExercises, selectedIds]);

  const toggleExercise = (id: string) => {
    setSelectedExercises(prev => {
      if (prev.some(e => e.exerciseId === id)) {
        return prev.filter(e => e.exerciseId !== id);
      }
      return [...prev, { exerciseId: id, numSets: DEFAULT_NUM_SETS, notes: '' }];
    });
  };

  const updateSelectedEntry = (index: number, next: TemplateExercise) => {
    setSelectedExercises(prev => {
      const copy = [...prev];
      copy[index] = next;
      return copy;
    });
  };

  const removeSelectedEntry = (index: number) => {
    setSelectedExercises(prev => prev.filter((_, i) => i !== index));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setSelectedExercises(prev => {
      const oldIndex = prev.findIndex(e => e.exerciseId === active.id);
      const newIndex = prev.findIndex(e => e.exerciseId === over.id);
      if (oldIndex < 0 || newIndex < 0) return prev;
      return arrayMove(prev, oldIndex, newIndex);
    });
  };

  const toggleCategoryFilter = (categoryId: ExerciseCategory) => {
    setCategoryFilters(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) next.delete(categoryId); else next.add(categoryId);
      return next;
    });
  };

  const toggleMuscleFilter = (muscleId: string) => {
    setMuscleFilters(prev => {
      const next = new Set(prev);
      if (next.has(muscleId)) next.delete(muscleId); else next.add(muscleId);
      return next;
    });
  };

  const handleSave = async () => {
    if (!name.trim() || !currentUser) return;

    setIsSaving(true);
    try {
      if (template) {
        const res = await fetch(`/api/workout/templates/${template.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: name.trim(), exercises: selectedExercises }),
        });

        if (res.ok) {
          const updated = await res.json();
          onSave(updated);
          onClose();
        }
      } else {
        const res = await fetch('/api/workout/templates', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: currentUser.id,
            name: name.trim(),
            exercises: selectedExercises,
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

          {/* Selected Exercises (ordered, per-entry defaults, drag to reorder) */}
          {selectedExercises.length > 0 && (
            <div>
              <label style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '14px',
                fontWeight: 600,
                color: 'var(--workout-text-secondary)'
              }}>
                Selected Exercises ({selectedExercises.length}) — drag to reorder
              </label>
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={selectedExercises.map(e => e.exerciseId)}
                  strategy={verticalListSortingStrategy}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {selectedExercises.map((entry, index) => (
                      <SelectedExerciseRow
                        key={entry.exerciseId}
                        entry={entry}
                        exerciseDef={exerciseMap[entry.exerciseId]}
                        onUpdate={(next) => updateSelectedEntry(index, next)}
                        onRemove={() => removeSelectedEntry(index)}
                      />
                    ))}
                  </div>
                </SortableContext>
              </DndContext>
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

            {/* Category filters */}
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
                    className={`exercise-picker-item ${selectedIds.has(exercise.id) ? 'selected' : ''}`}
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
                      {selectedIds.has(exercise.id) && '✓'}
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
