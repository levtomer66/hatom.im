'use client';

import React from 'react';
import { useT } from '@/lib/workout-i18n';

// "Include logged sets" checkbox shown with every Share-to-feed button. On by
// default; off means feed readers see the post's totals but can't open the
// sets (GET /api/workout/feed/[workoutId] answers 403).
export default function IncludeSetsToggle({
  checked,
  onChange,
  disabled = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  const t = useT();
  return (
    <label className="feed-include-sets">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span>{t('feed.include_sets')}</span>
    </label>
  );
}
