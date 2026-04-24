'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { WorkoutExercise, WorkoutSet, PersonalBest, ExerciseDefinition, ExerciseHistoryEntry, isExerciseCompleted, getHighestWeight, MIN_SETS, MAX_SETS } from '@/types/workout';
import { getExerciseById } from '@/data/exercise-library';
import { getLocalizedExercise } from '@/lib/exercise-translations';
import { useWorkoutUser } from '@/context/WorkoutUserContext';
import { useWorkoutLanguage } from '@/context/WorkoutLanguageContext';
import { useWorkoutUnit } from '@/context/WorkoutUnitContext';
import { useT, formatDate, getLocalizedTemplateName } from '@/lib/workout-i18n';
import {
  displayToKg,
  formatWeight,
  getUnitLabel,
  getUnitSuffix,
  roundForDisplay,
} from '@/lib/weight';
import ExerciseExternalLinks from './ExerciseExternalLinks';

export interface ExerciseCardDraggable {
  setNodeRef: (node: HTMLElement | null) => void;
  handleAttributes: Record<string, unknown>;
  handleListeners: Record<string, unknown> | undefined;
  style?: React.CSSProperties;
  isDragging?: boolean;
}

interface ExerciseCardProps {
  exercise: WorkoutExercise;
  exerciseDefinition?: ExerciseDefinition | null;
  pb?: PersonalBest | null;
  mode: 'edit' | 'readonly';
  onUpdate?: (exercise: WorkoutExercise) => void;
  onRemove?: () => void;
  onReplace?: () => void;
  draggable?: ExerciseCardDraggable;
}

