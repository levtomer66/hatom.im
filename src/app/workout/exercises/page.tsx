'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useWorkoutUser } from '@/context/WorkoutUserContext';
import { useWorkoutLanguage } from '@/context/WorkoutLanguageContext';
import { useWorkoutUnit } from '@/context/WorkoutUnitContext';
import { useCustomExercises } from '@/context/WorkoutCustomExercisesContext';
import { useT, getCategoryLabel } from '@/lib/workout-i18n';
import { getLocalizedExercise, getExerciseSearchNames } from '@/lib/exercise-translations';
import { formatWeight, getUnitSuffix } from '@/lib/weight';
import { formatSeconds } from '@/lib/time';
import Header from '@/components/workout/Header';
import BottomNav from '@/components/workout/BottomNav';
import ExercisePhoto from '@/components/workout/ExercisePhoto';
import AddExerciseForm from '@/components/workout/AddExerciseForm';
import { PersonalBest, ExerciseCategory, EXERCISE_FILTER_CATEGORIES, WorkoutType } from '@/types/workout';
import { EXERCISE_LIBRARY } from '@/data/exercise-library';

const MUSCLE_GROUP_IDS: ExerciseCategory[] = [
  'chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms', 'legs', 'abs', 'glutes',
];

export default function ExercisesPage() {
  const router = useRouter();
  const { currentUser, isLoading } = useWorkoutUser();
  useEffect(() => {
    if (!isLoading && !currentUser) {
      router.replace('/login?from=/workout/exercises');
    }
  }, [isLoading, currentUser, router]);
  const { language } = useWorkoutLanguage();
  const { unit } = useWorkoutUnit();
  const { customExercises, addCustomExercise, ensureLoaded, setRetired } = useCustomExercises();
  const t = useT();
  const unitSuffix = getUnitSuffix(unit, language);

  const [personalBests, setPersonalBests] = useState<Record<string, PersonalBest>>({});
  const [showAddForm, setShowAddForm] = useState(false);
  const [showRemoved, setShowRemoved] = useState(false);
  const [restoringId, setRestoringId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [muscleFilters, setMuscleFilters] = useState<Set<ExerciseCategory>>(new Set());
  // Top-category filters (Push / Pull / Legs / Calisthenics) — kept here
  // for consistency with the picker modal so users see the same filter
  // shape across screens (B8).
  const [topCategoryFilters, setTopCategoryFilters] = useState<Set<WorkoutType>>(new Set());

  const toggleTopCategory = (c: WorkoutType) =>
    setTopCategoryFilters((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });

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

  useEffect(() => {
    fetchPersonalBests();
  }, [fetchPersonalBests]);

  // Load the user's custom exercises (no-op if the /workout page already
  // seeded them from the bootstrap).
  useEffect(() => {
    ensureLoaded();
  }, [ensureLoaded]);

  // Toggle muscle filter
  const toggleMuscleFilter = (muscleId: ExerciseCategory) => {
    setMuscleFilters(prev => {
      const next = new Set(prev);
      if (next.has(muscleId)) {
        next.delete(muscleId);
      } else {
        next.add(muscleId);
      }
      return next;
    });
  };

  // The exercise catalogue: the code-defined library plus the user's ACTIVE
  // custom exercises (retired ones are hidden from the browse list).
  const allExercises = useMemo(() => {
    return [...EXERCISE_LIBRARY, ...customExercises.filter((e) => !e.retired)];
  }, [customExercises]);

  // Retired (soft-deleted) customs — surfaced in a collapsible section below so
  // they stay restorable even when they have no workout history to reach them
  // from.
  const retiredCustoms = useMemo(
    () => customExercises.filter((e) => e.retired),
    [customExercises],
  );

  const handleRestore = async (id: string) => {
    setRestoringId(id);
    try {
      const res = await fetch(`/api/workout/exercises/custom?id=${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ retired: false }),
      });
      if (res.ok) setRetired(id, false);
    } catch (error) {
      console.error('Error restoring custom exercise:', error);
    } finally {
      setRestoringId(null);
    }
  };

  // Filter exercises by muscle group and search (matches English or Hebrew name)
  const filteredExercises = useMemo(() => {
    return allExercises.filter(exercise => {
      if (topCategoryFilters.size > 0) {
        const matchesTop = exercise.categories.some(cat => topCategoryFilters.has(cat as WorkoutType));
        if (!matchesTop) return false;
      }
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
  }, [allExercises, search, muscleFilters, topCategoryFilters]);

  // Sort exercises: those with PBs first, custom next, then alphabetically
  const sortedExercises = useMemo(() => {
    return [...filteredExercises].sort((a, b) => {
      const aPB = personalBests[a.id];
      const bPB = personalBests[b.id];
      
      // PBs first
      if (aPB && !bPB) return -1;
      if (!aPB && bPB) return 1;
      
      // Custom next
      if (a.isCustom && !b.isCustom) return -1;
      if (!a.isCustom && b.isCustom) return 1;
      
      return a.name.localeCompare(b.name);
    });
  }, [filteredExercises, personalBests]);

  // Loading / mid-redirect — render the shell so the page doesn't collapse
  // to a bare spinner (B11).
  if (isLoading || !currentUser) {
    return (
      <main className="workout-main">
        <Header title={t('exercises.title')} />
        <div className="workout-page">
          <div className="loading-spinner" />
        </div>
        <BottomNav />
      </main>
    );
  }

  return (
    <main className="workout-main">
      <Header title={t('exercises.title')} />

      <div className="workout-page">
        {/* Search and Add */}
        <div style={{ marginBottom: '12px', display: 'flex', gap: '8px' }}>
          <input
            type="text"
            className="workout-input"
            placeholder={t('picker.search')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ flex: 1 }}
          />
          <button
            type="button"
            className="workout-btn workout-btn-secondary"
            onClick={() => setShowAddForm(true)}
            style={{ flex: '0 0 auto', whiteSpace: 'nowrap' }}
          >
            {t('picker.create_custom')}
          </button>
        </div>

        {/* Top-category filters (Push / Pull / Legs / Calisthenics) —
            match the picker for B8 consistency. */}
        <div className="category-filter-row" style={{ marginBottom: '8px' }}>
          {EXERCISE_FILTER_CATEGORIES.slice(0, 4).map(category => {
            const label = getCategoryLabel(category.id, language);
            const active = topCategoryFilters.has(category.id);
            return (
              <button
                key={category.id}
                className={`category-filter-btn ${active ? 'active' : ''}`}
                onClick={() => toggleTopCategory(category.id)}
                aria-pressed={active}
                aria-label={label}
              >
                <span aria-hidden="true">{category.icon}</span>
                <span>{label}</span>
              </button>
            );
          })}
        </div>

        {/* Muscle group filters */}
        <div className="muscle-filter-row" style={{ marginBottom: '16px' }}>
          {MUSCLE_GROUP_IDS.map(muscleId => {
            const label = getCategoryLabel(muscleId, language);
            const active = muscleFilters.has(muscleId);
            return (
              <button
                key={muscleId}
                className={`muscle-filter-btn ${active ? 'active' : ''}`}
                onClick={() => toggleMuscleFilter(muscleId)}
                aria-pressed={active}
                aria-label={label}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Exercise list */}
        <div>
          {sortedExercises.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🔍</div>
              <div className="empty-state-text">{t('picker.none_found')}</div>
            </div>
          ) : (
            sortedExercises.map(exercise => {
              const pb = personalBests[exercise.id];
              const listName = getLocalizedExercise(exercise, language).name;
              
              return (
                <div
                  key={exercise.id}
                  className="history-item"
                  onClick={() => router.push(`/workout/exercises/${exercise.id}`)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <ExercisePhoto
                      src={exercise.defaultPhoto}
                      /* decorative: the visible name label below carries the
                         accessible name, so alt="" (the default) avoids a
                         double screen-reader announcement. */
                      style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '8px',
                        fontSize: '20px',
                        flexShrink: 0,
                      }}
                    />
                    <div className="history-item-info">
                      <div className="history-item-type">
                        {listName}
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                        {pb && pb.bestE1rm !== null && pb.bestKg !== null && pb.bestReps !== null && (
                          <span style={{ fontSize: '13px', color: 'var(--workout-gold)' }}>
                            🥇 {formatWeight(pb.bestKg, unit)}{unitSuffix} × {pb.bestReps}
                            {' '}
                            <span style={{ color: 'var(--workout-text-muted)' }}>
                              (e1RM ≈ {formatWeight(Math.round(pb.bestE1rm), unit)}{unitSuffix})
                            </span>
                          </span>
                        )}
                        {pb && pb.bestE1rm === null && pb.currentKg > 0 && (
                          <span style={{ fontSize: '13px', color: 'var(--workout-text-secondary)' }}>
                            💪 {formatWeight(pb.currentKg, unit)}{unitSuffix}: {pb.currentReps.join('×')}
                          </span>
                        )}
                        {pb && (pb.bestE1rm !== null || pb.currentKg > 0) && (
                          <span style={{
                            fontSize: '12px',
                            color: 'var(--workout-accent)',
                            backgroundColor: 'rgba(251, 191, 36, 0.15)',
                            padding: '2px 6px',
                            borderRadius: '4px',
                          }}>
                            {language === 'he' ? 'הבא' : 'Next'}: {formatWeight(pb.recommendedKg, unit)}{unitSuffix}
                          </span>
                        )}
                        {pb && typeof pb.bestSeconds === 'number' && pb.bestSeconds > 0 && pb.bestSecondsKg !== null && (
                          <span style={{ fontSize: '13px', color: 'var(--workout-blue)' }}>
                            ⏱ {pb.bestSecondsKg > 0
                              ? `${formatWeight(pb.bestSecondsKg, unit)}${unitSuffix}`
                              : t('card.bw_label')}{' × '}
                            {formatSeconds(pb.bestSeconds)}
                          </span>
                        )}
                        {exercise.isCustom && (
                          <span style={{
                            fontSize: '12px',
                            color: 'var(--workout-blue)',
                            backgroundColor: 'rgba(59, 130, 246, 0.2)',
                            padding: '2px 6px',
                            borderRadius: '4px',
                          }}>
                            {t('picker.custom_badge')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <span style={{ fontSize: '20px', color: 'var(--workout-text-muted)' }}>›</span>
                </div>
              );
            })
          )}
        </div>

        {/* Removed (soft-deleted) custom exercises — collapsible, restorable.
            Lives here so a retired custom with no workout history is still
            reachable to bring back. */}
        {retiredCustoms.length > 0 && (
          <div style={{ marginTop: '28px' }}>
            <button
              type="button"
              onClick={() => setShowRemoved((v) => !v)}
              aria-expanded={showRemoved}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'none',
                border: 'none',
                padding: '8px 0',
                cursor: 'pointer',
                color: 'var(--workout-text-muted)',
                fontSize: '13px',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                textAlign: 'start',
              }}
            >
              <span aria-hidden="true">{showRemoved ? '▾' : '▸'}</span>
              {t('exercises.removed_section')} ({retiredCustoms.length})
            </button>

            {showRemoved && retiredCustoms.map((ex) => (
              <div key={ex.id} className="history-item">
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, cursor: 'pointer', minWidth: 0 }}
                  onClick={() => router.push(`/workout/exercises/${ex.id}`)}
                >
                  <ExercisePhoto
                    src={ex.defaultPhoto}
                    style={{ width: '40px', height: '40px', borderRadius: '8px', fontSize: '18px', flexShrink: 0, opacity: 0.7 }}
                  />
                  <div className="history-item-info" style={{ minWidth: 0 }}>
                    <div className="history-item-type" style={{ color: 'var(--workout-text-muted)' }}>
                      {getLocalizedExercise(ex, language).name}
                    </div>
                  </div>
                </div>
                <button
                  className="workout-btn workout-btn-secondary"
                  style={{ padding: '6px 12px', fontSize: '12px', flexShrink: 0, opacity: restoringId === ex.id ? 0.5 : 1 }}
                  onClick={() => handleRestore(ex.id)}
                  disabled={restoringId === ex.id}
                >
                  {t('customex.restore')}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <AddExerciseForm
        isOpen={showAddForm}
        onClose={() => setShowAddForm(false)}
        onCreated={(exercise) => {
          addCustomExercise(exercise);
          setShowAddForm(false);
          router.push(`/workout/exercises/${exercise.id}`);
        }}
      />

      <BottomNav />
    </main>
  );
}
