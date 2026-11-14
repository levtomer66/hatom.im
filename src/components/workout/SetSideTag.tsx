'use client';

import React from 'react';
import { useT } from '@/lib/workout-i18n';
import { WorkoutSet } from '@/types/workout';

// "L" / "R" chip on a unilateral set row (see src/lib/workout-unilateral.ts).
// Renders nothing for a normal two-sided set.
export default function SetSideTag({ set }: { set: WorkoutSet }) {
  const t = useT();
  if (set.side !== 'left' && set.side !== 'right') return null;
  return (
    <span className="set-side-tag">
      {set.side === 'left' ? t('card.side_left') : t('card.side_right')}
    </span>
  );
}
