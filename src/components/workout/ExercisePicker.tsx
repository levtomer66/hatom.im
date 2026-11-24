'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { ExerciseDefinition, ExerciseCategory, EXERCISE_FILTER_CATEGORIES } from '@/types/workout';
import { EXERCISE_LIBRARY } from '@/data/exercise-library';
import { getLocalizedExercise, getExerciseSearchNames } from '@/lib/exercise-translations';
import { useWorkoutLanguage } from '@/context/WorkoutLanguageContext';
import { useCustomExercises } from '@/context/WorkoutCustomExercisesContext';
import { useT, getCategoryLabel } from '@/lib/workout-i18n';
import ExercisePhoto from './ExercisePhoto';
import AddExerciseForm from './AddExerciseForm';
import HowToModal from './HowToModal';
import GymSwitch from './GymSwitch';
import { GYM_MACHINES, BRAND_LABELS, machinesForGym } from '@/data/gym-machines';
import { GYM_BARS } from '@/data/gym-bars';
import { useCurrentGym } from '@/lib/workout-gym';
import { fuzzySearch, SearchDoc } from '@/lib/exercise-search';
import {
  MERGED_AWAY, RENAMED_SINGLES, movementIndex, variantTagLabels, tagLabel, Movement,
} from '@/data/exercise-movements';

// PROTOTYPE: one picker row = one movement; its variants are chips.
interface MovementGroup {
  key: string;
  name: string;
  movement: Movement | null;
  variants: ExerciseDefinition[];
}

const MOVEMENT_INDEX = movementIndex();

// Muscle group filter IDs (labels come from getCategoryLabel in the render).
const MUSCLE_GROUP_IDS: ExerciseCategory[] = [
  'chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms', 'legs', 'abs', 'glutes',
];

interface ExercisePickerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (exercises: ExerciseDefinition[]) => void;
  excludeIds?: string[];
  // When true, picker behaves as single-select: tapping a row commits
  // onSelect([one]) immediately and closes. Used by the replace flow so
  // the user doesn't have to tap twice (select → confirm) for one swap.
  replaceMode?: boolean;
  // Only library exercises: no customs, no "new custom exercise" button. Used
  // when replacing a custom exercise with a built-in one.
  builtInOnly?: boolean;
  // Overrides the modal title.
  title?: string;
}

