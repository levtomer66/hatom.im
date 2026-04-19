import { Language, ExerciseDefinition } from '@/types/workout';
import { ExerciseTranslation, ExerciseTranslations } from './types';
import { HE_EXERCISE_TRANSLATIONS } from './he';

// Registry of per-language translation dicts. Add a new language file here.
// English is the canonical source — it always lives on the `ExerciseDefinition`
// itself (def.name / def.description) so there's no `en.ts` to maintain.
const TRANSLATIONS: Partial<Record<Language, ExerciseTranslations>> = {
  he: HE_EXERCISE_TRANSLATIONS,
};

// Look up the translation for a single exercise in the given language.
// Returns an empty object if no translation exists — callers then fall back
// to the English fields on the definition.
export function getExerciseTranslation(
  exerciseId: string,
  language: Language
): ExerciseTranslation {
  if (language === 'en') return {};
  return TRANSLATIONS[language]?.[exerciseId] ?? {};
}

// Convenience: return the displayable `{ name, description }` for an exercise
// in the active language, with graceful fallback to English.
export function getLocalizedExercise(
  def: Pick<ExerciseDefinition, 'id' | 'name' | 'description'>,
  language: Language
): { name: string; description: string | undefined } {
  const tr = getExerciseTranslation(def.id, language);
  return {
    name: tr.name ?? def.name,
    description: tr.description ?? def.description,
  };
}

// For search: return ALL name variants known for an exercise (English + every
// translation). Callers can then check whether the search query matches any.
export function getExerciseSearchNames(
  def: Pick<ExerciseDefinition, 'id' | 'name'>
): string[] {
  const names: string[] = [def.name];
  for (const dict of Object.values(TRANSLATIONS)) {
    const tr = dict?.[def.id];
    if (tr?.name) names.push(tr.name);
  }
  return names;
}

export type { ExerciseTranslation, ExerciseTranslations };
