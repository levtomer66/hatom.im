// Households (docs/superpowers/specs/2026-11-18-shopping-households-design.md):
// one per family, a person in exactly one. A member invites an email; the
// invitee accepts on their next visit. Pure rules, import-free apart from
// types, for `node --test`.

import type { ShoppingHome } from './home.ts';

export const MAX_MEMBERS = 10;
export const MAX_INVITES = 10;

export interface Invite {
  /** The invitee, lowercase. */
  email: string;
  /** The member who invited them. */
  by: string;
  at: string;
}

export interface Household extends ShoppingHome {
  id: string;
  /** Lowercase emails, at least one. */
  members: string[];
  /** Pending invites to join this household. */
  invites: Invite[];
}

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

/** An invite's email: trimmed, lowercased, one @ with a dotted domain, no spaces. */
export function parseInviteEmail(v: unknown): Result<string> {
  if (typeof v !== 'string') return { ok: false, error: 'כתובת מייל לא תקינה' };
  const email = v.trim().toLowerCase();
  if (email.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, error: 'כתובת מייל לא תקינה' };
  return { ok: true, value: email };
}

/** Whether `email` can be invited to `h`: not a member, not invited already, under both caps. */
export function canInvite(h: Pick<Household, 'members' | 'invites'>, email: string): Result<true> {
  if (h.members.includes(email)) return { ok: false, error: 'כבר במשק הבית' };
  if (h.invites.some((i) => i.email === email)) return { ok: false, error: 'כבר הוזמנ/ה' };
  if (h.members.length >= MAX_MEMBERS) return { ok: false, error: 'אפשר עד 10 בני בית' };
  if (h.invites.length >= MAX_INVITES) return { ok: false, error: 'אפשר עד 10 הזמנות' };
  return { ok: true, value: true };
}

/**
 * What accepting an invite does to the household `email` leaves: deleted
 * when they're its only member, and how many My items and list lines go
 * with it (0 when it stays).
 */
export function acceptPlan(from: Pick<Household, 'members' | 'items' | 'list'>, email: string): { deleteFrom: boolean; loses: number } {
  const deleteFrom = from.members.length === 1 && from.members[0] === email;
  return { deleteFrom, loses: deleteFrom ? from.items.length + from.list.length : 0 };
}

/**
 * A write the page made for household `sent` while the caller is now in
 * `actual` (they accepted or left on another device, or a save was still
 * pending at the switch): applying it would replace the new household's
 * arrays with the old one's. A client that names no household is allowed.
 */
export const wrongHousehold = (sent: unknown, actual: string): boolean => typeof sent === 'string' && sent !== actual;

/** A household with only `email` in it and nothing saved: safe to drop when it got in the way of joining another. */
export const isDisposable = (h: Pick<Household, 'members' | 'invites' | 'items' | 'list' | 'favStores'>, email: string): boolean =>
  h.members.length === 1 && h.members[0] === email && !h.invites.length && !h.items.length && !h.list.length && !h.favStores.length;