export default function ExercisePicker({
  isOpen,
  onClose,
  onSelect,
  excludeIds = [],
  replaceMode = false,
  builtInOnly = false,
  title,
}: ExercisePickerProps) {
  const { language } = useWorkoutLanguage();
  const { customExercises, addCustomExercise, ensureLoaded } = useCustomExercises();
  const t = useT();
  const [search, setSearch] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [muscleFilters, setMuscleFilters] = useState<Set<string>>(new Set());
  const [categoryFilters, setCategoryFilters] = useState<Set<ExerciseCategory>>(new Set());
  const [showAddForm, setShowAddForm] = useState(false);
  // PROTOTYPE: the photo plays the how-to instead of selecting the row.
  const [howTo, setHowTo] = useState<ExerciseDefinition | null>(null);
  // PROTOTYPE: machine grid. 'machines' shows the gym's machine tiles and
  // 'bars' the bar / attachment tiles; tapping one sets machineId and lists
  // only its exercises.
  const [view, setView] = useState<'machines' | 'bars' | 'all'>('machines');
  const [machineId, setMachineId] = useState<string | null>(null);
  const [gymId] = useCurrentGym();
  const gymMachines = useMemo(() => machinesForGym(gymId), [gymId]);
  // The tapped tile (a machine or a bar), whose exercises the list shows.
  const activeTile = view === 'machines' ? gymMachines.find((m) => m.id === machineId) ?? null
    : view === 'bars' ? GYM_BARS.find((b) => b.id === machineId) ?? null
    : null;

  // Make sure the user's custom exercises are loaded whenever the picker opens
  // (no-op if the /workout page already seeded them from the bootstrap).
  useEffect(() => {
    if (isOpen) ensureLoaded();
  }, [isOpen, ensureLoaded]);

  // The catalogue is the code-defined library plus the user's ACTIVE custom
  // exercises (retired customs stay resolvable in history but aren't offered
  // for selection here).
  const allExercises = useMemo(() => {
    return [
      // PROTOTYPE: duplicates the review merges are hidden (history still resolves them).
      ...EXERCISE_LIBRARY.filter((e) => !(e.id in MERGED_AWAY)),
      ...(builtInOnly ? [] : customExercises.filter((e) => !e.retired)),
    ];
  }, [customExercises, builtInOnly]);

  // Exercises the current gym can't do: on some machine, but none of this
  // gym's. Exercises on no machine at all (mobility, skills) count as doable.
  const unavailableIds = useMemo(() => {
    const here = new Set(gymMachines.flatMap((m) => m.exerciseIds));
    const anywhere = new Set(GYM_MACHINES.flatMap((m) => m.exerciseIds));
    return new Set([...anywhere].filter((id) => !here.has(id)));
  }, [gymMachines]);

  const movementName = (m: Movement) => (language === 'he' ? m.nameHe : m.name);
  const singleName = (ex: ExerciseDefinition) => {
    const r = RENAMED_SINGLES[ex.id];
    if (r) return language === 'he' ? r.nameHe : r.name;
    return getLocalizedExercise(ex, language).name;
  };

  // Toggle muscle filter
  const toggleMuscleFilter = (muscleId: string) => {
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

  // Toggle category filter (Push/Pull/Legs)
  const toggleCategoryFilter = (categoryId: ExerciseCategory) => {
    setCategoryFilters(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  // Fuzzy-search corpus: names in every language, muscle labels in both
  // languages, and the names/aliases of every machine the exercise is on,
  // plus the current gym's names for them.
  const searchDocs = useMemo<SearchDoc[]>(() => {
    return allExercises.map((ex) => {
      const machines = GYM_MACHINES.filter((m) => m.exerciseIds.includes(ex.id));
      const mv = MOVEMENT_INDEX.get(ex.id);
      const renamed = RENAMED_SINGLES[ex.id];
      return {
        id: ex.id,
        texts: [
          mv ? (language === 'he' ? mv.movement.nameHe : mv.movement.name) : getLocalizedExercise(ex, language).name,
          ...(mv ? [mv.movement.name, mv.movement.nameHe,
            ...variantTagLabels(mv.variant.tags, 'en', mv.movement.id),
            ...variantTagLabels(mv.variant.tags, 'he', mv.movement.id)] : []),
          ...(renamed ? [renamed.name, renamed.nameHe] : []),
          getLocalizedExercise(ex, language).name,
          ...getExerciseSearchNames(ex),
          ...ex.categories.flatMap((c) => [getCategoryLabel(c, 'en'), getCategoryLabel(c, 'he'), c]),
          ...machines.flatMap((m) => [m.name, m.nameHe, BRAND_LABELS[m.brand], m.series ?? '', ...(m.aliases ?? [])]),
          ...GYM_BARS.filter((b) => b.exerciseIds.includes(ex.id)).flatMap((b) => [b.name, b.nameHe, ...(b.aliases ?? [])]),
          // The gym's own names for its machines ("Chest press by the window").
          ...gymMachines.filter((m) => m.exerciseIds.includes(ex.id)).flatMap((m) => [m.name, m.nameHe]),
        ],
      };
    });
  }, [allExercises, language, gymMachines]);

  const searching = search.trim().length > 0;

  // Filter exercises based on category filters, muscle filters, and search
  const filteredExercises = useMemo(() => {
    const available = allExercises.filter(e => !excludeIds.includes(e.id));
    if (search.trim()) {
      const byId = new Map(available.map(e => [e.id, e]));
      const ids = fuzzySearch(search, searchDocs.filter(d => byId.has(d.id)));
      return ids.map(id => byId.get(id)!);
    }
    if (activeTile) {
      const byId = new Map(available.map(e => [e.id, e]));
      return activeTile.exerciseIds
        .map(id => byId.get(id))
        .filter((e): e is ExerciseDefinition => e !== undefined);
    }
    return available.filter(exercise => {
      
      // Filter by category (Push/Pull/Legs) - if any selected
      if (categoryFilters.size > 0) {
        const matchesCategory = exercise.categories.some(cat => 
          categoryFilters.has(cat)
        );
        if (!matchesCategory) return false;
      }
      
      // Filter by muscle group: match against the exercise's categories,
      // not a name-prefix heuristic (which misses entries like "Active Hang"
      // or "Nordic Hamstring Curl" whose categories are set but whose English
      // name doesn't start with the muscle label).
      if (muscleFilters.size > 0) {
        const matchesMuscle = exercise.categories.some(cat => muscleFilters.has(cat));
        if (!matchesMuscle) return false;
      }
      
      return true;
    });
  }, [search, searchDocs, activeTile, excludeIds, allExercises, muscleFilters, categoryFilters]);

  // Sort: custom exercises first, then alphabetically. Search results keep
  // their relevance order and a machine keeps its own order.
  const sortedExercises = useMemo(() => {
    if (searching || (activeTile)) return filteredExercises;
    return [...filteredExercises].sort((a, b) => {
      // Custom exercises first
      if (a.isCustom && !b.isCustom) return -1;
      if (!a.isCustom && b.isCustom) return 1;
      // Then alphabetically
      return a.name.localeCompare(b.name);
    });
  }, [filteredExercises, searching, activeTile]);

  // Fold the variant list into movement rows, keeping the first-seen order
  // (relevance for search, machine order for a machine). The plain list is
  // re-sorted by movement name; custom exercises stay first.
  const groups = useMemo<MovementGroup[]>(() => {
    const out: MovementGroup[] = [];
    const byKey = new Map<string, MovementGroup>();
    for (const ex of sortedExercises) {
      const mv = ex.isCustom ? undefined : MOVEMENT_INDEX.get(ex.id);
      const key = mv ? `m:${mv.movement.id}` : `e:${ex.id}`;
      let g = byKey.get(key);
      if (!g) {
        g = { key, name: mv ? movementName(mv.movement) : singleName(ex), movement: mv?.movement ?? null, variants: [] };
        byKey.set(key, g);
        out.push(g);
      }
      g.variants.push(ex);
    }
    // Variants inside a movement follow the movement's own order.
    for (const g of out) {
      if (!g.movement) continue;
      const order = g.movement.variants.map((v) => v.exerciseId);
      g.variants.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
    }
    if (searching || (activeTile)) return out;
    return out.sort((a, b) => {
      const ac = a.variants[0].isCustom ? 0 : 1;
      const bc = b.variants[0].isCustom ? 0 : 1;
      return ac - bc || a.name.localeCompare(b.name, language);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedExercises, searching, view, activeTile, language]);

  const toggleSelection = (id: string) => {
    if (replaceMode) {
      // Single-select: commit immediately. No intermediate checkbox state
      // and no confirm button — one tap swaps and closes.
      const picked = allExercises.find(e => e.id === id);
      if (!picked) return;
      onSelect([picked]);
      setSelectedIds(new Set());
      setSearch('');
      setMuscleFilters(new Set());
      setCategoryFilters(new Set());
      setMachineId(null);
      onClose();
      return;
    }
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleConfirm = () => {
    const selected = allExercises.filter(e => selectedIds.has(e.id));
    onSelect(selected);
    setSelectedIds(new Set());
    setSearch('');
    setMuscleFilters(new Set());
    setCategoryFilters(new Set());
    setMachineId(null);
    onClose();
  };

  // A freshly created custom exercise is registered in the shared context so it
  // shows up everywhere, then immediately committed: in replace mode it swaps
  // straight in; otherwise it's pre-selected so one confirm tap adds it.
  const handleCustomCreated = (exercise: ExerciseDefinition) => {
    addCustomExercise(exercise);
    setShowAddForm(false);
    if (replaceMode) {
      onSelect([exercise]);
      setSearch('');
      setMuscleFilters(new Set());
      setCategoryFilters(new Set());
      setMachineId(null);
      onClose();
      return;
    }
    setSelectedIds(prev => new Set(prev).add(exercise.id));
  };

  const handleClose = () => {
    setSelectedIds(new Set());
    setSearch('');
    setMuscleFilters(new Set());
    setCategoryFilters(new Set());
    setMachineId(null);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="workout-modal-overlay" onClick={handleClose}>
        <div className="workout-modal" onClick={(e) => e.stopPropagation()}>
          <div className="workout-modal-header">
            <h2 className="workout-modal-title">{title ?? t(replaceMode ? 'picker.replace_title' : 'picker.title')}</h2>
            <button className="workout-modal-close" onClick={handleClose} aria-label={t('generic.close')}>
              ✕
            </button>
          </div>

          <div className="workout-modal-body">
            <div className="exercise-picker-search">
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  className="workout-input"
                  placeholder={t('picker.search')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  style={{ flex: 1 }}
                />
                {!builtInOnly && (
                  <button
                    type="button"
                    className="workout-btn workout-btn-secondary"
                    onClick={() => setShowAddForm(true)}
                    style={{ flex: '0 0 auto', whiteSpace: 'nowrap' }}
                  >
                    {t('picker.create_custom')}
                  </button>
                )}
              </div>

              {/* PROTOTYPE: Machines | Bars | All exercises */}
              <div className="picker-view-tabs" role="tablist">
                <button
                  type="button" role="tab" aria-selected={view === 'machines'}
                  className={`picker-view-tab ${view === 'machines' ? 'active' : ''}`}
                  onClick={() => { setView('machines'); setMachineId(null); }}
                >
                  🏋️ {t('picker.tab.machines')}
                </button>
                <button
                  type="button" role="tab" aria-selected={view === 'bars'}
                  className={`picker-view-tab ${view === 'bars' ? 'active' : ''}`}
                  onClick={() => { setView('bars'); setMachineId(null); }}
                >
                  🔗 {t('picker.tab.bars')}
                </button>
                <button
                  type="button" role="tab" aria-selected={view === 'all'}
                  className={`picker-view-tab ${view === 'all' ? 'active' : ''}`}
                  onClick={() => setView('all')}
                >
                  📋 {t('picker.tab.all')}
                </button>
              </div>

              {view === 'machines' && !searching && <GymSwitch />}
              {searching && <div className="picker-search-hint">{t('picker.search_hint')}</div>}

              {view === 'all' && !searching && (<>
              {/* Category filters (Push/Pull/Legs/Calisthenics) */}
              <div className="category-filter-row">
                {EXERCISE_FILTER_CATEGORIES.slice(0, 4).map(category => {
                  const label = getCategoryLabel(category.id, language);
                  return (
                    <button
                      key={category.id}
                      className={`category-filter-btn ${categoryFilters.has(category.id) ? 'active' : ''}`}
                      onClick={() => toggleCategoryFilter(category.id)}
                      aria-pressed={categoryFilters.has(category.id)}
                      aria-label={label}
                    >
                      <span aria-hidden="true">{category.icon}</span>
                      <span>{label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Muscle group filters */}
              <div className="muscle-filter-row">
                {MUSCLE_GROUP_IDS.map(muscleId => {
                  const label = getCategoryLabel(muscleId, language);
                  return (
                    <button
                      key={muscleId}
                      className={`muscle-filter-btn ${muscleFilters.has(muscleId) ? 'active' : ''}`}
                      onClick={() => toggleMuscleFilter(muscleId)}
                      aria-pressed={muscleFilters.has(muscleId)}
                      aria-label={label}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              </>)}
            </div>

            {!searching && activeTile && (
              <button type="button" className="machine-back-btn" onClick={() => setMachineId(null)}>
                {t(view === 'bars' ? 'picker.back_to_bars' : 'picker.back_to_machines')}
                <span className="machine-back-title">
                  {language === 'he' ? activeTile.nameHe : activeTile.name}
                </span>
              </button>
            )}

            {view === 'machines' && !searching && !activeTile ? (
              <div className="machine-grid">
                {gymMachines.map((m) => {
                  const count = m.exerciseIds.filter(id => !excludeIds.includes(id)).length;
                  return (
                    <button key={m.id} type="button" className="machine-tile" onClick={() => setMachineId(m.id)}>
                      <span className="machine-tile-photo">
                        {m.photo
                          // eslint-disable-next-line @next/next/no-img-element
                          ? <img src={m.photo} alt="" loading="lazy" />
                          : <span className="machine-tile-icon" aria-hidden="true">{m.icon}</span>}
                      </span>
                      <span className="machine-tile-name">{language === 'he' ? m.nameHe : m.name}</span>
                      {m.brand !== 'generic' && (
                        <span className="machine-tile-brand">{BRAND_LABELS[m.brand]}{m.series ? ` · ${m.series}` : ''}</span>
                      )}
                      <span className="machine-tile-count">{count} {t('picker.machine_count')}</span>
                    </button>
                  );
                })}
              </div>
            ) : view === 'bars' && !searching && !activeTile ? (
              <div className="bar-sections">
                {(['cable', 'free'] as const).map((kind) => (
                  <section key={kind} className="bar-section">
                    <h3 className="bar-section-title">{t(kind === 'cable' ? 'picker.bars.cable' : 'picker.bars.free')}</h3>
                    <div className="machine-grid">
                      {GYM_BARS.filter((b) => b.kind === kind).map((b) => {
                        const count = b.exerciseIds.filter(id => !excludeIds.includes(id) && !(id in MERGED_AWAY)).length;
                        return (
                          <button key={b.id} type="button" className="machine-tile bar-tile" onClick={() => setMachineId(b.id)}>
                            <span className="machine-tile-photo">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={b.photo} alt="" loading="lazy" />
                            </span>
                            <span className="machine-tile-name">{language === 'he' ? b.nameHe : b.name}</span>
                            <span className="machine-tile-count">{count} {t('picker.machine_count')}</span>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
            <div className="exercise-picker-grid">
              {groups.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-state-icon">🔍</div>
                  <div className="empty-state-text">{t('picker.none_found')}</div>
                </div>
              ) : (
                groups.map(group => {
                  // Inside a tile the machine / bar is the equipment already.
                  const tagOpts = {
                    skipEquipment: !!activeTile && !searching,
                    skipAttachment: view === 'bars' && !!activeTile && !searching,
                  };
                  const single = group.variants.length === 1;
                  const first = group.variants[0];
                  const singleTags = single && group.movement
                    ? variantTagLabels(MOVEMENT_INDEX.get(first.id)!.variant.tags, language, group.movement.id, tagOpts)
                    : [];
                  const anySelected = group.variants.some(v => selectedIds.has(v.id));
                  return (
                    <div
                      key={group.key}
                      className={`exercise-picker-item movement-row ${single && selectedIds.has(first.id) ? 'selected' : ''} ${single && unavailableIds.has(first.id) ? 'unavailable' : ''}`}
                      onClick={single ? () => toggleSelection(first.id) : undefined}
                    >
                      <button
                        type="button"
                        className="howto-thumb"
                        aria-label={t('howto.title')}
                        onClick={(e) => {
                          e.stopPropagation();
                          // The variant you picked, else the movement's first.
                          setHowTo(group.variants.find(v => selectedIds.has(v.id)) ?? first);
                        }}
                      >
                        <ExercisePhoto
                          className="exercise-picker-photo"
                          src={first.defaultPhoto}
                          /* decorative: name shown beside it; alt="" default */
                          objectFit={first.defaultPhoto?.startsWith("/workout/exercises/") ? "cover" : "contain"}
                          style={{
                            backgroundColor: 'var(--workout-bg-card)',
                            fontSize: '20px',
                          }}
                        />
                        <span className="howto-play-badge" aria-hidden="true">▶</span>
                      </button>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span className="exercise-picker-name">{group.name}</span>
                        {first.isCustom && (
                          <span className="movement-custom-badge">{t('picker.custom_badge')}</span>
                        )}
                        {single && singleTags.length > 0 && (
                          <span className="movement-tags">{singleTags.join(' · ')}</span>
                        )}
                        {!single && (
                          <div className="variant-chips" role="group" aria-label={group.name}>
                            {group.variants.map(ex => {
                              const info = MOVEMENT_INDEX.get(ex.id)!;
                              const label = (variantTagLabels(info.variant.tags, language, info.movement.id, tagOpts).join(' · ') || tagLabel(info.variant.tags.equipment, language));
                              const on = selectedIds.has(ex.id);
                              return (
                                <button
                                  key={ex.id}
                                  type="button"
                                  aria-pressed={on}
                                  title={getLocalizedExercise(ex, language).name}
                                  className={`variant-chip ${on ? 'active' : ''} ${unavailableIds.has(ex.id) ? 'unavailable' : ''}`}
                                  onClick={(e) => { e.stopPropagation(); toggleSelection(ex.id); }}
                                >
                                  {on && '✓ '}{label}
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      {single ? (
                        <div className="exercise-picker-check">
                          {selectedIds.has(first.id) && '✓'}
                        </div>
                      ) : (
                        <span className="variant-count">{anySelected ? '✓' : group.variants.length}</span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
            )}
          </div>
          
          {!replaceMode && (
            <div className="workout-modal-footer">
              <button
                className="workout-btn workout-btn-primary workout-btn-full"
                onClick={handleConfirm}
                disabled={selectedIds.size === 0}
                style={{ opacity: selectedIds.size === 0 ? 0.5 : 1 }}
              >
                {t('picker.add_selected_prefix')}{selectedIds.size > 0 ? ` ${selectedIds.size} ${selectedIds.size === 1 ? t('picker.add_selected_one') : t('picker.add_selected_many')}` : ` ${t('picker.add_selected_many')}`}
              </button>
            </div>
          )}
        </div>
      </div>

      {howTo && (
        <HowToModal
          exerciseId={howTo.id}
          title={getLocalizedExercise(howTo, language).name}
          photo={howTo.defaultPhoto}
          onClose={() => setHowTo(null)}
        />
      )}

      <AddExerciseForm
        isOpen={showAddForm}
        onClose={() => setShowAddForm(false)}
        onCreated={handleCustomCreated}
      />
    </>
  );
}
