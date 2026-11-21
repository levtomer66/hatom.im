'use client';

// /calories: each person's private food diary against a daily goal
// (docs/superpowers/specs/2026-11-21-calories-design.md). The day screen:
// date arrows, the ring, four meal cards, the week. "Today" is this device's
// date, worked out after mount; every route takes the date from here.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { FaChevronLeft, FaChevronRight, FaCog, FaPlus, FaUtensils } from 'react-icons/fa';
import { hasPermission } from '@/lib/permissions';
import {
  defaultMeal, isCurrentDay, mealTotals, rollToday, sumTotals, DEFAULT_GOAL, MEALS, MEAL_NAMES,
  type Entry, type Meal, type Settings, type Totals,
} from '@/lib/calories/calories';
import type { DayResponse } from '@/lib/calories/api-types';
import { SwipeRow, Thumb } from '../shopping/ui';
import AddSheet from './AddSheet';
import type { Picked } from './FoodPicker';
import SearchBar from './SearchBar';
import { amountText } from './AmountStep';
import EditSheet from './EditSheet';
import MealsSheet from './Meals';
import Ring from './Ring';
import SettingsSheet, { GoalForm } from './SettingsSheet';
import WeekBars from './WeekBars';
import * as api from './api';

const pad = (n: number) => String(n).padStart(2, '0');
const localToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const shift = (date: string, days: number) => {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
};
const WEEKDAY = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
function dateLabel(date: string, today: string) {
  if (date === today) return 'היום';
  if (date === shift(today, -1)) return 'אתמול';
  const [y, m, d] = date.split('-').map(Number);
  return `יום ${WEEKDAY[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]} ${d}.${m}`;
}

/** An entry on its way to the server, or one that didn't make it (tap to retry). */
interface Pending { tempId: string; date: string; entry: Omit<Entry, 'id' | 'at'>; per100: Totals | null; per?: Totals; failed: boolean }

type SheetState =
  | { kind: 'add'; meal: Meal; picked?: Picked }
  | { kind: 'edit'; entry: Entry }
  | { kind: 'settings' }
  | { kind: 'meals' }
  | null;

