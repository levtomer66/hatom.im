'use client';

import React from 'react';
import { WorkoutType, WORKOUT_TYPES } from '@/types/workout';

interface WorkoutTypeSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (type: WorkoutType) => void;
}

export default function WorkoutTypeSelector({
  isOpen,
  onClose,
  onSelect,
}: WorkoutTypeSelectorProps) {
  if (!isOpen) return null;

  return (
    <div className="workout-modal-overlay" onClick={onClose}>
      <div className="workout-modal" onClick={(e) => e.stopPropagation()}>
        <div className="workout-modal-header">
          <h2 className="workout-modal-title">Select Workout Type</h2>
          <button className="workout-modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        
        <div className="workout-type-grid">
          {WORKOUT_TYPES.map(type => (
            <button
              key={type.id}
              className="workout-type-item"
              onClick={() => {
                onSelect(type.id);
                onClose();
              }}
            >
              <span className="workout-type-icon">{type.icon}</span>
              <span className="workout-type-label">{type.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
