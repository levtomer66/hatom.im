'use client';

// /pregnancy (docs/superpowers/specs/2026-11-24-pregnancy-design.md): the week hero,
// the "היום" strip, the caffeine hero with its one-tap drinks, food search into
// the calories diary, the weight-gain tile and the 40 week cubes. "Today" is this
// device's date, worked out after mount. The owner's drinks and food are her
// calories diary's own entries (/api/calories, which lets a pregnant owner in);
// members see only her caffeine.

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { FaChevronLeft, FaChevronRight, FaCog } from 'react-icons/fa';
import { hasPermission } from '@/lib/permissions';
import { defaultMeal, rollToday, type Entry, type Meal, type Totals } from '@/lib/calories/calories';
import type { DayResponse } from '@/lib/calories/api-types';
import { dayOfPregnancy } from '@/lib/pregnancy/dates';
import { drinkById } from '@/lib/pregnancy/drinks';
import type { CafRow, Pregnancy, PregnancyState } from '@/lib/pregnancy/pregnancy';
import type { PEvent, Suggestion } from '@/lib/pregnancy/schedule';
import AddSheet from '../calories/AddSheet';
import EditSheet from '../calories/EditSheet';
import type { Picked } from '../calories/FoodPicker';
import SearchBar from '../calories/SearchBar';
import * as calApi from '../calories/api';
import { PregnantProvider } from '../calories/pregnant';
import { CafRows, CaffeineHero, DrinksRow } from './Caffeine';
import { EventSheet, RemindersSheet, TodayStrip, WeekCubes, WeekSheet } from './Calendar';
import GainTile from './GainTile';
import { InviteCards, SettingsSheet, Setup } from './Setup';
import WeekHero, { StageSheet } from './WeekHero';
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

const rowOf = (e: Entry): CafRow => ({
  id: e.id, name: e.name, emoji: (e.ref.kind === 'drink' && e.ref.key ? drinkById(e.ref.key)?.emoji : null) ?? '☕',
  mg: e.caf ?? 0, at: e.at, meal: e.meal, qty: e.qty, unit: e.unit.name,
});

type SheetState =
  | { kind: 'stage'; week: number }
  | { kind: 'week'; week: number }
  | { kind: 'event'; event?: PEvent; date?: string; suggestion?: Suggestion }
  | { kind: 'reminders' }
  | { kind: 'settings' }
  | { kind: 'add'; meal: Meal; picked?: Picked }
  | { kind: 'edit'; entry: Entry }
  | null;

