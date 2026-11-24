import { Language, ExerciseDefinition } from '@/types/workout';
import { ExerciseTranslation, ExerciseTranslations } from './types';
import { HE_EXERCISE_TRANSLATIONS } from './he';
import {
  MERGED_AWAY, RENAMED_SINGLES, movementIndex, variantTagLabels,
} from '@/data/exercise-movements';

// PROTOTYPE: library exercises display as "<movement> · <variant tags>".
const MOVEMENT_INDEX = movementIndex();

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
//
// PROTOTYPE: an exercise that belongs to a movement is named after the
// movement, with its variant tags — `name` is the full "Shoulder Press ·
// Dumbbells" (for history, feed, summaries), `movementName` + `variantLabel`
// let a card show them on two lines. Ids merged away display as the exercise
// they were merged into. Custom exercises keep their own name.
export function getLocalizedExercise(
  def: Pick<ExerciseDefinition, 'id' | 'name' | 'description'>,
  language: Language
): { name: string; description: string | undefined; movementName: string; variantLabel: string | null } {
  const tr = getExerciseTranslation(def.id, language);
  const description = tr.description ?? def.description;
  const lang = language === 'he' ? 'he' : 'en';
  const id = MERGED_AWAY[def.id] ?? def.id;
  const mv = MOVEMENT_INDEX.get(id);
  if (mv) {
    const movementName = lang === 'he' ? mv.movement.nameHe : mv.movement.name;
    const tags = variantTagLabels(mv.variant.tags, lang, mv.movement.id);
    const variantLabel = mv.movement.variants.length > 1 && tags.length > 0 ? tags.join(' · ') : null;
    return {
      name: variantLabel ? `${movementName} · ${variantLabel}` : movementName,
      description, movementName, variantLabel,
    };
  }
  const renamed = RENAMED_SINGLES[id];
  const name = renamed ? (lang === 'he' ? renamed.nameHe : renamed.name) : (tr.name ?? def.name);
  return { name, description, movementName: name, variantLabel: null };
}

// Localized name for a single progression step. Falls back to the step's
// English `name` when no translation exists for the active language.
export function getLocalizedStepName(
  exerciseId: string,
  step: { id: string; name: string },
  language: Language
): string {
  if (language === 'en') return step.name;
  return getExerciseTranslation(exerciseId, language).steps?.[step.id] ?? step.name;
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