export default function ExerciseCard({
  exercise,
  exerciseDefinition,
  pb,
  mode,
  onUpdate,
  onRemove,
  draggable,
}: ExerciseCardProps) {
  const { currentUser } = useWorkoutUser();
  const { language } = useWorkoutLanguage();
  const { unit } = useWorkoutUnit();
  const t = useT();
  const unitLabel = getUnitLabel(unit, language);
  const unitSuffix = getUnitSuffix(unit, language);

  // Use provided definition or fall back to library lookup
  const exerciseDef = exerciseDefinition || getExerciseById(exercise.exerciseId);
  const localized = exerciseDef
    ? getLocalizedExercise(exerciseDef, language)
    : { name: exercise.exerciseId, description: undefined };
  const displayName = localized.name;
  const displayDescription = localized.description;
  const isCompleted = isExerciseCompleted(exercise);
  const isEditable = mode === 'edit';

  // Check if form has any data filled
  const hasData = exercise.sets.some(s => s.kg !== null || s.reps !== null);

  // Track if card is expanded for editing - always start collapsed
  const [isExpanded, setIsExpanded] = useState(false);

  // History modal state
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<ExerciseHistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Refs for keyboard navigation and focus tracking
  const cardRef = useRef<HTMLDivElement>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Merge dnd-kit's setNodeRef with our cardRef (needed for click-outside collapse).
  const setCardRef = useCallback((node: HTMLDivElement | null) => {
    cardRef.current = node;
    draggable?.setNodeRef(node);
  }, [draggable]);

  const dragStyle = draggable?.style;

  // Drag handle — only render when a draggable context is provided AND we're editing.
  // stopPropagation on click so tapping the handle doesn't also toggle expansion.
  const dragHandle = (draggable && isEditable) ? (
    <button
      type="button"
      className="exercise-card-action"
      title={t('card.drag_to_reorder')}
      onClick={(e) => e.stopPropagation()}
      style={{ cursor: 'grab', touchAction: 'none' }}
      {...draggable.handleAttributes}
      {...(draggable.handleListeners ?? {})}
    >
      ≡
    </button>
  ) : null;
  
  // Fetch exercise history when modal opens
  const fetchHistory = useCallback(async () => {
    if (!currentUser) return;
    
    setLoadingHistory(true);
    try {
      const res = await fetch(
        `/api/workout/exercises/history?userId=${currentUser.id}&exerciseId=${exercise.exerciseId}`
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
  }, [currentUser, exercise.exerciseId]);

  const openHistory = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowHistory(true);
    fetchHistory();
  };
  
  // Collapse when clicking/tapping outside the card
  useEffect(() => {
    if (!isExpanded || !isEditable) return;
    
    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        setIsExpanded(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isExpanded, isEditable]);
  
  // Auto-focus on first KG input when card expands
  useEffect(() => {
    if (isExpanded && isEditable && inputRefs.current[0]) {
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 50);
    }
  }, [isExpanded, isEditable]);
  
  // Calculate current highest weight and total reps at that weight
  const highestKg = getHighestWeight(exercise);
  const currentRepsAtHighest = exercise.sets
    .filter(s => s.kg === highestKg && s.kg !== null && s.reps !== null)
    .map(s => s.reps as number);
  const totalRepsAtHighest = currentRepsAtHighest.reduce((sum, r) => sum + r, 0);
  
  // Check if current exercise matches or beats PB
  const isPBMatch = pb && pb.completedKg !== null &&
    highestKg >= pb.completedKg &&
    totalRepsAtHighest >= pb.completedReps.reduce((sum, r) => sum + r, 0);

  // Get recommended scale from PB
  const recommendedScale = pb?.recommendedKg ?? null;

  // Handle set count change (2-5 sets)
  const handleSetCountChange = (newCount: number) => {
    if (!onUpdate) return;
    if (newCount < MIN_SETS || newCount > MAX_SETS) return;
    
    const currentSets = [...exercise.sets];
    let newSets: WorkoutSet[];
    
    if (newCount > currentSets.length) {
      // Add new sets
      newSets = [
        ...currentSets,
        ...Array.from({ length: newCount - currentSets.length }, () => ({ kg: null, reps: null }))
      ];
    } else {
      // Remove sets from the end
      newSets = currentSets.slice(0, newCount);
    }
    
    onUpdate({ ...exercise, sets: newSets });
  };

  const handleKgChange = (setIndex: number, value: string) => {
    if (!onUpdate) return;

    if (value !== '' && !/^\d*\.?\d*$/.test(value)) return;

    // `value` is whatever the user typed in the ACTIVE unit. The bound
    // `value` on <input> is also in the active unit, so the stored kg is
    // derived from it on change. Storage stays kg-canonical so PBs and
    // history remain consistent across devices / users.
    const displayValue = value === '' ? null : parseFloat(value);
    if (value !== '' && displayValue !== null && (isNaN(displayValue) || displayValue < 0 || displayValue > 999)) return;

    // Round-trip guard against silent drift in lb mode: 20 kg renders as
    // "44.1 lb"; if the user re-submits "44.1" untouched, naively
    // converting back would store 19.9989… kg and falsify the PB.
    // When the typed display value matches what the stored kg would
    // render as, keep the canonical kg bit-exact and no-op.
    const currentKg = exercise.sets[setIndex].kg;
    const currentDisplay = currentKg === null ? null : roundForDisplay(currentKg, unit);
    if (displayValue === currentDisplay) return;

    const kgValue = displayValue === null ? null : displayToKg(displayValue, unit);

    const newSets = [...exercise.sets];
    newSets[setIndex] = { ...newSets[setIndex], kg: kgValue };
    onUpdate({ ...exercise, sets: newSets });

    // Auto-jump when 3+ digits entered (before decimal) — threshold applies
    // to the string the user typed, not the stored kg, so the behaviour
    // matches what they see on screen in either unit.
    const integerPart = value.split('.')[0];
    const nextRefIndex = setIndex * 2 + 1; // Index of reps input for same set
    if (integerPart.length >= 3 && !value.includes('.') && inputRefs.current[nextRefIndex]) {
      setTimeout(() => inputRefs.current[nextRefIndex]?.focus(), 0);
    }
  };

  const handleRepsChange = (setIndex: number, value: string) => {
    if (!onUpdate) return;
    
    if (value.length > 2) return;
    
    const numValue = value === '' ? null : parseInt(value, 10);
    if (value !== '' && (isNaN(numValue as number) || (numValue as number) < 0)) return;
    if (numValue !== null && numValue > 99) return;
    
    const newSets = [...exercise.sets];
    newSets[setIndex] = { ...newSets[setIndex], reps: numValue };
    onUpdate({ ...exercise, sets: newSets });
    
    // Auto-jump to next set's KG field when 2 digits reached
    const nextRefIndex = (setIndex + 1) * 2; // Index of kg input for next set
    if (value.length === 2 && inputRefs.current[nextRefIndex]) {
      setTimeout(() => inputRefs.current[nextRefIndex]?.focus(), 0);
    }
  };

  const handleNotesChange = (value: string) => {
    if (!onUpdate) return;
    onUpdate({ ...exercise, notes: value });
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    nextRefIndex: number | null
  ) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (nextRefIndex !== null && inputRefs.current[nextRefIndex]) {
        inputRefs.current[nextRefIndex]?.focus();
      } else {
        (e.target as HTMLInputElement).blur();
      }
    }
  };

  // Apply recommended scale to all sets
  const applyRecommendedScale = () => {
    if (!onUpdate || !recommendedScale) return;
    const newSets = exercise.sets.map(s => ({ ...s, kg: recommendedScale }));
    onUpdate({ ...exercise, sets: newSets });
  };

  // Format summary for collapsed view
  const formatSummary = () => {
    const setsWithData = exercise.sets.filter(s => s.kg !== null || s.reps !== null);
    if (setsWithData.length === 0) return '-';

    return exercise.sets.map((s) => {
      const kg = s.kg !== null ? `${formatWeight(s.kg, unit)}${unitSuffix}` : '-';
      const reps = s.reps !== null ? `${s.reps}` : '-';
      return `${kg}×${reps}`;
    }).join(' | ');
  };

  // Collapsed view for all non-expanded cards in edit mode
  if (isEditable && !isExpanded) {
    return (
      <div
        ref={setCardRef}
        style={dragStyle}
        className={`workout-card workout-card-collapsed ${isCompleted ? 'workout-card-completed' : ''} ${draggable?.isDragging ? 'workout-card-dragging' : ''}`}
        onClick={() => setIsExpanded(true)}
      >
        <div className="exercise-collapsed-row">
          {dragHandle}
          <div
            className="exercise-collapsed-photo"
            style={{
              backgroundImage: exerciseDef?.defaultPhoto
                ? `url(${exerciseDef.defaultPhoto})`
                : 'none',
              backgroundColor: exerciseDef?.defaultPhoto ? undefined : 'var(--workout-bg-secondary)',
            }}
          >
            {!exerciseDef?.defaultPhoto && '🏋️'}
          </div>
          <div className="exercise-collapsed-info">
            <span className="exercise-collapsed-name">{displayName}</span>
            <span className="exercise-collapsed-stats">
              {hasData ? formatSummary() : t('card.tap_to_log')}
            </span>
          </div>
          {isCompleted && <div className="exercise-collapsed-badge">✓</div>}
          {onRemove && (
            <button
              className="exercise-card-action"
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              title={t('card.remove')}
            >
              ✕
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      ref={setCardRef}
      style={dragStyle}
      className={`workout-card ${isCompleted ? 'workout-card-completed' : ''} ${isPBMatch ? 'workout-card-pb' : ''} ${draggable?.isDragging ? 'workout-card-dragging' : ''}`}
    >
      {/* Header */}
      <div className="exercise-card-header">
        <div 
          className="exercise-card-photo exercise-card-photo-clickable"
          onClick={openHistory}
          style={{
            backgroundImage: exerciseDef?.defaultPhoto 
              ? `url(${exerciseDef.defaultPhoto})` 
              : 'none',
            backgroundColor: exerciseDef?.defaultPhoto ? undefined : 'var(--workout-bg-secondary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '24px',
          }}
        >
          {!exerciseDef?.defaultPhoto && '🏋️'}
          <span className="exercise-card-photo-hint">📊</span>
        </div>
        
        <div className="exercise-card-info">
          <div className="exercise-card-name">
            {displayName}
          </div>
          {displayDescription && (
            <div className="exercise-card-description" style={{ fontSize: '12px', color: 'var(--workout-text-secondary)', marginTop: '2px' }}>
              {displayDescription}
            </div>
          )}
          {exerciseDef?.name && (
            <div style={{ marginTop: '6px' }}>
              <ExerciseExternalLinks englishName={exerciseDef.name} size={16} />
            </div>
          )}
          {isEditable && recommendedScale && !hasData && (
            <div className="exercise-card-recommended" onClick={applyRecommendedScale}>
              {t('card.recommended_prefix')} {formatWeight(recommendedScale, unit)}{unitSuffix}
            </div>
          )}
        </div>

        {isEditable && (
          <div className="exercise-card-actions">
            {dragHandle}
            {onRemove && (
              <button
                className="exercise-card-action"
                onClick={onRemove}
                title={t('card.remove')}
              >
                ✕
              </button>
            )}
          </div>
        )}
      </div>

      {/* Compact form layout for editing */}
      {isEditable ? (
        <div className="exercise-form-compact">
          {/* Set count tuner */}
          <div className="set-count-tuner">
            <span className="set-count-label">{t('card.sets_label')}</span>
            <div className="set-count-controls">
              <button 
                className="set-count-btn"
                onClick={() => handleSetCountChange(exercise.sets.length - 1)}
                disabled={exercise.sets.length <= MIN_SETS}
              >
                −
              </button>
              <span className="set-count-value">{exercise.sets.length}</span>
              <button 
                className="set-count-btn"
                onClick={() => handleSetCountChange(exercise.sets.length + 1)}
                disabled={exercise.sets.length >= MAX_SETS}
              >
                +
              </button>
            </div>
          </div>

          {/* Sets grid - each set has its own KG and Reps */}
          <div className="exercise-sets-grid">
            {exercise.sets.map((set, setIndex) => (
              <div key={setIndex} className="exercise-set-row-edit">
                <div className="set-number">{t('card.set_n')} {setIndex + 1}</div>
                <div className="exercise-form-field">
                  <label>{unitLabel}</label>
                  <input
                    ref={(el) => { inputRefs.current[setIndex * 2] = el; }}
                    type="number"
                    inputMode="decimal"
                    enterKeyHint="next"
                    className="workout-input workout-input-number"
                    // Display in the active unit; handleKgChange converts
                    // back to kg before persisting.
                    value={set.kg === null ? '' : (roundForDisplay(set.kg, unit) as number)}
                    onChange={(e) => handleKgChange(setIndex, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, setIndex * 2 + 1)}
                    placeholder={recommendedScale ? `${formatWeight(recommendedScale, unit)}` : '0'}
                    min="0"
                    max="999"
                    step="0.5"
                  />
                </div>
                <div className="exercise-form-field">
                  <label>{t('card.reps')}</label>
                  <input
                    ref={(el) => { inputRefs.current[setIndex * 2 + 1] = el; }}
                    type="number"
                    inputMode="numeric"
                    enterKeyHint={setIndex === exercise.sets.length - 1 ? 'done' : 'next'}
                    className="workout-input workout-input-number"
                    value={set.reps ?? ''}
                    onChange={(e) => handleRepsChange(setIndex, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, setIndex < exercise.sets.length - 1 ? (setIndex + 1) * 2 : null)}
                    placeholder={t('card.reps_placeholder')}
                    min="0"
                    max="99"
                  />
                </div>
              </div>
            ))}
          </div>
          
          {/* Notes - optional, always available */}
          <textarea
            className="workout-textarea workout-textarea-compact"
            value={exercise.notes}
            onChange={(e) => handleNotesChange(e.target.value)}
            placeholder={t('card.notes_placeholder')}
            rows={1}
          />
        </div>
      ) : (
        /* Read-only view */
        <div className="exercise-sets">
          {exercise.sets.map((set, i) => (
            <div key={i} className="exercise-set-row">
              <span className="exercise-set-label">{t('card.set_n')} {i + 1}</span>
              <span>
                {formatWeight(set.kg, unit)} {unitSuffix} × {set.reps ?? '-'} {t('card.reps_suffix')}
              </span>
            </div>
          ))}
          {exercise.notes && (
            <div className="exercise-set-row" style={{ marginTop: '8px' }}>
              <span className="exercise-set-label">{t('card.notes_label')}</span>
              <span style={{ color: 'var(--workout-text-secondary)' }}>
                {exercise.notes}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Completion badge */}
      {isCompleted && !isEditable && (
        <div className="completion-badge">
          {t('card.completed_at_prefix')} {formatWeight(highestKg, unit)}{unitSuffix}
        </div>
      )}

      {/* History modal */}
      {showHistory && (
        <div className="workout-modal-overlay" onClick={() => setShowHistory(false)}>
          <div className="workout-modal" onClick={(e) => e.stopPropagation()}>
            <div className="workout-modal-header">
              <span className="workout-modal-title">
                📊 {displayName}
              </span>
              <button className="workout-modal-close" onClick={() => setShowHistory(false)} aria-label={t('generic.close')}>
                ✕
              </button>
            </div>
            <div className="workout-modal-body">
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
                          {entry.workoutName ? getLocalizedTemplateName(entry.workoutName, language) : t('workout.title')}
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
                              {formatWeight(set.kg, unit)}{unitSuffix} × {set.reps ?? '-'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
