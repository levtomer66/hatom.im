export type SpaUserId = 'tom' | 'tomer';

export interface SpaUser {
  id: SpaUserId;
  name: string;
  email: string;
}

export const SPA_USERS: readonly SpaUser[] = [
  { id: 'tom', name: 'Tom', email: 'tomzari347@gmail.com' },
  { id: 'tomer', name: 'Tomer', email: 'levtomer66@gmail.com' },
];

export const SPA_USER_IDS: readonly SpaUserId[] = SPA_USERS.map((u) => u.id);

export function isValidSpaUserId(value: unknown): value is SpaUserId {
  return value === 'tom' || value === 'tomer';
}

export function otherSpaUser(id: SpaUserId): SpaUserId {
  return id === 'tom' ? 'tomer' : 'tom';
}

export function getSpaUser(id: SpaUserId): SpaUser {
  return SPA_USERS.find((u) => u.id === id) as SpaUser;
}

export type SpaDuration = 30 | 60 | 90;
export const SPA_DURATIONS: readonly SpaDuration[] = [30, 60, 90];

export function isValidSpaDuration(value: unknown): value is SpaDuration {
  return value === 30 || value === 60 || value === 90;
}

// Atmosphere flags — set independently, all default false.
export interface SpaFlags {
  music: boolean;
  oil: boolean;
  deepPressure: boolean;
  candles: boolean;
}

export interface SpaFlagOption {
  id: keyof SpaFlags;
  label: string;
  emoji: string;
}

export const SPA_FLAGS: readonly SpaFlagOption[] = [
  { id: 'music',        label: 'Music',         emoji: '🎵' },
  { id: 'oil',          label: 'Oil',           emoji: '💧' },
  { id: 'deepPressure', label: 'Deep Pressure', emoji: '💪' },
  { id: 'candles',      label: 'Candles',       emoji: '🕯️' },
];

export const SPA_FLAG_IDS: readonly (keyof SpaFlags)[] = SPA_FLAGS.map((f) => f.id);

export function emptyFlags(): SpaFlags {
  return { music: false, oil: false, deepPressure: false, candles: false };
}

// Normalises any input into a strict SpaFlags object — used by the API
// to coerce missing or extra keys without trusting client payload.
export function coerceFlags(input: unknown): SpaFlags {
  const out = emptyFlags();
  if (input && typeof input === 'object') {
    for (const id of SPA_FLAG_IDS) {
      const v = (input as Record<string, unknown>)[id];
      if (v === true) out[id] = true;
    }
  }
  return out;
}

export function flagsLabel(flags: SpaFlags): string {
  const on = SPA_FLAGS.filter((f) => flags[f.id]);
  if (on.length === 0) return '—';
  return on.map((f) => f.label).join(', ');
}

export interface SpaSession {
  id: string;
  giverId: SpaUserId;
  receiverId: SpaUserId;
  scheduledAt: string; // ISO 8601 (serialised from <input type="datetime-local">)
  durationMinutes: SpaDuration;
  flags: SpaFlags;
  preferences: string;
  happyEnding: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateSpaSessionDto {
  giverId: SpaUserId;
  scheduledAt: string;
  durationMinutes: SpaDuration;
  flags: SpaFlags;
  preferences: string;
  happyEnding?: boolean;
}
