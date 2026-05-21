import { WeightUnit, Language, WorkoutSet } from '@/types/workout';
import { formatSeconds } from '@/lib/time';

// Storage is always kilograms. These helpers only affect what the user
// sees in the input fields and weight labels — the DB never sees lb.

// Using the CGPM-defined avoirdupois pound: 1 lb = 0.45359237 kg exactly.
export const KG_PER_LB = 0.45359237;
export const LB_PER_KG = 1 / KG_PER_LB;

// kg → display unit.
export function kgToDisplay(kg: number, unit: WeightUnit): number {
  return unit === 'lb' ? kg * LB_PER_KG : kg;
}

// display unit → kg (what we actually store).
export function displayToKg(value: number, unit: WeightUnit): number {
  return unit === 'lb' ? value * KG_PER_LB : value;
}

// Round a kg value for the active unit's display. One decimal place is
// fine for both: 20 kg → "20" (we strip a trailing ".0"), 44.09 lb → "44.1".
export function roundForDisplay(kg: number | null, unit: WeightUnit): number | null {
  if (kg === null || !Number.isFinite(kg)) return kg;
  const v = kgToDisplay(kg, unit);
  const rounded = Math.round(v * 10) / 10;
  return rounded;
}

// String version of the above — returns '-' for null and trims trailing
// zeros on whole numbers so the UI reads "20kg" rather than "20.0kg".
export function formatWeight(kg: number | null, unit: WeightUnit): string {
  const v = roundForDisplay(kg, unit);
  if (v === null) return '-';
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

// Unit abbreviation shown in labels and suffixes. Hebrew has a clean
// abbreviation for kg ("ק"ג") but not for lb, so we fall back to the
// Latin "lb" in Hebrew — readable and universally understood.
export function getUnitSuffix(unit: WeightUnit, language: Language): string {
  if (unit === 'kg') return language === 'he' ? 'ק"ג' : 'kg';
  return 'lb';
}

// Same letters, uppercased, for the input-field label row.
export function getUnitLabel(unit: WeightUnit, language: Language): string {
  if (unit === 'kg') return language === 'he' ? 'ק"ג' : 'KG';
  return 'LB';
}

// History-chip formatter for a single set. Centralizes the rules:
//   - never emits "0:00" (treats legacy `seconds: undefined` and freshly
//     toggled `seconds: 0` as not-time-mode);
//   - drops the weight prefix when there's no real load and shows the BW
//     label only when it's meaningful (timed hold or rep-mode bodyweight);
//   - returns a "—" placeholder for totally-empty sets rather than the
//     misleading "0kg × 0:00" we used to render.
export function formatHistorySet(
  set: WorkoutSet,
  unit: WeightUnit,
  unitSuffix: string,
  bwLabel: string
): string {
  const hasKg   = set.kg !== null && set.kg !== undefined && set.kg > 0;
  const hasTime = typeof set.seconds === 'number' && set.seconds > 0;
  const hasReps = set.reps !== null && set.reps !== undefined && set.reps > 0;

  if (!hasKg && !hasTime && !hasReps) return '—';

  const left  = hasKg ? `${formatWeight(set.kg, unit)}${unitSuffix}`
              : (hasTime || hasReps) ? bwLabel : '';
  const right = hasTime ? formatSeconds(set.seconds as number)
              : hasReps ? `${set.reps}` : '';

  if (left && right) return `${left} × ${right}`;
  return left || right || '—';
}
