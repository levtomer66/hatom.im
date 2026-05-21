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

export type MassageType =
  | 'swedish'
  | 'deep-tissue'
  | 'aromatherapy'
  | 'hot-stone'
  | 'sports'
  | 'thai'
  | 'shiatsu';

export interface MassageTypeOption {
  id: MassageType;
  label: string;
  emoji: string;
}

export const MASSAGE_TYPES: readonly MassageTypeOption[] = [
  { id: 'swedish', label: 'Swedish', emoji: '🌿' },
  { id: 'deep-tissue', label: 'Deep Tissue', emoji: '💪' },
  { id: 'aromatherapy', label: 'Aromatherapy', emoji: '🪻' },
  { id: 'hot-stone', label: 'Hot Stone', emoji: '🔥' },
  { id: 'sports', label: 'Sports', emoji: '🏃' },
  { id: 'thai', label: 'Thai', emoji: '🧘' },
  { id: 'shiatsu', label: 'Shiatsu', emoji: '👐' },
];

export const MASSAGE_TYPE_IDS: readonly MassageType[] = MASSAGE_TYPES.map((m) => m.id);

export function isValidMassageType(value: unknown): value is MassageType {
  return typeof value === 'string' && (MASSAGE_TYPE_IDS as readonly string[]).includes(value);
}

export type SpaDuration = 30 | 60 | 90;
export const SPA_DURATIONS: readonly SpaDuration[] = [30, 60, 90];

export function isValidSpaDuration(value: unknown): value is SpaDuration {
  return value === 30 || value === 60 || value === 90;
}

export interface SpaSession {
  id: string;
  giverId: SpaUserId;
  receiverId: SpaUserId;
  scheduledAt: string; // ISO 8601 (local datetime serialized from <input type="datetime-local">)
  durationMinutes: SpaDuration;
  massageType: MassageType;
  preferences: string;
  happyEnding: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateSpaSessionDto {
  giverId: SpaUserId;
  scheduledAt: string;
  durationMinutes: SpaDuration;
  massageType: MassageType;
  preferences: string;
  happyEnding?: boolean;
}

export function getMassageTypeLabel(id: MassageType): string {
  return MASSAGE_TYPES.find((m) => m.id === id)?.label ?? id;
}

export function getMassageTypeEmoji(id: MassageType): string {
  return MASSAGE_TYPES.find((m) => m.id === id)?.emoji ?? '💆';
}
