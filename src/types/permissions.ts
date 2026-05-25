// Per-user, per-page permission keys. Each key matches one feature route
// (or a small family of related routes) on the site. Owners (Tom + Tomer)
// implicitly hold every permission; everyone else is granted explicit keys
// via the admin matrix at /admin/allowlist.

export type PermissionKey =
  // Visibility keys — controls whether the user can see the page at all.
  // Granted = the feature card/nav entry shows up and the route renders.
  | 'family-tree'
  | 'mekafkefim'
  | 'instomit'
  | 'vegas-guide'
  | 'workout'
  | 'trip'
  | 'spa'
  | 'valentine'
  // Write keys — independent of visibility (you could grant write without
  // visibility, but the matrix UI nudges toward pairing them). Owned by
  // the same `allowedPages` array on the AuthorizedEmail doc.
  | 'family-tree:write'
  | 'mekafkefim:write'
  | 'trip:write';

// Stable ordering = admin matrix column order. Write pills sit directly
// after their visibility counterpart so the operator reads the row as
// pairs ("Family Tree visibility, Family Tree write, …"). Add new keys
// adjacent to their feature group so existing toggles don't visually
// reshuffle for unrelated edits.
export const PERMISSION_KEYS: readonly PermissionKey[] = [
  'family-tree',
  'family-tree:write',
  'mekafkefim',
  'mekafkefim:write',
  'instomit',
  'vegas-guide',
  'workout',
  'trip',
  'trip:write',
  'spa',
  'valentine',
];

const PERMISSION_KEY_SET = new Set<string>(PERMISSION_KEYS);

export interface PermissionMeta {
  // Short Hebrew/English label rendered in the admin matrix.
  label: string;
  // Emoji used as the matrix toggle's icon.
  emoji: string;
}

export const PERMISSIONS: Record<PermissionKey, PermissionMeta> = {
  'family-tree':       { label: 'Family Tree',       emoji: '🐶' },
  'family-tree:write': { label: 'Family Tree write', emoji: '✏️' },
  mekafkefim:          { label: 'Mekafkefim',        emoji: '☕' },
  'mekafkefim:write':  { label: 'Mekafkefim write',  emoji: '✏️' },
  instomit:            { label: 'InsTomit',          emoji: '🎥' },
  'vegas-guide':       { label: 'Wedding Guide',     emoji: '💒' },
  workout:             { label: 'Workout',           emoji: '🏋️' },
  trip:                { label: 'Trip',              emoji: '✈️' },
  'trip:write':        { label: 'Trip write',        emoji: '✏️' },
  spa:                 { label: 'Spa',               emoji: '🌹' },
  valentine:           { label: 'Valentine',         emoji: '💋' },
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