export default function CaloriesPage() {
  const { data: session } = useSession();
  const canShop = hasPermission(session, 'shopping');
  const [today, setToday] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [day, setDay] = useState<DayResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending[]>([]);
  const [sheet, setSheet] = useState<SheetState>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [hour, setHour] = useState(() => new Date().getHours());

  // The day on screen, for async work that finishes after the page has moved on.
  const dateRef = useRef<string | null>(null);
  dateRef.current = date;
  const todayRef = useRef<string | null>(null);
  todayRef.current = today;

  useEffect(() => {
    const t = localToday();
    setToday(t);
    setDate(t);
  }, []);

  // A page left open past midnight: "today" moves on, and so does a page that was showing it.
  useEffect(() => {
    const check = () => {
      setHour(new Date().getHours());
      const old = todayRef.current;
      const now = localToday();
      if (!old || old === now) return;
      setToday(now);
      setDate((d) => (d ? rollToday({ today: old, date: d }, now).date : d));
    };
    const onVisible = () => { if (document.visibilityState === 'visible') check(); };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', check);
    const timer = window.setInterval(check, 60_000);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', check);
      window.clearInterval(timer);
    };
  }, []);

  const load = useCallback(async (d: string) => {
    try {
      const res = await api.getDay(d);
      // A slow answer for a day the page has left is dropped (two quick taps on ‹, a save then ‹).
      if (!isCurrentDay(res.date, dateRef.current)) return;
      setDay(res);
      setLoadError(null);
    } catch (e) {
      if (isCurrentDay(d, dateRef.current)) setLoadError(e instanceof Error ? e.message : 'לא נטען');
    }
  }, []);
  useEffect(() => { if (date) void load(date); }, [date, load]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2500);
    return () => window.clearTimeout(t);
  }, [toast]);

  const shown = day && day.date === date ? day : null;
  const mine = pending.filter((p) => p.date === date);
  const eaten = useMemo(() => sumTotals((shown?.entries ?? []).map((e) => e.nu)), [shown]);
  const byMeal = useMemo(() => mealTotals(shown?.entries ?? []), [shown]);

  const send = useCallback(async (p: Pending) => {
    try {
      await api.addEntry(p.date, p.entry, p.per100, p.per);
      await load(p.date);
      setPending((list) => list.filter((x) => x.tempId !== p.tempId));
    } catch (e) {
      // Refused for good (a full day, a bad value): drop the row and say why. Otherwise it waits for a retry tap.
      const refused = e instanceof api.ApiError && e.status >= 400 && e.status < 500;
      setPending((list) => (refused ? list.filter((x) => x.tempId !== p.tempId) : list.map((x) => (x.tempId === p.tempId ? { ...x, failed: true } : x))));
      setToast(e instanceof Error ? e.message : 'לא נשמר');
    }
  }, [load]);

  const log = (entry: Omit<Entry, 'id' | 'at'>, per100: Totals | null, per?: Totals) => {
    if (!date) return;
    const p: Pending = { tempId: `t${Date.now()}${Math.random()}`, date, entry, per100, per, failed: false };
    setPending((list) => [...list, p]);
    setSheet(null);
    void send(p);
  };

  const saveSettings = async (s: Settings): Promise<string | null> => {
    try {
      const settings = await api.putSettings(s);
      setDay((d) => (d ? { ...d, settings } : d));
      if (date) void load(date);
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : 'לא נשמר';
    }
  };

  const remove = async (entry: Entry) => {
    if (!date || !shown) return;
    setDay({ ...shown, entries: shown.entries.filter((e) => e.id !== entry.id) });
    setSheet(null);
    try {
      await api.deleteEntry(date, entry.id);
    } catch (e) {
      setToast(e instanceof Error ? e.message : 'לא נמחק');
    }
    void load(date);
  };

  if (!date || !today) return <main className="sh-page cal-page" />;
  const settings = shown?.settings ?? null;
  // New entries go to the meal of the hour on today; a past day's to snacks.
  const nowMeal: Meal | null = date === today ? defaultMeal(hour) : null;
  const currentMeal: Meal = nowMeal ?? 'snack';

  return (
    <main className="sh-page cal-page">
      <header className="cal-head">
        <button type="button" className="sh-icon-btn" aria-label="היום הקודם" onClick={() => setDate(shift(date, -1))}><FaChevronRight /></button>
        <h1 className="cal-date">{dateLabel(date, today)}</h1>
        <button type="button" className="sh-icon-btn" aria-label="היום הבא" disabled={date >= today} onClick={() => setDate(shift(date, 1))}><FaChevronLeft /></button>
        <button type="button" className="sh-icon-btn cal-gear" aria-label="הגדרות" onClick={() => setSheet({ kind: 'settings' })}><FaCog /></button>
      </header>

      {loadError ? <p className="cal-error" role="alert">{loadError} <button type="button" className="cal-link" onClick={() => void load(date)}>לנסות שוב</button></p> : null}

      {shown && !settings ? (
        <section className="sh-card cal-welcome">
          <h2>כמה קלוריות ביום?</h2>
          <p className="cal-muted">היעד היומי שלך. אפשר לשנות בכל רגע ב־⚙.</p>
          <GoalForm settings={null} cta="להתחיל" onSave={saveSettings} />
        </section>
      ) : null}

      {shown && settings ? <Ring eaten={eaten} settings={settings} /> : null}
      {!shown && !loadError ? <div className="cal-ring-card is-loading" aria-label="טוען" /> : null}

      {shown && settings ? (
        <>
          <SearchBar recent={shown.recent} canShop={canShop}
            onPick={(picked) => setSheet({ kind: 'add', meal: currentMeal, picked })}
            onLog={(e, per100, per) => log({ ...e, meal: currentMeal }, per100, per)} />
          <div className="cal-actions">
            <button type="button" className="sh-btn sh-home-btn" onClick={() => setSheet({ kind: 'meals' })}><FaUtensils aria-hidden /> ארוחה</button>
          </div>
          {MEALS.map((m) => {
            const entries = shown.entries.filter((e) => e.meal === m);
            const waiting = mine.filter((p) => p.entry.meal === m);
            return (
              <section key={m} className={`sh-card cal-meal ${m === nowMeal ? 'is-now' : ''}`} aria-label={MEAL_NAMES[m]} aria-current={m === nowMeal ? 'time' : undefined}>
                <header className="cal-meal-head">
                  <h2>{MEAL_NAMES[m]}{m === nowMeal ? <small className="cal-now">עכשיו</small> : null}</h2>
                  <span className="cal-muted">{byMeal[m].kcal ? `${byMeal[m].kcal.toLocaleString('he-IL')} קק״ל` : ''}</span>
                  <button type="button" className="sh-icon-btn" aria-label={`הוספה ל${MEAL_NAMES[m]}`} onClick={() => setSheet({ kind: 'add', meal: m })}><FaPlus /></button>
                </header>
                {entries.length || waiting.length ? (
                  <ul className="cal-entries">
                    {entries.map((e) => (
                      <SwipeRow key={e.id} className="cal-entry" label="מחיקה" onRemove={() => void remove(e)}>
                        <button type="button" className="cal-entry-btn" onClick={() => setSheet({ kind: 'edit', entry: e })}>
                          <Thumb src={e.img} size={36} />
                          <span className="cal-entry-name">{e.name}<small>{amountText(e.unit, e.qty)}</small></span>
                          <span className="cal-entry-kcal">{e.nu.kcal.toLocaleString('he-IL')}</span>
                        </button>
                      </SwipeRow>
                    ))}
                    {waiting.map((p) => (
                      <li key={p.tempId} className={`cal-entry is-pending ${p.failed ? 'is-failed' : ''}`}>
                        <button type="button" className="cal-entry-btn" disabled={!p.failed}
                          onClick={() => { setPending((l) => l.map((x) => (x.tempId === p.tempId ? { ...x, failed: false } : x))); void send({ ...p, failed: false }); }}>
                          <Thumb src={p.entry.img} size={36} />
                          <span className="cal-entry-name">{p.entry.name}<small>{p.failed ? 'לא נשמר — נסה שוב' : 'שומר…'}</small></span>
                          <span className="cal-entry-kcal">{p.entry.nu.kcal.toLocaleString('he-IL')}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </section>
            );
          })}
          <WeekBars week={shown.week} goal={settings.goal ?? DEFAULT_GOAL} shown={date} onPick={setDate} />
        </>
      ) : null}

      {sheet?.kind === 'add' && shown ? (
        <AddSheet meal={sheet.meal} picked={sheet.picked} recent={shown.recent} canShop={canShop} busy={false} onLog={log} onClose={() => setSheet(null)} />
      ) : null}
      {sheet?.kind === 'edit' ? (
        <EditSheet entry={sheet.entry} canShop={canShop} onClose={() => setSheet(null)} onDelete={() => void remove(sheet.entry)}
          onSave={async (patch) => {
            try {
              await api.patchEntry(date, sheet.entry.id, patch);
              await load(date);
              return true;
            } catch (e) {
              setToast(e instanceof Error ? e.message : 'לא נשמר');
              return false;
            }
          }} />
      ) : null}
      {sheet?.kind === 'settings' ? (
        <SettingsSheet settings={settings} onSave={saveSettings} onClose={() => setSheet(null)} />
      ) : null}
      {sheet?.kind === 'meals' ? <MealsSheet onLog={(picked) => setSheet({ kind: 'add', meal: currentMeal, picked })} onClose={() => setSheet(null)} /> : null}

      {toast ? <div className="sh-toast" role="status">{toast}</div> : null}
    </main>
  );
}
