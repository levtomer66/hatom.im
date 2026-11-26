// Pure rules for "replace my custom exercise with a built-in one": what a
// template's list and the gear settings look like once `from` becomes `to`.
// The Mongo side (workouts, templates, PBs, the custom doc) is in
// src/lib/workout-custom-replace.ts. Import-free for node --test.

export interface ExerciseRef {
  exerciseId: string;
}

/**
 * Renames `from` to `to` in a template's exercise list. When the template
 * already holds `to`, the renamed entry would be a duplicate, so it is
 * dropped and the entry that was there first keeps its sets/notes/superset.
 */
export function replaceInTemplateList<T extends ExerciseRef>(entries: T[], from: string, to: string): T[] {
  const out: T[] = [];
  let haveTo = false;
  for (const e of entries) {
    const id = e.exerciseId === from ? to : e.exerciseId;
    if (id === to) {
      if (haveTo) continue;
      haveTo = true;
    }
    out.push(id === e.exerciseId ? e : { ...e, exerciseId: id });
  }
  return out;
}

/**
 * Moves the per-exercise gear preference from `from` to `to`. An existing
 * preference on `to` wins (the user set it on purpose); `from` is always
 * cleared. Returns the keys to set and unset.
 */
export function moveLoadPref<P>(
  prefs: Record<string, P>,
  from: string,
  to: string,
): { set: Record<string, P>; unset: string[] } {
  if (!(from in prefs)) return { set: {}, unset: [] };
  return {
    set: to in prefs ? {} : { [to]: prefs[from] },
    unset: [from],
  };
}

export const isCustomExerciseId = (id: string): boolean => /^custom-[0-9a-f]{8}$/.test(id);