export default function PregnancyPage() {
  const { data: session } = useSession();
  const me = session?.user?.email?.toLowerCase() ?? '';
  const canShop = hasPermission(session, 'shopping');
  const [today, setToday] = useState<string | null>(null);
  const [date, setDate] = useState<string | null>(null);
  const [state, setState] = useState<PregnancyState | null>(null);
  const [day, setDay] = useState<DayResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<SheetState>(null);
  const [toast, setToast] = useState<{ text: string; undo?: () => void } | null>(null);
  const [busyDrink, setBusyDrink] = useState<string | null>(null);

  const dateRef = useRef<string | null>(null);
  dateRef.current = date;
  const todayRef = useRef<string | null>(null);
  todayRef.current = today;

  useEffect(() => {
    const t = localToday();
    setToday(t);
    setDate(t);
  }, []);

  // A page left open past midnight moves on with the day (as /calories does).
  useEffect(() => {
    const check = () => {
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
    const t = todayRef.current ?? d;
    try {
      const s = await api.getState(d, t);
      if (dateRef.current !== d) return;
      setState(s);
      setDay(s.role === 'owner' ? await calApi.getDay(d, t) : null);
      setLoadError(null);
    } catch (e) {
      if (dateRef.current === d) setLoadError(e instanceof Error ? e.message : 'לא נטען');
    }
  }, []);
  useEffect(() => { if (date) void load(date); }, [date, load]);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 4000);
    return () => window.clearTimeout(t);
  }, [toast]);

  const onP = useCallback((p: Pregnancy) => setState((s) => (s ? { ...s, p } : s)), []);

  const shownDay = day && day.date === date ? day : null;
  const entries = useMemo(() => shownDay?.entries ?? [], [shownDay]);
  const ownerRows = useMemo(() => entries.filter((e) => (e.caf ?? 0) > 0).map(rowOf), [entries]);

  if (!date || !today) return <main className="sh-page cal-page pg-page" />;
  const p = state?.p ?? null;
  const owner = state?.role === 'owner';
  const meal: Meal = date === today ? defaultMeal(new Date().getHours()) : 'snack';
  const mg = owner ? ownerRows.reduce((a, r) => a + r.mg, 0) : state?.caf?.mg ?? 0;

  const logDrink = async (id: string) => {
    setBusyDrink(id);
    try {
      const { entry } = await api.logDrink(id, date, meal);
      const d = drinkById(id);
      await load(date);
      setToast({
        text: `נרשם: ${d?.name} · ${d?.mg} מ״ג`,
        undo: () => { void calApi.deleteEntry(date, entry.id).then(() => load(date)); setToast(null); },
      });
    } catch (e) {
      setToast({ text: e instanceof Error ? e.message : 'לא נרשם' });
    } finally {
      setBusyDrink(null);
    }
  };
  const logFood = async (entry: Omit<Entry, 'id' | 'at'>, per100: Totals | null, per?: Totals) => {
    setSheet(null);
    try {
      await calApi.addEntry(date, entry, per100, per);
      await load(date);
      setToast({ text: `נרשם ביומן: ${entry.name}` });
    } catch (e) {
      setToast({ text: e instanceof Error ? e.message : 'לא נרשם' });
    }
  };
  const removeEntry = async (id: string) => {
    setDay((d) => (d ? { ...d, entries: d.entries.filter((e) => e.id !== id) } : d));
    setSheet(null);
    try { await calApi.deleteEntry(date, id); } catch (e) { setToast({ text: e instanceof Error ? e.message : 'לא נמחק' }); }
    void load(date);
  };

  const todayDay = p ? dayOfPregnancy(p.edd, today) : 0;

  return (
    <PregnantProvider value={owner}>
      <main className="sh-page cal-page pg-page">
        <header className="cal-head">
          <button type="button" className="sh-icon-btn" aria-label="היום הקודם" disabled={!p} onClick={() => setDate(shift(date, -1))}><FaChevronRight /></button>
          <h1 className="cal-date">{p ? dateLabel(date, today) : 'הריון'}</h1>
          <button type="button" className="sh-icon-btn" aria-label="היום הבא" disabled={!p || date >= today} onClick={() => setDate(shift(date, 1))}><FaChevronLeft /></button>
          {p ? <button type="button" className="sh-icon-btn cal-gear" aria-label="הגדרות" onClick={() => setSheet({ kind: 'settings' })}><FaCog /></button> : <span className="cal-gear" />}
        </header>

        {loadError ? <p className="cal-error" role="alert">{loadError} <button type="button" className="cal-link" onClick={() => void load(date)}>לנסות שוב</button></p> : null}
        {!state && !loadError ? <div className="pg-hero is-loading" aria-label="טוען" /> : null}

        {state && !p ? (
          <>
            <InviteCards invites={state.invites} onDone={() => void load(date)} />
            <Setup today={today} heightKnown={state.heightCm !== null} onDone={() => void load(date)} />
          </>
        ) : null}

        {state && p ? (
          <>
            <WeekHero p={p} day={todayDay} onOpen={(week) => setSheet({ kind: 'stage', week })} />
            {date === today ? (
              <TodayStrip p={p} today={today} onP={onP} onEvent={(event) => setSheet({ kind: 'event', event })}
                onReminders={() => setSheet({ kind: 'reminders' })} onWeek={(week) => setSheet({ kind: 'week', week })} />
            ) : null}

            <CaffeineHero mg={mg} limit={p.cafLimit} readOnly={!owner} ownerName={owner ? undefined : p.owner.split('@')[0]} />
            {owner ? <DrinksRow busy={busyDrink} onLog={(id) => void logDrink(id)} /> : null}
            {owner
              ? <CafRows rows={ownerRows} onRemove={(id) => void removeEntry(id)} onEdit={(id) => { const e = entries.find((x) => x.id === id); if (e) setSheet({ kind: 'edit', entry: e }); }} />
              : <CafRows rows={state.caf?.rows ?? []} />}
            {state.canCoffee && owner ? <Link href="/coffee-order" className="sh-btn pg-coffee">להזמין קפה ☕</Link> : null}

            {owner && shownDay ? (
              <>
                <SearchBar recent={shownDay.recent} canShop={canShop}
                  onPick={(picked) => setSheet({ kind: 'add', meal, picked })}
                  onLog={(e, per100, per) => void logFood({ ...e, meal }, per100, per)} />
                {state.kcal ? (
                  <Link href="/calories" className="pg-kcal">
                    <span>קלוריות {date === today ? 'היום' : 'ביום הזה'}</span>
                    <b>{state.kcal.eaten.toLocaleString('he-IL')} / {state.kcal.goal.toLocaleString('he-IL')}</b>
                    <span aria-hidden>‹</span>
                  </Link>
                ) : null}
              </>
            ) : null}

            {state.gain ? <GainTile gain={state.gain} /> : null}
            <WeekCubes p={p} today={today} onWeek={(week) => setSheet({ kind: 'week', week })} />
          </>
        ) : null}

        {sheet?.kind === 'stage' && p ? <StageSheet p={p} week={sheet.week} onChange={onP} onClose={() => setSheet(null)} /> : null}
        {sheet?.kind === 'week' && p ? (
          <WeekSheet p={p} week={sheet.week} today={today} onP={onP} onClose={() => setSheet(null)}
            onEvent={(event) => setSheet({ kind: 'event', event })}
            onNew={(d, suggestion) => setSheet({ kind: 'event', date: d, suggestion })} />
        ) : null}
        {sheet?.kind === 'event' && p ? <EventSheet p={p} event={sheet.event} date={sheet.date} suggestion={sheet.suggestion} onP={onP} onClose={() => setSheet(null)} /> : null}
        {sheet?.kind === 'reminders' && p ? <RemindersSheet p={p} today={today} onP={onP} onClose={() => setSheet(null)} /> : null}
        {sheet?.kind === 'settings' && p ? (
          <SettingsSheet p={p} me={me} today={today} heightFromProfile={!!shownDay?.settings?.profile?.heightCm} onP={onP} onClose={() => { setSheet(null); void load(date); }}
            onLeft={() => { setSheet(null); setState(null); void load(date); }} />
        ) : null}
        {sheet?.kind === 'add' && shownDay ? (
          <AddSheet meal={sheet.meal} picked={sheet.picked} recent={shownDay.recent} canShop={canShop} busy={false} onLog={(e, per100, per) => void logFood(e, per100, per)} onClose={() => setSheet(null)} />
        ) : null}
        {sheet?.kind === 'edit' ? (
          <EditSheet entry={sheet.entry} canShop={canShop} onClose={() => setSheet(null)} onDelete={() => void removeEntry(sheet.entry.id)}
            onSave={async (patch) => {
              try {
                await calApi.patchEntry(date, sheet.entry.id, patch);
                await load(date);
                return true;
              } catch (e) {
                setToast({ text: e instanceof Error ? e.message : 'לא נשמר' });
                return false;
              }
            }} />
        ) : null}

        {toast ? (
          <div className="sh-toast" role="status">
            {toast.text}{toast.undo ? <> · <button type="button" className="cal-link pg-undo" onClick={toast.undo}>ביטול</button></> : null}
          </div>
        ) : null}
      </main>
    </PregnantProvider>
  );
}
