'use client';

import React from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import ExerciseCard from './ExerciseCard';
import { WorkoutExercise, ExerciseDefinition, PersonalBest } from '@/types/workout';

interface SortableExerciseCardProps {
  id: string;
  exercise: WorkoutExercise;
  exerciseDefinition?: ExerciseDefinition | null;
  pb?: PersonalBest | null;
  onUpdate: (exercise: WorkoutExercise) => void;
  onRemove: () => void;
}

// Thin wrapper that keeps ExerciseCard itself dnd-kit-agnostic. Each active-workout
// exercise is wrapped in one of these so `id` drives the sortable identity.
export default function SortableExerciseCard({
  id,
  exercise,
  exerciseDefinition,
  pb,
  onUpdate,
  onRemove,
}: SortableExerciseCardProps) {
  const {
    setNodeRef,
    attributes,
    listeners,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  return (
    <ExerciseCard
      exercise={exercise}
      exerciseDefinition={exerciseDefinition}
      pb={pb}
      mode="edit"
      onUpdate={onUpdate}
      onRemove={onRemove}
      draggable={{
        setNodeRef,
        handleAttributes: attributes as unknown as Record<string, unknown>,
        handleListeners: listeners as unknown as Record<string, unknown> | undefined,
        style: {
          transform: CSS.Transform.toString(transform),
          transition,
          opacity: isDragging ? 0.6 : undefined,
          zIndex: isDragging ? 10 : undefined,
        },
        isDragging,
      }}
    />
  );
}
