'use client';

import React, { useState } from 'react';
import { ExerciseCategory, ExerciseDefinition } from '@/types/workout';
import { useWorkoutUser } from '@/context/WorkoutUserContext';

interface AddExerciseFormProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (exercise: ExerciseDefinition) => void;
}

const CATEGORY_OPTIONS: { id: ExerciseCategory; label: string }[] = [
  { id: 'push', label: 'Push (Chest/Shoulders/Triceps)' },
  { id: 'pull', label: 'Pull (Back/Biceps)' },
  { id: 'legs', label: 'Legs' },
  { id: 'calisthenics', label: 'Calisthenics' },
  { id: 'full-body', label: 'Full Body / Abs' },
];

export default function AddExerciseForm({
  isOpen,
  onClose,
  onCreated,
}: AddExerciseFormProps) {
  const { currentUser } = useWorkoutUser();
  const [name, setName] = useState('');
  const [selectedCategories, setSelectedCategories] = useState<Set<ExerciseCategory>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const toggleCategory = (cat: ExerciseCategory) => {
    setSelectedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) {
        next.delete(cat);
      } else {
        next.add(cat);
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!currentUser) return;
    
    if (!name.trim()) {
      setError('Please enter an exercise name');
      return;
    }
    
    if (selectedCategories.size === 0) {
      setError('Please select at least one category');
      return;
    }
    
    setIsSubmitting(true);
    setError('');
    
    try {
      const res = await fetch('/api/workout/exercises/custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          name: name.trim(),
          categories: Array.from(selectedCategories),
        }),
      });
      
      if (res.ok) {
        const exercise = await res.json();
        onCreated(exercise);
        handleClose();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to create exercise');
      }
    } catch {
      setError('Failed to create exercise');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setName('');
    setSelectedCategories(new Set());
    setError('');
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="workout-modal-overlay" onClick={handleClose}>
      <div className="workout-modal" onClick={(e) => e.stopPropagation()}>
        <div className="workout-modal-header">
          <h2 className="workout-modal-title">Add New Exercise</h2>
          <button className="workout-modal-close" onClick={handleClose}>
            ✕
          </button>
        </div>
        
        <div className="workout-modal-body">
          {/* Exercise Name */}
          <div style={{ marginBottom: '20px' }}>
            <label 
              style={{ 
                display: 'block', 
                marginBottom: '8px', 
                fontWeight: 600,
                fontSize: '14px',
              }}
            >
              Exercise Name
            </label>
            <input
              type="text"
              className="workout-input"
              placeholder="e.g. Incline Cable Fly"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>
          
          {/* Categories */}
          <div style={{ marginBottom: '20px' }}>
            <label 
              style={{ 
                display: 'block', 
                marginBottom: '8px', 
                fontWeight: 600,
                fontSize: '14px',
              }}
            >
              Categories (select all that apply)
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {CATEGORY_OPTIONS.map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => toggleCategory(cat.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '12px 16px',
                    backgroundColor: selectedCategories.has(cat.id) 
                      ? 'var(--workout-green-dim)' 
                      : 'var(--workout-bg-secondary)',
                    border: selectedCategories.has(cat.id)
                      ? '2px solid var(--workout-green)'
                      : '2px solid transparent',
                    borderRadius: '8px',
                    color: 'var(--workout-text)',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div 
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '4px',
                      border: selectedCategories.has(cat.id)
                        ? '2px solid var(--workout-green)'
                        : '2px solid var(--workout-border)',
                      backgroundColor: selectedCategories.has(cat.id)
                        ? 'var(--workout-green)'
                        : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#000',
                      fontSize: '14px',
                      fontWeight: 700,
                    }}
                  >
                    {selectedCategories.has(cat.id) && '✓'}
                  </div>
                  <span style={{ fontSize: '14px' }}>{cat.label}</span>
                </button>
              ))}
            </div>
          </div>
          
          {/* Error message */}
          {error && (
            <div style={{ 
              padding: '12px', 
              backgroundColor: 'rgba(239, 68, 68, 0.2)',
              borderRadius: '8px',
              color: 'var(--workout-red)',
              fontSize: '14px',
              marginBottom: '16px',
            }}>
              {error}
            </div>
          )}
        </div>
        
        <div className="workout-modal-footer">
          <button 
            className="workout-btn workout-btn-primary workout-btn-full"
            onClick={handleSubmit}
            disabled={isSubmitting}
            style={{ opacity: isSubmitting ? 0.5 : 1 }}
          >
            {isSubmitting ? 'Creating...' : 'Create Exercise'}
          </button>
        </div>
      </div>
    </div>
  );
}
