import type { Language } from '@/types/workout';
import { getExerciseById } from '@/data/exercise-library';
import { getLocalizedExercise } from '@/lib/exercise-translations';

// Localized exercise name for the "{exercise}" in a finish-workout joke.
// Custom exercises aren't in the library; renderBrag then falls back to the
// English name stored with the pick.
export function exerciseNameFor(language: Language) {
  return (id: string): string | null => {
    const def = getExerciseById(id);
    return def ? getLocalizedExercise(def, language).name : null;
  };
}
