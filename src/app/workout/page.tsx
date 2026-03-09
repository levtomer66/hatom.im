'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useWorkoutUser } from '@/context/WorkoutUserContext';
import LoginScreen from '@/components/workout/LoginScreen';
import Header from '@/components/workout/Header';
import BottomNav from '@/components/workout/BottomNav';
import ExerciseCard from '@/components/workout/ExerciseCard';
import ExercisePicker from '@/components/workout/ExercisePicker';
import TemplateSelector from '@/components/workout/TemplateSelector';
import TemplateEditor from '@/components/workout/TemplateEditor';
import { 
  Workout, 
  WorkoutExercise, 
  WorkoutTemplate,
  PersonalBest,
  ExerciseDefinition,
  createDefaultSets,
} from '@/types/workout';
import { EXERCISE_LIBRARY } from '@/data/exercise-library';
import { v4 as uuidv4 } from 'uuid';

export default function WorkoutsPage() {
  const { currentUser, isLoading } = useWorkoutUser();
  
  // State
  const [activeWorkout, setActiveWorkout] = useState<Workout | null>(null);
  const [templates, setTemplates] = useState<WorkoutTemplate[]>([]);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [showTemplateEditor, setShowTemplateEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<WorkoutTemplate | null>(null);
  const [showExercisePicker, setShowExercisePicker] = useState(false);
  const [personalBests, setPersonalBests] = useState<Record<string, PersonalBest>>({});
  const [customExercises, setCustomExercises] = useState<ExerciseDefinition[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false);
  const [hasInProgressWorkout, setHasInProgressWorkout] = useState(false);

  // Create exercise lookup map
  const exerciseMap = useMemo(() => {
    const map: Record<string, ExerciseDefinition> = {};
    EXERCISE_LIBRARY.forEach(e => { map[e.id] = e; });
    customExercises.forEach(e => { map[e.id] = e; });
    return map;
  }, [customExercises]);

  // Fetch personal bests
  const fetchPersonalBests = useCallback(async () => {
    if (!currentUser) return;
    
    try {
      const res = await fetch(`/api/workout/exercises/pb?userId=${currentUser.id}`);
      if (res.ok) {
        const data = await res.json();
        setPersonalBests(data);
      }
    } catch (error) {
      console.error('Error fetching PBs:', error);
    }
  }, [currentUser]);

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

  // Fetch workout templates
  const fetchTemplates = useCallback(async () => {
    if (!currentUser) return;
    
    try {
      const res = await fetch(`/api/workout/templates?userId=${currentUser.id}`);
      if (res.ok) {
        const data = await res.json();
        setTemplates(data);
      }
    } catch (error) {
      console.error('Error fetching templates:', error);
    }
  }, [currentUser]);

  // Auto-resume: Check for in-progress workout and automatically resume it
  const checkAndResumeWorkout = useCallback(async () => {
    if (!currentUser) {
      setInitialLoadDone(true);
      return;
    }
    
    try {
      // First check if there's a specific workout to resume (from History tab)
      const resumeWorkoutId = sessionStorage.getItem('resumeWorkoutId');
      if (resumeWorkoutId) {
        sessionStorage.removeItem('resumeWorkoutId');
        
        const res = await fetch(`/api/workout/workouts/${resumeWorkoutId}`);
        if (res.ok) {
          const workout = await res.json();
          // Resume if it belongs to current user (can resume both completed and in-progress)
          if (workout.userId === currentUser.id) {
            // If resuming a completed workout, mark it as not completed
            if (workout.isCompleted) {
              workout.isCompleted = false;
            }
            setActiveWorkout(workout);
            setHasInProgressWorkout(true);
            setInitialLoadDone(true);
            return;
          }
        }
      }
      
      // Otherwise, check for any in-progress workout and auto-resume
      const res = await fetch(`/api/workout/workouts?userId=${currentUser.id}`);
      if (res.ok) {
        const workouts = await res.json();
        const inProgressWorkout = workouts.find((w: Workout) => !w.isCompleted);
        
        if (inProgressWorkout) {
          setActiveWorkout(inProgressWorkout);
          setHasInProgressWorkout(true);
        } else {
          setHasInProgressWorkout(false);
        }
      }
    } catch (error) {
      console.error('Error checking workouts:', error);
    }
    
    setInitialLoadDone(true);
  }, [currentUser]);

  // Wait for user context to finish loading before checking resume
  useEffect(() => {
    if (isLoading) return; // Wait for user context
    
    fetchPersonalBests();
    fetchCustomExercises();
    fetchTemplates();
    checkAndResumeWorkout();
  }, [isLoading, fetchPersonalBests, fetchCustomExercises, fetchTemplates, checkAndResumeWorkout]);

  // Auto-save workout changes
  const saveWorkout = useCallback(async (workout: Workout) => {
    if (!workout.id) return;
    
    setIsSaving(true);
    try {
      await fetch(`/api/workout/workouts/${workout.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(workout),
      });
    } catch (error) {
      console.error('Error saving workout:', error);
    } finally {
      setIsSaving(false);
    }
  }, []);

  // Debounced save
  useEffect(() => {
    if (!activeWorkout) return;
    
    const timeoutId = setTimeout(() => {
      saveWorkout(activeWorkout);
    }, 500);
    
    return () => clearTimeout(timeoutId);
  }, [activeWorkout, saveWorkout]);

  // Start new workout from template
  const startWorkoutFromTemplate = async (template: WorkoutTemplate) => {
    if (!currentUser) return;
    
    try {
      // Create exercises from template's exercise IDs with order
      const exercises: WorkoutExercise[] = template.exerciseIds.map((exerciseId, index) => ({
        id: uuidv4(),
        exerciseId,
        order: index + 1,  // 1-based order
        sets: createDefaultSets(),
        notes: '',
        photos: [],
      }));

      const res = await fetch('/api/workout/workouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.id,
          templateId: template.id,
          workoutName: template.name,
          date: new Date().toISOString().split('T')[0],
        }),
      });
      
      if (res.ok) {
        const workout = await res.json();
        // Add the exercises from the template
        workout.exercises = exercises;
        setActiveWorkout(workout);
        setHasInProgressWorkout(true);
        setShowTemplateSelector(false);
      }
    } catch (error) {
      console.error('Error starting workout:', error);
    }
  };

  // Handle template save (create or update)
  const handleTemplateSave = (template: WorkoutTemplate) => {
    setTemplates(prev => {
      const existing = prev.findIndex(t => t.id === template.id);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = template;
        return updated;
      }
      return [template, ...prev];
    });
  };

  // Handle template delete
  const handleTemplateDelete = async (template: WorkoutTemplate) => {
    try {
      const res = await fetch(`/api/workout/templates/${template.id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setTemplates(prev => prev.filter(t => t.id !== template.id));
      }
    } catch (error) {
      console.error('Error deleting template:', error);
    }
  };

  // Complete workout (end it)
  const completeWorkout = async () => {
    if (!activeWorkout) return;
    
    const updated = { ...activeWorkout, isCompleted: true };
    await saveWorkout(updated);
    setActiveWorkout(null);
    setHasInProgressWorkout(false);
    fetchPersonalBests(); // Refresh PBs after completing workout
  };

  // Add exercises
  const addExercises = (exerciseDefs: ExerciseDefinition[]) => {
    if (!activeWorkout) return;
    
    // Start order from current exercise count + 1
    const startOrder = activeWorkout.exercises.length + 1;
    
    const newExercises: WorkoutExercise[] = exerciseDefs.map((def, index) => ({
      id: uuidv4(),
      exerciseId: def.id,
      order: startOrder + index,  // Continues from current order
      sets: createDefaultSets(),  // Creates 3 sets by default
      notes: '',
      photos: [],
    }));
    
    setActiveWorkout({
      ...activeWorkout,
      exercises: [...activeWorkout.exercises, ...newExercises],
    });
  };

  // Update exercise
  const updateExercise = (index: number, exercise: WorkoutExercise) => {
    if (!activeWorkout) return;
    
    const exercises = [...activeWorkout.exercises];
    exercises[index] = exercise;
    setActiveWorkout({ ...activeWorkout, exercises });
  };

  // Remove exercise
  const removeExercise = (index: number) => {
    if (!activeWorkout) return;
    
    const exercises = activeWorkout.exercises.filter((_, i) => i !== index);
    setActiveWorkout({ ...activeWorkout, exercises });
  };

  // Loading state
  if (isLoading || !initialLoadDone) {
    return (
      <main className="workout-main">
        <div className="loading-spinner" />
      </main>
    );
  }

  // Not logged in
  if (!currentUser) {
    return <LoginScreen />;
  }

  return (
    <main className="workout-main">
      <Header 
        title={activeWorkout ? `🏋️ ${activeWorkout.workoutName}` : 'Workouts'} 
      />
      
      <div className="workout-page">
        {!activeWorkout ? (
          // No active workout - show start button
          <div style={{ textAlign: 'center', paddingTop: '40px' }}>
            <div style={{ fontSize: '64px', marginBottom: '24px' }}>🏋️</div>
            <h2 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '8px' }}>
              Ready to train?
            </h2>
            <p style={{ color: 'var(--workout-text-secondary)', marginBottom: '32px' }}>
              {hasInProgressWorkout 
                ? 'You have an in-progress workout. It will auto-resume.'
                : templates.length > 0 
                  ? 'Select a workout to start training'
                  : 'Create your first workout to get started'}
            </p>
            <button 
              className="workout-btn workout-btn-primary workout-btn-large"
              onClick={() => setShowTemplateSelector(true)}
            >
              {templates.length > 0 ? 'Start Workout' : 'Create Workout'}
            </button>
            <p style={{ 
              color: 'var(--workout-text-muted)', 
              marginTop: '24px',
              fontSize: '14px',
            }}>
              Tap a workout in History to resume it
            </p>
          </div>
        ) : (
          // Active workout
          <>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '16px',
              padding: '12px 16px',
              backgroundColor: 'var(--workout-bg-card)',
              borderRadius: '12px',
            }}>
              <div>
                <div style={{ fontSize: '14px', color: 'var(--workout-text-secondary)' }}>
                  {new Date(activeWorkout.date).toLocaleDateString('en-US', {
                    weekday: 'long',
                    month: 'short',
                    day: 'numeric',
                  })}
                </div>
                <div style={{ 
                  fontSize: '12px', 
                  color: isSaving ? 'var(--workout-gold)' : 'var(--workout-green)',
                  marginTop: '4px',
                }}>
                  {isSaving ? 'Saving...' : '✓ Auto-saved'}
                </div>
              </div>
              <button 
                className="workout-btn workout-btn-primary"
                onClick={completeWorkout}
                style={{ padding: '10px 20px', fontSize: '14px', fontWeight: 600 }}
              >
                ✓ Complete
              </button>
            </div>

            {/* Exercise cards */}
            {activeWorkout.exercises.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📋</div>
                <div className="empty-state-text">
                  No exercises yet. Add some to get started!
                </div>
              </div>
            ) : (
              activeWorkout.exercises.map((exercise, index) => (
                <ExerciseCard
                  key={exercise.id}
                  exercise={exercise}
                  exerciseDefinition={exerciseMap[exercise.exerciseId] || null}
                  pb={personalBests[exercise.exerciseId] || null}
                  mode="edit"
                  onUpdate={(updated) => updateExercise(index, updated)}
                  onRemove={() => removeExercise(index)}
                />
              ))
            )}

            {/* Add exercise button */}
            <button 
              className="workout-btn workout-btn-secondary workout-btn-full"
              onClick={() => setShowExercisePicker(true)}
              style={{ marginTop: '16px' }}
            >
              + Add Exercise
            </button>
          </>
        )}
      </div>

      <BottomNav />

      {/* Modals */}
      <TemplateSelector
        isOpen={showTemplateSelector}
        templates={templates}
        exerciseMap={exerciseMap}
        onClose={() => setShowTemplateSelector(false)}
        onSelect={(template) => {
          startWorkoutFromTemplate(template);
        }}
        onEdit={(template) => {
          setEditingTemplate(template);
          setShowTemplateSelector(false);
          setShowTemplateEditor(true);
        }}
        onDelete={handleTemplateDelete}
        onCreateNew={() => {
          setEditingTemplate(null);
          setShowTemplateSelector(false);
          setShowTemplateEditor(true);
        }}
      />

      <TemplateEditor
        isOpen={showTemplateEditor}
        template={editingTemplate}
        onClose={() => {
          setShowTemplateEditor(false);
          setEditingTemplate(null);
        }}
        onSave={handleTemplateSave}
      />

      {activeWorkout && (
        <ExercisePicker
          isOpen={showExercisePicker}
          onClose={() => setShowExercisePicker(false)}
          onSelect={addExercises}
          excludeIds={activeWorkout.exercises.map(e => e.exerciseId)}
        />
      )}
    </main>
  );
}
