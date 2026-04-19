// Shape of a per-language exercise translation dict, keyed by exercise ID.
// Each entry may provide a translated `name` and/or `description`. Any
// missing language/key falls back to the English `name` / `description`
// on the `ExerciseDefinition` itself.
export interface ExerciseTranslation {
  name?: string;
  description?: string;
}

export type ExerciseTranslations = Record<string, ExerciseTranslation>;
