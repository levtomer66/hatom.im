'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { WorkoutExercise, WorkoutSet, PersonalBest, ExerciseDefinition, isExerciseCompleted, getHighestWeight, MIN_SETS, MAX_SETS, formatRepsDisplay } from '@/types/workout';
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
  const hasData = exercise.sets.some(s => s.kg !== null || s.reps !== null);
  
  // Track if card is expanded for editing - always start collapsed
  const [isExpanded, setIsExpanded] = useState(false);
  
  // Refs for keyboard navigation and focus tracking
  const cardRef = useRef<HTMLDivElement>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  
  // Handle focus out - collapse when losing focus if has data
  // Use a small delay to allow click events on buttons within the card to complete
  const handleFocusOut = useCallback((e: FocusEvent) => {
    const relatedTarget = e.relatedTarget as Node | null;
    
    // If focus is moving to another element within the card, don't collapse
    if (cardRef.current && relatedTarget && cardRef.current.contains(relatedTarget)) {
      return;
    }
    
    // Use setTimeout to allow click events to complete before collapsing
    // This prevents the card from collapsing when clicking +/- buttons
    setTimeout(() => {
      // Check if focus is still outside the card after the timeout
      if (cardRef.current && !cardRef.current.contains(document.activeElement)) {
        if (hasData && isEditable) {
          setIsExpanded(false);
        }
      }
    }, 100);
  }, [hasData, isEditable]);
  
  // Set up focus out listener
  useEffect(() => {
    const card = cardRef.current;
    if (!card || !isEditable) return;
    
    card.addEventListener('focusout', handleFocusOut);
    return () => card.removeEventListener('focusout', handleFocusOut);
  }, [handleFocusOut, isEditable]);
  
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
  
  // Format PB display - show completed PB or current working weight
  const getPBDisplay = () => {
    if (!pb) return null;
    
    if (pb.completedKg !== null) {
      // Show completed PB
      return {
        label: 'PB',
        kg: pb.completedKg,
        reps: formatRepsDisplay(pb.completedReps),
      };
    }
    
    // No completed PB - show current working weight
    return {
      label: 'Working',
      kg: pb.currentKg,
      reps: formatRepsDisplay(pb.currentReps),
    };
  };
  
  const pbDisplay = getPBDisplay();

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
    
    const numValue = value === '' ? null : parseFloat(value);
    if (value !== '' && numValue !== null && (isNaN(numValue) || numValue < 0 || numValue > 999)) return;
    
    const newSets = [...exercise.sets];
    newSets[setIndex] = { ...newSets[setIndex], kg: numValue };
    onUpdate({ ...exercise, sets: newSets });
    
    // Auto-jump when 3+ digits entered (before decimal)
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
      const kg = s.kg !== null ? `${s.kg}kg` : '-';
      const reps = s.reps !== null ? `${s.reps}` : '-';
      return `${kg}×${reps}`;
    }).join(' | ');
  };

  // Collapsed view for all non-expanded cards in edit mode
  if (isEditable && !isExpanded) {
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
              {hasData ? formatSummary() : 'Tap to log sets'}
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
          {pbDisplay && (
            <div className="exercise-card-pb">
              {pbDisplay.label === 'PB' ? '🥇' : '💪'} {pbDisplay.label}: {pbDisplay.kg}kg ({pbDisplay.reps})
            </div>
          )}
          {isEditable && recommendedScale && !hasData && (
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
          {/* Set count tuner */}
          <div className="set-count-tuner">
            <span className="set-count-label">Sets:</span>
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
                <div className="set-number">Set {setIndex + 1}</div>
                <div className="exercise-form-field">
                  <label>KG</label>
                  <input
                    ref={(el) => { inputRefs.current[setIndex * 2] = el; }}
                    type="number"
                    inputMode="decimal"
                    enterKeyHint="next"
                    className="workout-input workout-input-number"
                    value={set.kg ?? ''}
                    onChange={(e) => handleKgChange(setIndex, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, setIndex * 2 + 1)}
                    placeholder={recommendedScale ? `${recommendedScale}` : '0'}
                    min="0"
                    max="999"
                    step="0.5"
                  />
                </div>
                <div className="exercise-form-field">
                  <label>Reps</label>
                  <input
                    ref={(el) => { inputRefs.current[setIndex * 2 + 1] = el; }}
                    type="number"
                    inputMode="numeric"
                    enterKeyHint={setIndex === exercise.sets.length - 1 ? 'done' : 'next'}
                    className="workout-input workout-input-number"
                    value={set.reps ?? ''}
                    onChange={(e) => handleRepsChange(setIndex, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(e, setIndex < exercise.sets.length - 1 ? (setIndex + 1) * 2 : null)}
                    placeholder="reps"
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
            placeholder="Notes (optional)..."
            rows={1}
          />
        </div>
      ) : (
        /* Read-only view */
        <div className="exercise-sets">
          {exercise.sets.map((set, i) => (
            <div key={i} className="exercise-set-row">
              <span className="exercise-set-label">Set {i + 1}</span>
              <span>
                {set.kg ?? '-'} kg × {set.reps ?? '-'} reps
              </span>
            </div>
          ))}
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
          ✓ Completed at {highestKg}kg
        </div>
      )}
    </div>
  );
}
