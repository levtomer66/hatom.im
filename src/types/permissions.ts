// Per-user, per-page permission keys. Each key matches one feature route
// (or a small family of related routes) on the site. Owners (Tom + Tomer)
// implicitly hold every permission; everyone else is granted explicit keys
// via the admin matrix at /admin/allowlist.

export type PermissionKey =
  | 'family-tree'
  | 'mekafkefim'
  | 'instomit'
  | 'vegas-guide'
  | 'workout'
  | 'trip'
  | 'spa';

// Stable ordering = admin matrix column order. Add new keys at the end so
// existing toggles don't visually shift when we extend the feature surface.
export const PERMISSION_KEYS: readonly PermissionKey[] = [
  'family-tree',
  'mekafkefim',
  'instomit',
  'vegas-guide',
  'workout',
  'trip',
  'spa',
];

const PERMISSION_KEY_SET = new Set<string>(PERMISSION_KEYS);

export interface PermissionMeta {
  // Short Hebrew/English label rendered in the admin matrix.
  label: string;
  // Emoji used as the matrix toggle's icon.
  emoji: string;
}

export const PERMISSIONS: Record<PermissionKey, PermissionMeta> = {
  'family-tree': { label: 'Family Tree',   emoji: '🐶' },
  mekafkefim:    { label: 'Mekafkefim',    emoji: '☕' },
  instomit:      { label: 'InsTomit',      emoji: '🎥' },
  'vegas-guide': { label: 'Wedding Guide', emoji: '💒' },
  workout:       { label: 'Workout',       emoji: '🏋️' },
  trip:          { label: 'Trip',          emoji: '✈️' },
  spa:           { label: 'Spa',           emoji: '🌹' },
};

export function isPermissionKey(value: unknown): value is PermissionKey {
  return typeof value === 'string' && PERMISSION_KEY_SET.has(value);
}

// Validate + dedupe an unknown[] coming off the wire into a strongly-typed
// PermissionKey[]. Returns null when any element fails validation, so the
// caller can 400 on a bad payload instead of silently dropping bad keys.
export function parsePermissionKeyArray(input: unknown): PermissionKey[] | null {
  if (!Array.isArray(input)) return null;
  const seen = new Set<PermissionKey>();
  for (const v of input) {
    if (!isPermissionKey(v)) return null;
    seen.add(v);
  }
  return [...seen];
}
