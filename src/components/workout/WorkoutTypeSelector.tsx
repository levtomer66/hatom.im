'use client';

import React, { useState, useRef, useEffect } from 'react';

interface WorkoutNameInputProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (name: string) => void;
}

// Common workout name suggestions
const SUGGESTIONS = [
  { name: 'Push Day', icon: '💪' },
  { name: 'Pull Day', icon: '🏋️' },
  { name: 'Leg Day', icon: '🦵' },
  { name: 'Upper Body', icon: '👆' },
  { name: 'Lower Body', icon: '👇' },
  { name: 'Full Body', icon: '🔥' },
  { name: 'Chest & Triceps', icon: '💪' },
  { name: 'Back & Biceps', icon: '🏋️' },
];

export default function WorkoutNameInput({
  isOpen,
  onClose,
  onConfirm,
}: WorkoutNameInputProps) {
  const [workoutName, setWorkoutName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
    if (!isOpen) {
      setWorkoutName('');
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (workoutName.trim()) {
      onConfirm(workoutName.trim());
      setWorkoutName('');
      onClose();
    }
  };

  const handleSuggestionClick = (name: string) => {
    onConfirm(name);
    setWorkoutName('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="workout-modal-overlay" onClick={onClose}>
      <div className="workout-modal" onClick={(e) => e.stopPropagation()}>
        <div className="workout-modal-header">
          <h2 className="workout-modal-title">New Workout</h2>
          <button className="workout-modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        
        <div className="workout-modal-body">
          <form onSubmit={handleSubmit}>
            <label style={{ 
              display: 'block', 
              marginBottom: '8px', 
              fontSize: '14px',
              color: 'var(--workout-text-secondary)' 
            }}>
              Workout Name
            </label>
            <input
              ref={inputRef}
              type="text"
              className="workout-input"
              placeholder="e.g., Push Day, Leg Day..."
              value={workoutName}
              onChange={(e) => setWorkoutName(e.target.value)}
              maxLength={50}
            />
          </form>

          <div style={{ marginTop: '20px' }}>
            <div style={{ 
              fontSize: '12px', 
              color: 'var(--workout-text-muted)', 
              marginBottom: '12px',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              fontWeight: 600,
            }}>
              Quick Start
            </div>
            <div className="workout-type-grid" style={{ padding: 0 }}>
              {SUGGESTIONS.map(suggestion => (
                <button
                  key={suggestion.name}
                  className="workout-type-item"
                  onClick={() => handleSuggestionClick(suggestion.name)}
                >
                  <span className="workout-type-icon">{suggestion.icon}</span>
                  <span className="workout-type-label">{suggestion.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        
        <div className="workout-modal-footer">
          <button 
            className="workout-btn workout-btn-primary workout-btn-full"
            onClick={handleSubmit}
            disabled={!workoutName.trim()}
            style={{ opacity: workoutName.trim() ? 1 : 0.5 }}
          >
            Start Workout
          </button>
        </div>
      </div>
    </div>
  );
}
