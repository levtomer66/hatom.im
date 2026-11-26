// Server-side pieces of the pregnancy ↔ calories link shared by the routes, the
// MCP tools and the coffee-order logger (docs/superpowers/specs/2026-11-24-pregnancy-design.md):
// who counts as a pregnant owner, and a built-in drink as a diary entry.

import { randomUUID } from 'node:crypto';
import { hasCurrentPermission } from '@/lib/api-caller';
import type { Entry, Meal } from '@/lib/calories/calories';
import type { Drink } from '@/lib/pregnancy/drinks';
import type { Pregnancy } from '@/lib/pregnancy/pregnancy';
import { addEntry, addRecent } from '@/models/Calories';
import { pregnantOwner } from '@/models/Pregnancy';

/** Her active pregnancy when `email` holds `pregnancy` (live) and is pregnant in one; else null. */
export async function activePregnantOwner(email: string): Promise<Pregnancy | null> {
  if (!(await hasCurrentPermission(email.toLowerCase(), 'pregnancy'))) return null;
  return pregnantOwner(email);
}

/** A built-in drink as a diary entry: `qty` units, caffeine and totals frozen. */
export function drinkEntry(d: Drink, qty: number, meal: Meal, extra: Partial<Entry> = {}): Entry {
  const r1 = (v: number) => Math.round(v * 10) / 10;
  const nu = { kcal: Math.round(d.nu.kcal * qty), p: r1(d.nu.p * qty), c: r1(d.nu.c * qty), f: r1(d.nu.f * qty) };
  const caf = Math.round(d.mg * qty);
  return {
    id: randomUUID(), meal, name: d.name, img: null, ref: { kind: 'drink', key: d.id }, unit: { name: d.unit, g: d.g }, qty, nu, caf,
    base: { qty, nu, caf }, at: new Date().toISOString(), ...extra,
  };
}

/** Logs it and remembers it among her recent foods. false when the day is full. */
export async function logEntry(email: string, date: string, e: Entry, per?: Entry['nu']): Promise<boolean> {
  if (!(await addEntry(email, date, e))) return false;
  await addRecent(email, { ref: e.ref, name: e.name, img: e.img, unit: e.unit, qty: e.qty, per100: null, ...(per ? { per } : {}) });
  return true;
}

