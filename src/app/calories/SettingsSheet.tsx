'use client';

// ⚙: the daily goals.

import React, { useState } from 'react';
import { DEFAULT_GOAL, type Settings } from '@/lib/calories/calories';
import Sheet from './Sheet';

export function GoalForm({ settings, onSave, cta }: { settings: Settings | null; onSave: (s: Settings) => Promise<string | null>; cta: string }) {
  const [goal, setGoal] = useState(String(settings?.goal ?? DEFAULT_GOAL));
  const [protein, setProtein] = useState(settings?.proteinGoal ? String(settings.proteinGoal) : '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form className="cal-goals" onSubmit={async (e) => {
      e.preventDefault();
      setBusy(true);
      setError(await onSave({ goal: Math.round(Number(goal)), proteinGoal: protein.trim() ? Math.round(Number(protein)) : null }));
      setBusy(false);
    }}>
      <label className="cal-field"><span>יעד יומי (קק״ל)</span><input inputMode="numeric" value={goal} onChange={(e) => setGoal(e.target.value)} /></label>
      <label className="cal-field"><span>יעד חלבון (גרם, לא חובה)</span><input inputMode="numeric" value={protein} placeholder="—" onChange={(e) => setProtein(e.target.value)} /></label>
      {error ? <p className="cal-error">{error}</p> : null}
      <button type="submit" className="sh-btn sh-btn--primary cal-wide" disabled={busy}>{busy ? 'שומר…' : cta}</button>
    </form>
  );
}

export default function SettingsSheet({ settings, onSave, onClose }: {
  settings: Settings | null; onSave: (s: Settings) => Promise<string | null>; onClose: () => void;
}) {
  return (
    <Sheet title="הגדרות" onClose={onClose}>
      <GoalForm settings={settings} cta="שמירה" onSave={async (s) => {
        const err = await onSave(s);
        if (!err) onClose();
        return err;
      }} />
    </Sheet>
  );
}
