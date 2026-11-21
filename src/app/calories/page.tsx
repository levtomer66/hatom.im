'use client';

// /calories: each person's private food diary against a daily goal
// (docs/superpowers/specs/2026-11-21-calories-design.md). The day screen:
// date arrows, the ring, four meal cards, the week. "Today" is this device's
// date, worked out after mount; every route takes the date from here.

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { FaChevronLeft, FaChevronRight, FaCog, FaPlus } from 'react-icons/fa';
import { hasPermission } from '@/lib/permissions';
import {
  defaultMeal, mealTotals, sumTotals, DEFAULT_GOAL, MEALS, MEAL_NAMES,
  type Entry, type Meal, type Settings, type Totals,
} from '@/lib/calories/calories';
import type { DayResponse } from '@/lib/calories/api-types';
import { SwipeRow, Thumb } from '../shopping/ui';
import AddSheet from './AddSheet';
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
  | { kind: 'add'; meal: Meal }
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

  useEffect(() => {
    const t = localToday();
    setToday(t);
    setDate(t);
  }, []);

  const load = useCallback(async (d: string) => {
    try {
      const res = await api.getDay(d);
      setDay((cur) => (cur && cur.date !== d && res.date !== d ? cur : res));
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'לא נטען');
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
      setPending((list) => list.filter((x) => x.tempId !== p.tempId));
      await load(p.date);
    } catch (e) {
      setPending((list) => list.map((x) => (x.tempId === p.tempId ? { ...x, failed: true } : x)));
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
          <button type="button" className="sh-btn sh-btn--primary cal-wide cal-add-main" onClick={() => setSheet({ kind: 'add', meal: date === today ? defaultMeal(new Date().getHours()) : 'snack' })}>
            <FaPlus aria-hidden /> הוספה
          </button>
          {MEALS.map((m) => {
            const entries = shown.entries.filter((e) => e.meal === m);
            const waiting = mine.filter((p) => p.entry.meal === m);
            return (
              <section key={m} className="sh-card cal-meal" aria-label={MEAL_NAMES[m]}>
                <header className="cal-meal-head">
                  <h2>{MEAL_NAMES[m]}</h2>
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
        <AddSheet meal={sheet.meal} recent={shown.recent} canShop={canShop} busy={false} onLog={log} onClose={() => setSheet(null)} />
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
        <SettingsSheet settings={settings} onSave={saveSettings} onMeals={() => setSheet({ kind: 'meals' })} onClose={() => setSheet(null)} />
      ) : null}
      {sheet?.kind === 'meals' ? <MealsSheet onClose={() => setSheet(null)} /> : null}

      {toast ? <div className="sh-toast" role="status">{toast}</div> : null}
    </main>
  );
}
