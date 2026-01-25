'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { WorkoutExercise, PersonalBest, ExerciseDefinition, isExerciseCompleted } from '@/types/workout';
import { getExerciseById } from '@/data/exercise-library';

interface ExerciseCardProps {
  exercise: WorkoutExercise;
  exerciseDefinition?: ExerciseDefinition | null;
  pb?: PersonalBest | null;
  mode: 'edit' | 'readonly';
  onUpdate?: (exercise: WorkoutExercise) => void;
  onRemove?: () => void;
  onReplace?: () => void;
}

export default function ExerciseCard({
  exercise,
  exerciseDefinition,
  pb,
  mode,
  onUpdate,
  onRemove,
}: ExerciseCardProps) {
  // Use provided definition or fall back to library lookup
  const exerciseDef = exerciseDefinition || getExerciseById(exercise.exerciseId);
  const isCompleted = isExerciseCompleted(exercise);
  const isEditable = mode === 'edit';
  
  // Check if form has any data filled
  const hasData = exercise.scaleKg !== null || 
    exercise.set1Reps !== null || 
    exercise.set2Reps !== null || 
    exercise.set3Reps !== null;
  
  // Track if card is expanded for editing
  const [isExpanded, setIsExpanded] = useState(!hasData);
  
  // Refs for keyboard navigation and focus tracking
  const cardRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef<HTMLInputElement>(null);
  const set1Ref = useRef<HTMLInputElement>(null);
  const set2Ref = useRef<HTMLInputElement>(null);
  const set3Ref = useRef<HTMLInputElement>(null);
  
  // Handle focus out - collapse when losing focus if has data
  const handleFocusOut = useCallback((e: FocusEvent) => {
    // Check if the new focus target is still within this card
    const relatedTarget = e.relatedTarget as Node | null;
    if (cardRef.current && relatedTarget && cardRef.current.contains(relatedTarget)) {
      return; // Still within card, don't collapse
    }
    
    // Collapse if has data
    if (hasData && isEditable) {
      setIsExpanded(false);
    }
  }, [hasData, isEditable]);
  
  // Set up focus out listener
  useEffect(() => {
    const card = cardRef.current;
    if (!card || !isEditable) return;
    
    card.addEventListener('focusout', handleFocusOut);
    return () => card.removeEventListener('focusout', handleFocusOut);
  }, [handleFocusOut, isEditable]);
  
  // Auto-focus on Scale input when card expands
  useEffect(() => {
    if (isExpanded && isEditable && scaleRef.current) {
      // Small delay to ensure the DOM is ready
      setTimeout(() => {
        scaleRef.current?.focus();
      }, 50);
    }
  }, [isExpanded, isEditable]);
  
  // Calculate current total reps
  const currentTotalReps = (exercise.set1Reps || 0) + (exercise.set2Reps || 0) + (exercise.set3Reps || 0);
  
  // Check if current exercise matches or beats PB (same or higher weight with same or more reps)
  const isPBMatch = pb && 
    exercise.scaleKg !== null &&
    exercise.scaleKg >= pb.scaleKg &&
    currentTotalReps >= pb.totalReps;

  // Calculate recommended scale (+2.5kg from last completed)
  const recommendedScale = pb?.lastCompletedKg ? pb.lastCompletedKg + 2.5 : null;

  const handleNumberChange = (
    field: 'scaleKg' | 'set1Reps' | 'set2Reps' | 'set3Reps',
    value: string,
    nextRef?: React.RefObject<HTMLInputElement | null> | null
  ) => {
    if (!onUpdate) return;
    
    // For scale (KG), allow float values
    if (field === 'scaleKg') {
      // Allow empty, digits, and one decimal point
      if (value !== '' && !/^\d*\.?\d*$/.test(value)) return;
      
      const numValue = value === '' ? null : parseFloat(value);
      if (value !== '' && numValue !== null && (isNaN(numValue) || numValue < 0 || numValue > 999)) return;
      
      onUpdate({
        ...exercise,
        [field]: numValue,
      });
      
      // Auto-jump when 3+ digits entered (before decimal)
      const integerPart = value.split('.')[0];
      if (integerPart.length >= 3 && !value.includes('.') && nextRef?.current) {
        setTimeout(() => nextRef.current?.focus(), 0);
      }
      return;
    }
    
    // For reps, limit to 2 digits (0-99)
    if (value.length > 2) return;
    
    const numValue = value === '' ? null : parseInt(value, 10);
    if (value !== '' && (isNaN(numValue as number) || (numValue as number) < 0)) return;
    if (numValue !== null && numValue > 99) return;
    
    onUpdate({
      ...exercise,
      [field]: numValue,
    });
    
    // Auto-jump to next field when 2 digits reached for reps
    if (value.length === 2 && nextRef?.current) {
      setTimeout(() => nextRef.current?.focus(), 0);
    }
  };

  const handleNotesChange = (value: string) => {
    if (!onUpdate) return;
    onUpdate({
      ...exercise,
      notes: value,
    });
  };

  // Handle Enter/Next key to move to next input
  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    nextRef: React.RefObject<HTMLInputElement | null> | null
  ) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (nextRef?.current) {
        nextRef.current.focus();
      } else {
        // Last field - blur to hide keyboard
        (e.target as HTMLInputElement).blur();
      }
    }
  };

  // Apply recommended scale
  const applyRecommendedScale = () => {
    if (!onUpdate || !recommendedScale) return;
    onUpdate({
      ...exercise,
      scaleKg: recommendedScale,
    });
  };

  // Collapsed view for exercises with data (when not expanded)
  if (hasData && isEditable && !isExpanded) {
    // Format the stats display
    const scaleDisplay = exercise.scaleKg !== null ? `${exercise.scaleKg}kg` : '-';
    const repsDisplay = [
      exercise.set1Reps ?? '-',
      exercise.set2Reps ?? '-', 
      exercise.set3Reps ?? '-'
    ].join('/');
    
    return (
      <div 
        className={`workout-card workout-card-collapsed ${isCompleted ? 'workout-card-completed' : ''}`}
        onClick={() => setIsExpanded(true)}
      >
        <div className="exercise-collapsed-row">
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
            <span className="exercise-collapsed-name">{exerciseDef?.name || exercise.exerciseId}</span>
            <span className="exercise-collapsed-stats">
              {scaleDisplay} • {repsDisplay}
            </span>
          </div>
          {isCompleted && <div className="exercise-collapsed-badge">✓</div>}
          {onRemove && (
            <button 
              className="exercise-card-action"
              onClick={(e) => { e.stopPropagation(); onRemove(); }}
              title="Remove exercise"
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
      ref={cardRef}
      className={`workout-card ${isCompleted ? 'workout-card-completed' : ''} ${isPBMatch ? 'workout-card-pb' : ''}`}
    >
      {/* Header */}
      <div className="exercise-card-header">
        <div 
          className="exercise-card-photo"
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
        </div>
        
        <div className="exercise-card-info">
          <div className="exercise-card-name">
            {exerciseDef?.name || exercise.exerciseId}
          </div>
          {pb && (
            <div className="exercise-card-pb">
              🥇 PB: {pb.scaleKg}kg ({pb.totalReps} reps)
            </div>
          )}
          {isEditable && recommendedScale && !exercise.scaleKg && (
            <div className="exercise-card-recommended" onClick={applyRecommendedScale}>
              💡 Recommended: {recommendedScale}kg
            </div>
          )}
        </div>
        
        {isEditable && (
          <div className="exercise-card-actions">
            {onRemove && (
              <button 
                className="exercise-card-action"
                onClick={onRemove}
                title="Remove exercise"
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
          <div className="exercise-form-row">
            <div className="exercise-form-field exercise-form-field-scale">
              <label>KG</label>
              <input
                ref={scaleRef}
                type="number"
                inputMode="decimal"
                enterKeyHint="next"
                className="workout-input workout-input-number"
                value={exercise.scaleKg ?? ''}
                onChange={(e) => handleNumberChange('scaleKg', e.target.value, set1Ref)}
                onKeyDown={(e) => handleKeyDown(e, set1Ref)}
                placeholder={recommendedScale ? `${recommendedScale}` : '0'}
                min="0"
                max="999"
                step="0.5"
              />
            </div>
            <div className="exercise-form-field">
              <label>Set 1</label>
              <input
                ref={set1Ref}
                type="number"
                inputMode="numeric"
                enterKeyHint="next"
                className="workout-input workout-input-number"
                value={exercise.set1Reps ?? ''}
                onChange={(e) => handleNumberChange('set1Reps', e.target.value, set2Ref)}
                onKeyDown={(e) => handleKeyDown(e, set2Ref)}
                placeholder="reps"
                min="0"
                max="99"
              />
            </div>
            <div className="exercise-form-field">
              <label>Set 2</label>
              <input
                ref={set2Ref}
                type="number"
                inputMode="numeric"
                enterKeyHint="next"
                className="workout-input workout-input-number"
                value={exercise.set2Reps ?? ''}
                onChange={(e) => handleNumberChange('set2Reps', e.target.value, set3Ref)}
                onKeyDown={(e) => handleKeyDown(e, set3Ref)}
                placeholder="reps"
                min="0"
                max="99"
              />
            </div>
            <div className="exercise-form-field">
              <label>Set 3</label>
              <input
                ref={set3Ref}
                type="number"
                inputMode="numeric"
                enterKeyHint="done"
                className="workout-input workout-input-number"
                value={exercise.set3Reps ?? ''}
                onChange={(e) => handleNumberChange('set3Reps', e.target.value, null)}
                onKeyDown={(e) => handleKeyDown(e, null)}
                placeholder="reps"
                min="0"
                max="99"
              />
            </div>
          </div>
          
          {/* Notes - optional, always available */}
          <textarea
            className="workout-textarea workout-textarea-compact"
            value={exercise.notes}
            onChange={(e) => handleNotesChange(e.target.value)}
            placeholder="Notes (optional)..."
            rows={1}
          />
        </div>
      ) : (
        /* Read-only view */
        <div className="exercise-sets">
          <div className="exercise-set-row">
            <span className="exercise-set-label">Scale (KG)</span>
            <span style={{ fontWeight: 700, fontSize: '18px' }}>
              {exercise.scaleKg ?? '-'} kg
            </span>
          </div>
          <div className="exercise-set-row">
            <span className="exercise-set-label">Set 1</span>
            <span>{exercise.set1Reps ?? '-'} reps</span>
          </div>
          <div className="exercise-set-row">
            <span className="exercise-set-label">Set 2</span>
            <span>{exercise.set2Reps ?? '-'} reps</span>
          </div>
          <div className="exercise-set-row">
            <span className="exercise-set-label">Set 3</span>
            <span>{exercise.set3Reps ?? '-'} reps</span>
          </div>
          {exercise.notes && (
            <div className="exercise-set-row" style={{ marginTop: '8px' }}>
              <span className="exercise-set-label">Notes</span>
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
          ✓ Completed at {exercise.scaleKg}kg ({exercise.set1Reps}/{exercise.set2Reps}/{exercise.set3Reps} reps)
        </div>
      )}
    </div>
  );
}
