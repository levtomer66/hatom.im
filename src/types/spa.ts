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

// Maps a signed-in email to a SpaUserId. Returns null if the email isn't
// one of the two spa users — the route should 401/redirect in that case.
export function spaUserIdFromEmail(email: string | null | undefined): SpaUserId | null {
  if (!email) return null;
  const match = SPA_USERS.find((u) => u.email.toLowerCase() === email.toLowerCase());
  return match?.id ?? null;
}

export type SpaDuration = 30 | 60 | 90;
export const SPA_DURATIONS: readonly SpaDuration[] = [30, 60, 90];

export function isValidSpaDuration(value: unknown): value is SpaDuration {
  return value === 30 || value === 60 || value === 90;
}

// Atmosphere flags — set independently, all default false. The "spicy"
// subset (kink / toys / forced) is only meaningful when the session's
// happyEnding flag is on; the server clamps it back to false otherwise.
export interface SpaFlags {
  music: boolean;
  oil: boolean;
  deepPressure: boolean;
  candles: boolean;
  // Spicy subset — only revealed in the form when ♡ is armed.
  kink: boolean;
  toys: boolean;
  forced: boolean;
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

// Extra flags surfaced only when ♡ is armed.
export const SPA_SPICY_FLAGS: readonly SpaFlagOption[] = [
  { id: 'kink',   label: 'Kink',   emoji: '⛓️' },
  { id: 'toys',   label: 'Toys',   emoji: '🧸' },
  { id: 'forced', label: 'Forced', emoji: '😈' },
];

export const SPA_FLAG_IDS: readonly (keyof SpaFlags)[] = [
  ...SPA_FLAGS.map((f) => f.id),
  ...SPA_SPICY_FLAGS.map((f) => f.id),
];

export const SPA_SPICY_FLAG_IDS: readonly (keyof SpaFlags)[] = SPA_SPICY_FLAGS.map((f) => f.id);

export function emptyFlags(): SpaFlags {
  return {
    music: false, oil: false, deepPressure: false, candles: false,
    kink: false, toys: false, forced: false,
  };
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

// Joins every "on" flag's label — including the spicy ones — so the
// calendar invite details + the post-submit recap show every preference.
export function flagsLabel(flags: SpaFlags): string {
  const on = [...SPA_FLAGS, ...SPA_SPICY_FLAGS].filter((f) => flags[f.id]);
  if (on.length === 0) return '—';
  return on.map((f) => f.label).join(', ');
}

// Force the spicy subset back to false unless happyEnding is on. Used by
// the API right before persisting so a stale UI / malicious client can't
// store spicy flags on a non-happy-ending session.
export function clampSpicyFlags(flags: SpaFlags, happyEnding: boolean): SpaFlags {
  if (happyEnding) return flags;
  return { ...flags, kink: false, toys: false, forced: false };
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

// CreateSpaSessionDto no longer carries `giverId` — the server derives it
// from the Auth.js session (the receiver is the signed-in Tom; the giver is
// the other one).
export interface CreateSpaSessionDto {
  scheduledAt: string;
  durationMinutes: SpaDuration;
  flags: SpaFlags;
  preferences: string;
  happyEnding?: boolean;
}
