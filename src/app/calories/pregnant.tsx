'use client';

// Whether the person logging is a pregnant owner (docs/superpowers/specs/2026-11-24-pregnancy-design.md
// § Extras): /calories sets it from the day's `preg`, /pregnancy for its owner.
// The search results, the amount sheet and quick add read it for the ⚠ food
// chips and the caffeine field. Nobody else ever sees them.

import React, { createContext, useContext } from 'react';
import { foodWarning } from '@/lib/pregnancy/safety';

const Pregnant = createContext(false);

export const PregnantProvider = ({ value, children }: { value: boolean; children: React.ReactNode }) =>
  <Pregnant.Provider value={value}>{children}</Pregnant.Provider>;

export const usePregnant = () => useContext(Pregnant);

/** ⚠ with its reason on tap/hover; nothing when not pregnant or nothing to warn about. */
export function WarnChip({ name, text }: { name: string; text?: string | null }) {
  const pregnant = usePregnant();
  const why = text ?? (pregnant ? foodWarning(name) : null);
  if (!pregnant || !why) return null;
  return (
    <span className="cal-warn" role="note" title={why} tabIndex={0} aria-label={`אזהרה בהריון: ${why}`}
      onClick={(e) => { e.stopPropagation(); (e.currentTarget as HTMLElement).classList.toggle('is-open'); }}>
      ⚠<span className="cal-warn-why">{why}</span>
    </span>
  );
}
