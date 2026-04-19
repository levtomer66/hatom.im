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
import { getLocalizedExercise, getExerciseSearchNames } from '@/lib/exercise-translations';
import { useWorkoutUser } from '@/context/WorkoutUserContext';
import { useWorkoutLanguage } from '@/context/WorkoutLanguageContext';
import { useT, getCategoryLabel } from '@/lib/workout-i18n';

// Muscle group filter IDs (labels come from getCategoryLabel at render time).
const MUSCLE_GROUP_IDS: ExerciseCategory[] = [
  'chest', 'back', 'shoulders', 'biceps', 'triceps', 'legs', 'abs', 'glutes',
];

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
  const { language } = useWorkoutLanguage();
  const t = useT();
  const rowName = exerciseDef
    ? getLocalizedExercise(exerciseDef, language).name
    : entry.exerciseId;
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
          title={t('card.drag_to_reorder')}
          style={{ cursor: 'grab', touchAction: 'none', flexShrink: 0 }}
          {...attributes}
          {...listeners}
        >
          ≡
        </button>
        <div style={{ flex: 1, minWidth: 0, fontSize: '14px', fontWeight: 500 }}>
          {rowName}
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
          title={t('card.remove')}
          style={{ flexShrink: 0 }}
        >
          ✕
        </button>
      </div>
      <input
        type="text"
        className="workout-input"
        placeholder={t('template.row_notes_placeholder')}
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
  const { language } = useWorkoutLanguage();
  const t = useT();
  const [name, setName] = useState('');
  const [selectedExercises, setSelectedExercises] = useState<TemplateExercise[]>([]);
  const [search, setSearch] = useState('');
  const [categoryFilters, setCategoryFilters] = useState<Set<ExerciseCategory>>(new Set());
  const [muscleFilters, setMuscleFilters] = useState<Set<ExerciseCategory>>(new Set());
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
      // Filter by muscle group: match against the exercise's categories,
      // not an English-name prefix heuristic — otherwise entries like
      // "Active Hang" or "Nordic Hamstring Curl" fall out of the filter.
      if (muscleFilters.size > 0) {
        const matchesMuscle = exercise.categories.some(cat => muscleFilters.has(cat));
        if (!matchesMuscle) return false;
      }
      if (search) {
        const q = search.toLowerCase();
        return getExerciseSearchNames(exercise).some(n => n.toLowerCase().includes(q));
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

  const toggleMuscleFilter = (muscleId: ExerciseCategory) => {
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
            {template ? t('template.edit_title') : t('template.create_title')}
          </h2>
          <button className="workout-modal-close" onClick={onClose} aria-label={t('generic.close')}>
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
              {t('template.name_label')}
            </label>
            <input
              type="text"
              className="workout-input"
              placeholder={t('template.name_placeholder')}
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
                {t('template.selected_prefix')} ({selectedExercises.length}) {t('template.selected_hint')}
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
              {t('template.add_section')}
            </label>

            {/* Search */}
            <input
              type="text"
              className="workout-input"
              placeholder={t('picker.search')}
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
                  <span>{getCategoryLabel(category.id, language)}</span>
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
                  {t('picker.none_found')}
                </div>
              ) : (
                sortedExercises.map(exercise => {
                  const listName = getLocalizedExercise(exercise, language).name;
                  return (
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
                          {listName}
                        </span>
                        {exercise.isCustom && (
                          <span style={{
                            fontSize: '11px',
                            color: 'var(--workout-blue)',
                            display: 'block',
                          }}>
                            {t('picker.custom_badge')}
                          </span>
                        )}
                      </div>
                      <div className="exercise-picker-check" style={{ width: '24px', height: '24px', flexShrink: 0 }}>
                        {selectedIds.has(exercise.id) && '✓'}
                      </div>
                    </div>
                  );
                })
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
            {isSaving ? t('template.save_creating') : (template ? t('template.save_changes') : t('template.create_title'))}
          </button>
        </div>
      </div>
    </div>
  );
}
