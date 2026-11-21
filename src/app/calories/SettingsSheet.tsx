'use client';

// ⚙ (and the first visit's card): the aim (lose / keep / gain), the profile the
// recommendation needs, the weight shared with the workout app, and the daily
// goals — filled from the recommendation and editable. While they follow it
// (`followRec`), the server recomputes them from each new weight; typing a number
// stops that, "לפי ההמלצה" brings it back.

import React, { useState } from 'react';
import {
  ACTIVITY, DEFAULT_GOAL, formSettings, kgOk, recommend,
  type Activity, type Aim, type Profile, type Settings, type Sex,
} from '@/lib/calories/calories';
import Sheet from './Sheet';

const AIMS: { v: Aim; label: string }[] = [{ v: 'lose', label: 'ירידה במשקל' }, { v: 'keep', label: 'שמירה' }, { v: 'gain', label: 'עלייה במשקל' }];
const ACTIVITY_NAMES: Record<Activity, string> = { 1.2: 'יושבני', 1.375: 'קל', 1.55: 'פעיל', 1.725: 'פעיל מאוד' };
const n = (v: number) => v.toLocaleString('he-IL');

export type SaveGoals = (s: Settings, kg: number | null) => Promise<string | null>;

function Chips<T extends string | number>({ label, value, options, onPick }: { label: string; value: T | null; options: { v: T; label: string }[]; onPick: (v: T) => void }) {
  return (
    <div className="cal-chips" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.v)} type="button" role="radio" aria-checked={o.v === value} className={`sh-chip ${o.v === value ? 'is-on' : ''}`} onClick={() => onPick(o.v)}>{o.label}</button>
      ))}
    </div>
  );
}

export function GoalForm({ settings, kg: kgNow, onSave, cta }: { settings: Settings | null; kg: number | null; onSave: SaveGoals; cta: string }) {
  const p = settings?.profile;
  const [aim, setAim] = useState<Aim>(settings?.aim ?? 'keep');
  const [sex, setSex] = useState<Sex | null>(p?.sex ?? null);
  const [birthYear, setBirthYear] = useState(p ? String(p.birthYear) : '');
  const [height, setHeight] = useState(p ? String(p.heightCm) : '');
  const [activity, setActivity] = useState<Activity | null>(p?.activity ?? null);
  const [kg, setKg] = useState(kgNow !== null ? String(kgNow) : '');
  const [follow, setFollow] = useState(settings ? settings.followRec === true : true);
  const [goal, setGoal] = useState(String(settings?.goal ?? DEFAULT_GOAL));
  const [protein, setProtein] = useState(settings?.proteinGoal ? String(settings.proteinGoal) : '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const kgNum = Number(kg.replace(',', '.'));
  const profile: Profile | undefined = sex && activity && birthYear && height
    ? { sex, activity, birthYear: Math.round(Number(birthYear)), heightCm: Math.round(Number(height)) }
    : undefined;
  const year = new Date().getFullYear();
  const rec = profile && profile.birthYear > 1900 && profile.heightCm > 0 ? recommend(profile, aim, kgOk(kgNum) ? kgNum : null, year) : null;
  /** The first edit of a goal: both fields start from the recommendation they were showing. */
  const unfollow = () => {
    if (follow && rec) { setGoal(String(rec.goal)); setProtein(String(rec.proteinGoal)); }
    setFollow(false);
  };
  const shownGoal = follow && rec ? String(rec.goal) : goal;
  const shownProtein = follow && rec ? String(rec.proteinGoal) : protein;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (kg.trim() && !kgOk(kgNum)) { setError('משקל בין 25 ל־400 ק״ג'); return; }
    const s = formSettings({ aim, sex, birthYear, height, activity, follow, goal, protein }, rec, year);
    if (!s.ok) { setError(s.error); return; }
    setBusy(true);
    setError(await onSave(s.value, kg.trim() ? Math.round(kgNum * 10) / 10 : null));
    setBusy(false);
  };

  return (
    <form className="cal-goals" onSubmit={submit}>
      <h3 className="sh-section-title">המטרה</h3>
      <Chips label="המטרה" value={aim} options={AIMS} onPick={setAim} />

      <h3 className="sh-section-title">עליך</h3>
      <Chips label="מין" value={sex} options={[{ v: 'm' as Sex, label: 'גבר' }, { v: 'f' as Sex, label: 'אישה' }]} onPick={setSex} />
      <div className="cal-label-grid">
        <label><span>שנת לידה</span><input inputMode="numeric" value={birthYear} placeholder="1990" onChange={(e) => setBirthYear(e.target.value)} /></label>
        <label><span>גובה (ס״מ)</span><input inputMode="numeric" value={height} placeholder="175" onChange={(e) => setHeight(e.target.value)} /></label>
        <label><span>משקל (ק״ג)</span><input inputMode="decimal" value={kg} placeholder="75.5" onChange={(e) => setKg(e.target.value)} /></label>
      </div>
      <p className="cal-muted cal-note">המשקל משותף עם אפליקציית האימונים.</p>
      <h3 className="sh-section-title">פעילות ביום־יום (בלי אימונים — הם נספרים לבד)</h3>
      <Chips label="פעילות" value={activity} options={ACTIVITY.map((a) => ({ v: a, label: ACTIVITY_NAMES[a] }))} onPick={setActivity} />

      <h3 className="sh-section-title">היעד היומי</h3>
      {rec ? (
        <p className="cal-rec">
          ההמלצה: <b>{n(rec.goal)}</b> קק״ל · <b>{rec.proteinGoal}</b> ג׳ חלבון
          {!follow ? <button type="button" className="cal-link" onClick={() => setFollow(true)}>לפי ההמלצה</button> : <small>מתעדכן עם המשקל</small>}
        </p>
      ) : <p className="cal-muted cal-note">מלאו את הפרטים שלמעלה כדי לקבל המלצה.</p>}
      <div className="cal-label-grid">
        <label><span>קלוריות</span><input inputMode="numeric" value={shownGoal} onChange={(e) => { unfollow(); setGoal(e.target.value); }} /></label>
        <label><span>חלבון (ג׳, לא חובה)</span><input inputMode="numeric" value={shownProtein} placeholder="—" onChange={(e) => { unfollow(); setProtein(e.target.value); }} /></label>
      </div>
      {error ? <p className="cal-error">{error}</p> : null}
      <button type="submit" className="sh-btn sh-btn--primary cal-wide" disabled={busy}>{busy ? 'שומר…' : cta}</button>
    </form>
  );
}

export default function SettingsSheet({ settings, kg, onSave, onClose }: {
  settings: Settings | null; kg: number | null; onSave: SaveGoals; onClose: () => void;
}) {
  return (
    <Sheet title="מטרה ויעדים" onClose={onClose}>
      <GoalForm settings={settings} kg={kg} cta="שמירה" onSave={async (s, w) => {
        const err = await onSave(s, w);
        if (!err) onClose();
        return err;
      }} />
    </Sheet>
  );
}
