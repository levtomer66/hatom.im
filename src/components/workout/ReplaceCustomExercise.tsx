'use client';

// "Replace with a built-in exercise" for a custom exercise: suggests the
// closest library exercises by name, or any via the picker, shows how much
// history will move, then calls POST /api/workout/exercises/custom/replace
// (workouts, templates, gear setting and PBs move; the custom is retired).

import React, { useEffect, useMemo, useState } from 'react';
import { ExerciseDefinition } from '@/types/workout';
import { EXERCISE_LIBRARY, getExerciseById } from '@/data/exercise-library';
import { MERGED_AWAY } from '@/data/exercise-movements';
import { getLocalizedExercise, getExerciseSearchNames } from '@/lib/exercise-translations';
import { fuzzySearch, SearchDoc } from '@/lib/exercise-search';
import { useWorkoutLanguage } from '@/context/WorkoutLanguageContext';
import { useT, workoutCount, templateCount } from '@/lib/workout-i18n';
import ExercisePhoto from './ExercisePhoto';
import ExercisePicker from './ExercisePicker';

const LIBRARY = EXERCISE_LIBRARY.filter((e) => !(e.id in MERGED_AWAY));
const DOCS: SearchDoc[] = LIBRARY.map((ex) => ({
  id: ex.id,
  texts: [
    getLocalizedExercise(ex, 'en').name,
    getLocalizedExercise(ex, 'he').name,
    ...getExerciseSearchNames(ex),
  ],
}));

/** Up to `n` library exercises whose names look like `name`: all words first, then any one word. */
export function suggestBuiltIns(name: string, n = 3): string[] {
  const out: string[] = [];
  const add = (ids: string[]) => {
    for (const id of ids) if (out.length < n && !out.includes(id)) out.push(id);
  };
  add(fuzzySearch(name, DOCS));
  if (out.length < n) {
    const words = name.split(/\s+/).filter((w) => w.length >= 3).sort((a, b) => b.length - a.length);
    for (const w of words) add(fuzzySearch(w, DOCS));
  }
  return name.trim() ? out : [];
}

interface Props {
  custom: ExerciseDefinition;
  onReplaced: (targetId: string) => void;
}

export default function ReplaceCustomExercise({ custom, onReplaced }: Props) {
  const { language } = useWorkoutLanguage();
  const t = useT();
  const [open, setOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [target, setTarget] = useState<ExerciseDefinition | null>(null);
  const [counts, setCounts] = useState<{ workouts: number; templates: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  const suggestions = useMemo(
    () => suggestBuiltIns(custom.name).map((id) => getExerciseById(id)).filter((e): e is ExerciseDefinition => !!e),
    [custom.name],
  );

  // Another custom in the same instance: its own counts, not the last one's.
  useEffect(() => { setCounts(null); }, [custom.id]);

  useEffect(() => {
    if (!open || counts) return;
    let alive = true;
    fetch(`/api/workout/exercises/custom/replace?id=${encodeURIComponent(custom.id)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((c) => { if (alive && c) setCounts(c); })
      .catch(() => {});
    return () => { alive = false; };
  }, [open, counts, custom.id]);

  const close = () => {
    if (busy) return;
    setOpen(false);
    setTarget(null);
    setError(false);
  };

  const replace = async () => {
    if (!target) return;
    setBusy(true);
    setError(false);
    try {
      const res = await fetch('/api/workout/exercises/custom/replace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: custom.id, targetId: target.id }),
      });
      if (!res.ok) throw new Error(String(res.status));
      const data = await res.json();
      onReplaced(data.targetId ?? target.id);
    } catch {
      setError(true);
      setBusy(false);
    }
  };

  const name = (e: ExerciseDefinition) => getLocalizedExercise(e, language).name;
  const countsText = counts
    ? t('customex.replace_counts')
      .replace('{w}', workoutCount(counts.workouts, language))
      .replace('{t}', templateCount(counts.templates, language))
    : t('generic.loading');

  return (
    <>
      <button
        type="button"
        className="workout-btn workout-btn-secondary replace-custom-btn"
        onClick={() => setOpen(true)}
      >
        🔁 {t('customex.replace')}
      </button>

      {open && (
        <div className="workout-modal-overlay" onClick={close}>
          <div className="workout-modal replace-custom-modal" onClick={(e) => e.stopPropagation()}>
            <div className="workout-modal-header">
              <h2 className="workout-modal-title">
                {target ? t('customex.replace_confirm_title') : t('customex.replace_title')}
              </h2>
              <button className="workout-modal-close" onClick={close} aria-label={t('generic.close')}>✕</button>
            </div>
            <div className="workout-modal-body">
              {!target ? (
                <>
                  <p className="replace-custom-intro">{t('customex.replace_intro')}</p>
                  <div className="replace-custom-from">
                    <ExercisePhoto src={custom.defaultPhoto} className="replace-custom-photo" />
                    <strong>{custom.name}</strong>
                  </div>
                  <h3 className="replace-custom-label">{t('customex.replace_suggested')}</h3>
                  {suggestions.length === 0 && <p className="replace-custom-muted">{t('customex.replace_none')}</p>}
                  <div className="replace-custom-list">
                    {suggestions.map((ex) => (
                      <button key={ex.id} type="button" className="replace-custom-option" onClick={() => setTarget(ex)}>
                        <ExercisePhoto src={ex.defaultPhoto} className="replace-custom-photo" />
                        <span>{name(ex)}</span>
                      </button>
                    ))}
                  </div>
                  <button type="button" className="workout-btn workout-btn-secondary replace-custom-other"
                    onClick={() => setPickerOpen(true)}>
                    {t('customex.replace_other')}
                  </button>
                </>
              ) : (
                <>
                  <div className="replace-custom-arrow">
                    <div className="replace-custom-from">
                      <ExercisePhoto src={custom.defaultPhoto} className="replace-custom-photo" />
                      <strong>{custom.name}</strong>
                    </div>
                    <span aria-hidden="true" className="replace-custom-arrow-sign">↓</span>
                    <div className="replace-custom-from">
                      <ExercisePhoto src={target.defaultPhoto} className="replace-custom-photo" />
                      <strong>{name(target)}</strong>
                    </div>
                  </div>
                  <p>{countsText}</p>
                  <p className="replace-custom-warning">{t('customex.replace_warning')}</p>
                  {error && <p className="replace-custom-error" role="alert">{t('customex.replace_error')}</p>}
                </>
              )}
            </div>
            {target && (
              <div className="workout-modal-footer">
                <button type="button" className="workout-btn workout-btn-secondary" disabled={busy}
                  onClick={() => { setTarget(null); setError(false); }}>
                  {t('generic.back')}
                </button>
                <button type="button" className="workout-btn workout-btn-primary" disabled={busy || !counts} onClick={replace}>
                  {busy ? t('customex.replace_busy') : t('customex.replace_do')}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <ExercisePicker
        isOpen={pickerOpen}
        onClose={() => setPickerOpen(false)}
        replaceMode
        builtInOnly
        title={t('customex.replace_picker_title')}
        onSelect={(picked) => {
          setPickerOpen(false);
          if (picked[0]) setTarget(picked[0]);
        }}
      />
    </>
  );
}
