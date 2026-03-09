'use client';

import React from 'react';
import { WorkoutTemplate, ExerciseDefinition } from '@/types/workout';

interface TemplateSelectorProps {
  isOpen: boolean;
  templates: WorkoutTemplate[];
  exerciseMap: Record<string, ExerciseDefinition>;
  onClose: () => void;
  onSelect: (template: WorkoutTemplate) => void;
  onEdit: (template: WorkoutTemplate) => void;
  onDelete: (template: WorkoutTemplate) => void;
  onCreateNew: () => void;
}

export default function TemplateSelector({
  isOpen,
  templates,
  exerciseMap,
  onClose,
  onSelect,
  onEdit,
  onDelete,
  onCreateNew,
}: TemplateSelectorProps) {
  if (!isOpen) return null;

  return (
    <div className="workout-modal-overlay" onClick={onClose}>
      <div className="workout-modal" onClick={(e) => e.stopPropagation()}>
        <div className="workout-modal-header">
          <h2 className="workout-modal-title">Start Workout</h2>
          <button className="workout-modal-close" onClick={onClose}>
            ✕
          </button>
        </div>
        
        <div className="workout-modal-body">
          {templates.length === 0 ? (
            <div className="empty-state" style={{ padding: '32px 16px' }}>
              <div className="empty-state-icon">📋</div>
              <div className="empty-state-text">
                No workouts created yet
              </div>
              <button
                className="workout-btn workout-btn-primary"
                onClick={onCreateNew}
                style={{ marginTop: '16px' }}
              >
                + Create Your First Workout
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {templates.map(template => {
                const exerciseNames = template.exerciseIds
                  .slice(0, 3)
                  .map(id => exerciseMap[id]?.name || 'Unknown')
                  .join(', ');
                const moreCount = template.exerciseIds.length > 3 
                  ? ` +${template.exerciseIds.length - 3} more` 
                  : '';

                return (
                  <div
                    key={template.id}
                    className="workout-card"
                    style={{ 
                      padding: '16px',
                      margin: 0,
                      cursor: 'pointer',
                      transition: 'transform 0.1s, border-color 0.2s',
                    }}
                  >
                    <div 
                      onClick={() => onSelect(template)}
                      style={{ flex: 1 }}
                    >
                      <div style={{ 
                        fontSize: '16px', 
                        fontWeight: 700,
                        marginBottom: '4px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}>
                        🏋️ {template.name}
                      </div>
                      <div style={{ 
                        fontSize: '13px', 
                        color: 'var(--workout-text-secondary)',
                        marginBottom: '8px',
                      }}>
                        {template.exerciseIds.length} exercise{template.exerciseIds.length !== 1 ? 's' : ''}
                      </div>
                      {exerciseNames && (
                        <div style={{ 
                          fontSize: '12px', 
                          color: 'var(--workout-text-muted)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {exerciseNames}{moreCount}
                        </div>
                      )}
                    </div>
                    <div style={{ 
                      display: 'flex', 
                      gap: '8px',
                      marginTop: '12px',
                      justifyContent: 'space-between',
                    }}>
                      <button
                        className="workout-btn workout-btn-primary"
                        onClick={() => onSelect(template)}
                        style={{ flex: 1, padding: '10px 16px', fontSize: '14px' }}
                      >
                        Start
                      </button>
                      <button
                        className="workout-btn workout-btn-secondary"
                        onClick={(e) => { e.stopPropagation(); onEdit(template); }}
                        style={{ padding: '10px 14px', fontSize: '14px' }}
                      >
                        ✏️
                      </button>
                      <button
                        className="exercise-card-action"
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          if (confirm(`Delete "${template.name}"?`)) {
                            onDelete(template);
                          }
                        }}
                        style={{ 
                          backgroundColor: 'var(--workout-red)', 
                          color: 'white',
                        }}
                      >
                        🗑
                      </button>
                    </div>
                  </div>
                );
              })}

              {/* Create new workout button */}
              <button
                className="workout-btn workout-btn-secondary workout-btn-full"
                onClick={onCreateNew}
                style={{ marginTop: '8px' }}
              >
                + Create New Workout
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
