'use client';

// The calendar (docs/superpowers/specs/2026-11-24-pregnancy-design.md § The calendar):
// the "היום" strip, 40 week cubes, the Sunday–Saturday week sheet, and the
// event and reminder editors. Editors save as you change them (useAutosave):
// a new event or reminder is created by its first valid save.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FaBell, FaPlus } from 'react-icons/fa';
import { addDays, calendarWeek, dateOfDay, dayOfPregnancy, heDate, weekDay } from '@/lib/pregnancy/dates';
import type { Pregnancy } from '@/lib/pregnancy/pregnancy';
import { openSuggestions, todayStrip, weekMarks, SUGGESTIONS, type PEvent, type Reminder, type Suggestion } from '@/lib/pregnancy/schedule';
import { moodColor, MOODS, SYMPTOMS, type DayLog, type WeekMark } from '@/lib/pregnancy/daylog';
import Sheet from '../calories/Sheet';
import { statusText, useAutosave } from '../calories/autosave';
import * as api from './api';

const WEEKDAYS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];
const dm = (date: string) => heDate(date).split('.').slice(0, 2).join('.');
const err = (e: unknown) => (e instanceof Error ? e.message : 'לא נשמר');

type OnP = (p: Pregnancy) => void;

// ── the "היום" strip ──

/** "איך היום?" or, once today has a log, "🙂 · 2 תסמינים". */
function howToday(d: DayLog | null): string {
  if (!d) return 'איך היום?';
  const n = SYMPTOMS.filter((s) => d.sym?.[s.id]).length;
  const parts = [d.mood ? MOODS[d.mood - 1] : '', n === 1 ? 'תסמין אחד' : n ? `${n} תסמינים` : '', !d.mood && !n ? 'נרשם היום' : ''].filter(Boolean);
  return parts.join(' · ');
}

export function TodayStrip({ p, today, todayLog, onP, onEvent, onReminders, onWeek, onDay }: {
  p: Pregnancy; today: string; todayLog: DayLog | null; onP: OnP; onEvent: (e: PEvent) => void; onReminders: () => void; onWeek: (w: number) => void; onDay: () => void;
}) {
  const items = todayStrip(p, today);
  const [busy, setBusy] = useState<string | null>(null);
  const tick = async (id: string, done: boolean) => {
    setBusy(id);
    try { onP((await api.tick(id, today, done, today)).p); } catch { /* the tick stays as it was */ } finally { setBusy(null); }
  };
  const week = weekDay(dayOfPregnancy(p.edd, today)).w;
  return (
    <section className="sh-card pg-today" aria-label="היום">
      <header className="cal-meal-head">
        <h2>היום</h2>
        <button type="button" className="cal-link" onClick={onReminders}><FaBell aria-hidden /> תזכורות</button>
      </header>
      <button type="button" className={`sh-chip pg-howday${todayLog ? ' is-on' : ''}`} onClick={onDay}>{howToday(todayLog)}</button>
      {items.length ? (
        <ul className="pg-strip">
          {items.map((it) => {
            const ev = p.events.find((e) => e.id === it.id);
            if (it.kind === 'reminder') {
              return (
                <li key={`r${it.id}`} className={it.done ? 'is-done' : ''}>
                  <label className="pg-check">
                    <input type="checkbox" checked={!!it.done} disabled={busy === it.id} onChange={(e) => void tick(it.id, e.target.checked)} />
                    <span>{it.text}</span>
                  </label>
                </li>
              );
            }
            return (
              <li key={`${it.kind}${it.id}`}>
                <button type="button" className="pg-strip-btn" onClick={() => (ev ? onEvent(ev) : onWeek(week))}>
                  <span aria-hidden>{it.kind === 'event' ? '📍' : it.kind === 'tomorrow' ? '⏰' : '🗓️'}</span>
                  <span>
                    {it.kind === 'tomorrow' ? 'מחר: ' : it.kind === 'window' ? 'הזמן ל' : ''}{it.text}
                    {it.time ? <small> · {it.time}</small> : null}
                    {it.kind === 'window' ? <small> · לקבוע תור</small> : null}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : <p className="cal-muted">אין משהו להיום. אפשר להוסיף תזכורת קבועה, כמו ויטמינים.</p>}
    </section>
  );
}

// ── 40 cubes ──

export function WeekCubes({ p, today, summary, onWeek }: { p: Pregnancy; today: string; summary: Record<number, WeekMark>; onWeek: (w: number) => void }) {
  const now = weekDay(dayOfPregnancy(p.edd, today)).w;
  const weeks = Array.from({ length: 40 }, (_, i) => i + 1);
  return (
    <section className="sh-card pg-cubes-card" aria-label="שבועות ההריון">
      <header className="cal-meal-head"><h2>40 שבועות</h2><span className="cal-muted">נקודה = תור · עיגול = חלון לבדיקה · פס = מצב רוח · ⭐ = אבן דרך</span></header>
      <div className="pg-cubes" role="list">
        {weeks.map((w) => {
          const m = weekMarks(p, w);
          const log = summary[w];
          const moodText = log?.mood ? `, מצב רוח ${MOODS[Math.round(log.mood) - 1]} בממוצע` : '';
          const tri = w < 14 ? 1 : w < 28 ? 2 : 3;
          const state = w < now ? 'is-past' : w === now ? 'is-now' : '';
          return (
            <button key={w} type="button" role="listitem" className={`pg-cube t${tri} ${state}`} aria-current={w === now ? 'date' : undefined}
              aria-label={`שבוע ${w}${m.events ? `, ${m.events} אירועים` : ''}${m.windows ? `, ${m.windows} בדיקות לקבוע` : ''}${moodText}${log?.star ? ', אבן דרך' : ''}`} onClick={() => onWeek(w)}>
              <span>{w}</span>
              {log?.star ? <i className="pg-cube-star" aria-hidden>⭐</i> : null}
              {log?.mood ? <i className="pg-cube-mood" aria-hidden style={{ background: moodColor(log.mood) }} /> : null}
              <i className="pg-cube-marks" aria-hidden>
                {m.events ? <b className="pg-dot" /> : null}
                {m.windows ? <b className="pg-dot is-hollow" /> : null}
              </i>
            </button>
          );
        })}
      </div>
    </section>
  );
}

// ── one week: Sunday to Saturday ──

export function WeekSheet({ p, week, today, onP, onEvent, onNew, onDay, onClose }: {
  p: Pregnancy; week: number; today: string; onP: OnP;
  onEvent: (e: PEvent) => void; onNew: (date: string, s?: Suggestion) => void; onDay: (date: string, day: DayLog | null) => void; onClose: () => void;
}) {
  // The Sunday–Saturday week holding the middle of the pregnancy week (most of its days); ‹ › for the rest.
  const first = dateOfDay(p.edd, week * 7 + 3);
  const [offset, setOffset] = useState(0);
  const days = calendarWeek(addDays(first, offset * 7));
  const [logs, setLogs] = useState<Record<string, DayLog>>({});
  useEffect(() => {
    let live = true;
    void api.getDays(days[0], days[6]).then((r) => { if (live) setLogs(Object.fromEntries(r.days.map((d) => [d.date, d]))); }).catch(() => {});
    return () => { live = false; };
  }, [days[0], days[6]]); // eslint-disable-line react-hooks/exhaustive-deps
  const weekEvents = p.events.filter((e) => days.includes(e.date)).sort((x, y) => `${x.date} ${x.time ?? ''}`.localeCompare(`${y.date} ${y.time ?? ''}`));
  const open = openSuggestions(p.events, p.dismissed).filter((s) => s.from <= week && s.to >= week);
  const dismissed = SUGGESTIONS.filter((s) => p.dismissed.includes(s.id) && s.from <= week && s.to >= week);
  const [busy, setBusy] = useState(false);
  const dismiss = async (s: Suggestion, on: boolean) => {
    setBusy(true);
    try { onP((await api.dismiss(s.id, on)).p); } catch { /* unchanged */ } finally { setBusy(false); }
  };
  return (
    <Sheet title={`שבוע ${week}`} onClose={onClose} className="pg-week">
      <div className="pg-week-nav">
        <button type="button" className="sh-icon-btn" aria-label="שבוע קודם" onClick={() => setOffset(offset - 1)}>›</button>
        <span>{dm(days[0])}–{dm(days[6])}</span>
        <button type="button" className="sh-icon-btn" aria-label="שבוע הבא" onClick={() => setOffset(offset + 1)}>‹</button>
      </div>
      <div className="pg-wdays" role="group" aria-label="ימי השבוע">
        {days.map((date, i) => {
          const day = dayOfPregnancy(p.edd, date);
          const { w, d } = weekDay(day);
          const log = logs[date];
          const evs = p.events.filter((e) => e.date === date);
          const star = log?.notes?.some((n) => n.star);
          const cls = [w === week ? 'is-in' : '', date === today ? 'is-today' : '', date > today ? 'is-future' : ''].join(' ');
          const label = [`${WEEKDAYS[i]} ${heDate(date)}`, day >= 0 ? `שבוע ${w}+${d}` : '', date === today ? 'היום' : '',
            log?.mood ? `מצב רוח ${MOODS[log.mood - 1]}` : '', star ? 'אבן דרך' : '', evs.length ? `${evs.length === 1 ? 'אירוע אחד' : `${evs.length} אירועים`}` : ''].filter(Boolean).join(', ');
          return (
            <button key={date} type="button" className={`pg-wday ${cls}`} onClick={() => onDay(date, log ?? null)} aria-label={label}>
              <small aria-hidden>{WEEKDAYS[i]}</small>
              <b aria-hidden>{Number(date.slice(8))}</b>
              {star ? <i className="pg-cube-star" aria-hidden>⭐</i> : null}
              {evs.length ? <span className="pg-cube-marks" aria-hidden><b className="pg-dot" /></span> : null}
              {log?.mood ? <i className="pg-cube-mood" aria-hidden style={{ background: moodColor(log.mood) }} /> : null}
            </button>
          );
        })}
      </div>
      {weekEvents.length ? (
        <ul className="pg-wevents">
          {weekEvents.map((e) => (
            <li key={e.id}>
              <button type="button" className="pg-ev" onClick={() => onEvent(e)}>📍 {e.title}<small> · {WEEKDAYS[days.indexOf(e.date)]} {dm(e.date)}{e.time ? ` · ${e.time}` : ''}</small></button>
            </li>
          ))}
        </ul>
      ) : <p className="cal-muted pg-wdays-hint">לוחצים על יום כדי לרשום אותו או להוסיף אירוע.</p>}
      {open.length ? (
        <>
          <h3 className="sh-section-title">בדיקות שבדרך כלל עושים עכשיו</h3>
          <ul className="pg-sugs">
            {open.map((s) => (
              <li key={s.id}>
                <p><b>{s.name}</b><small> · שבועות {s.from}{s.to !== s.from ? `–${s.to}` : ''} · {s.why}</small></p>
                <div className="pg-sug-btns">
                  <button type="button" className="sh-chip" onClick={() => onNew(dateOfDay(p.edd, Math.max(week, s.from) * 7), s)}>לקבוע תאריך</button>
                  <button type="button" className="sh-chip" disabled={busy} onClick={() => void dismiss(s, true)}>לא רלוונטי</button>
                </div>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {dismissed.length ? (
        <p className="cal-muted">הוסתרו: {dismissed.map((s, i) => <React.Fragment key={s.id}>{i ? ', ' : ''}<button type="button" className="cal-link" disabled={busy} onClick={() => void dismiss(s, false)}>{s.name}</button></React.Fragment>)}</p>
      ) : null}
      <p className="sh-credit">לפי סדר המעקב המקובל בישראל. התאריכים המדויקים – לפי הרופא/ה.</p>
    </Sheet>
  );
}

// ── one event ──

interface EventFields { title: string; date: string; time: string; note: string; remindBefore: boolean }

export function EventSheet({ p, event, date, suggestion, onP, onClose }: {
  p: Pregnancy; event?: PEvent; date?: string; suggestion?: Suggestion; onP: OnP; onClose: () => void;
}) {
  const [f, setF] = useState<EventFields>({
    title: event?.title ?? suggestion?.name ?? '',
    // A suggestion asks for its date: opening it mustn't book it.
    date: event?.date ?? (suggestion ? '' : date ?? ''),
    time: event?.time ?? '',
    note: event?.note ?? '',
    remindBefore: event?.remindBefore ?? true,
  });
  const id = useRef<string | null>(event?.id ?? null);
  const kind = event?.kind ?? suggestion?.id ?? 'custom';
  const [error, setError] = useState<string | null>(null);
  const valid = f.title.trim() && /^\d{4}-\d{2}-\d{2}$/.test(f.date);
  const body = valid ? { title: f.title, date: f.date, time: f.time || undefined, note: f.note || undefined, remindBefore: f.remindBefore, kind } : undefined;
  const initial = event ? { title: event.title, date: event.date, time: event.time, note: event.note, remindBefore: event.remindBefore, kind: event.kind } : undefined;

  const save = useCallback(async (b: NonNullable<typeof body>): Promise<string | null> => {
    try {
      if (id.current) {
        onP((await api.updateEvent({ ...b, id: id.current } as PEvent)).p);
      } else {
        const before = new Set(p.events.map((e) => e.id));
        const next = (await api.addEvent(b as Omit<PEvent, 'id'>)).p;
        id.current = next.events.find((e) => !before.has(e.id))?.id ?? null;
        onP(next);
      }
      setError(null);
      return null;
    } catch (e) {
      setError(err(e));
      return err(e);
    }
  }, [onP, p.events]);
  const { status, flush } = useAutosave(body, initial, save);
  const close = () => { flush(); onClose(); };
  const remove = async () => {
    if (!id.current) return onClose();
    try { onP((await api.deleteEvent(id.current)).p); onClose(); } catch (e) { setError(err(e)); }
  };

  return (
    <Sheet title={event ? 'אירוע' : suggestion ? suggestion.name : 'אירוע חדש'} onClose={close}>
      <form className="pg-form" onSubmit={(e) => { e.preventDefault(); close(); }}>
        <label className="cal-field"><span>מה</span><input value={f.title} maxLength={80} placeholder="תור לרופאת נשים" autoFocus={!event && !suggestion} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
        <div className="pg-row2">
          <label className="cal-field"><span>תאריך</span><input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></label>
          <label className="cal-field"><span>שעה</span><input type="time" value={f.time} onChange={(e) => setF({ ...f, time: e.target.value })} /></label>
        </div>
        {f.date ? <p className="cal-muted">{(() => { const { w, d } = weekDay(dayOfPregnancy(p.edd, f.date)); return <>בשבוע <bdi dir="ltr">{w}+{d}</bdi></>; })()}</p> : null}
        <label className="cal-field"><span>הערה</span><textarea rows={2} maxLength={300} value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></label>
        <label className="pg-check"><input type="checkbox" checked={f.remindBefore} onChange={(e) => setF({ ...f, remindBefore: e.target.checked })} /><span>תזכורת יום לפני</span></label>
        {error ? <p className="cal-error" role="alert">{error}</p> : null}
        <p className="cal-muted cal-save-state" aria-live="polite">{valid ? statusText(status) : suggestion && !f.date ? 'בוחרים תאריך וזה נשמר' : ''}</p>
        {id.current || event ? <button type="button" className="sh-btn sh-btn--danger cal-wide" onClick={() => void remove()}>מחיקה</button> : null}
      </form>
    </Sheet>
  );
}

// ── reminders ──

const REPEATS = [['daily', 'כל יום'], ['weekdays', 'בימים'], ['once', 'פעם אחת']] as const;

function ReminderEditor({ p, r, today, onP, onDone }: { p: Pregnancy; r?: Reminder; today: string; onP: OnP; onDone: () => void }) {
  const [text, setText] = useState(r?.text ?? '');
  const [repeat, setRepeat] = useState<Reminder['repeat']>(r?.repeat ?? 'daily');
  const [days, setDays] = useState<number[]>(r?.days ?? [0, 1, 2, 3, 4]);
  const [date, setDate] = useState(r?.date ?? today);
  const id = useRef<string | null>(r?.id ?? null);
  const [error, setError] = useState<string | null>(null);
  const valid = text.trim() && (repeat !== 'weekdays' || days.length) && (repeat !== 'once' || date);
  const body = valid ? { text, repeat, ...(repeat === 'weekdays' ? { days } : {}), ...(repeat === 'once' ? { date } : {}) } : undefined;
  const initial = r ? { text: r.text, repeat: r.repeat, ...(r.repeat === 'weekdays' ? { days: r.days } : {}), ...(r.repeat === 'once' ? { date: r.date } : {}) } : undefined;
  const save = useCallback(async (b: NonNullable<typeof body>): Promise<string | null> => {
    try {
      if (id.current) onP((await api.updateReminder({ ...b, id: id.current } as Omit<Reminder, 'done'>)).p);
      else {
        const before = new Set(p.reminders.map((x) => x.id));
        const next = (await api.addReminder(b as Omit<Reminder, 'id' | 'done'>)).p;
        id.current = next.reminders.find((x) => !before.has(x.id))?.id ?? null;
        onP(next);
      }
      setError(null);
      return null;
    } catch (e) {
      setError(err(e));
      return err(e);
    }
  }, [onP, p.reminders]);
  const { status, flush } = useAutosave(body, initial, save);
  const remove = async () => {
    if (id.current) {
      try { onP((await api.deleteReminder(id.current)).p); } catch (e) { setError(err(e)); return; }
    }
    onDone();
  };
  return (
    <form className="pg-form pg-rem-edit" onSubmit={(e) => { e.preventDefault(); flush(); onDone(); }}>
      <label className="cal-field"><span>תזכורת</span><input value={text} maxLength={80} placeholder="ויטמינים" autoFocus={!r} onChange={(e) => setText(e.target.value)} /></label>
      <div className="cal-chips" role="radiogroup" aria-label="חזרה">
        {REPEATS.map(([k, label]) => <button key={k} type="button" role="radio" aria-checked={repeat === k} className={`sh-chip ${repeat === k ? 'is-on' : ''}`} onClick={() => setRepeat(k)}>{label}</button>)}
      </div>
      {repeat === 'weekdays' ? (
        <div className="cal-chips" aria-label="ימים">
          {WEEKDAYS.map((n, i) => (
            <button key={n} type="button" aria-pressed={days.includes(i)} className={`sh-chip ${days.includes(i) ? 'is-on' : ''}`}
              onClick={() => setDays(days.includes(i) ? days.filter((x) => x !== i) : [...days, i].sort())}>{n}</button>
          ))}
        </div>
      ) : null}
      {repeat === 'once' ? <label className="cal-field"><span>תאריך</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label> : null}
      {error ? <p className="cal-error" role="alert">{error}</p> : null}
      <div className="pg-rem-foot">
        <span className="cal-muted cal-save-state" aria-live="polite">{valid ? statusText(status) : ''}</span>
        <button type="button" className="cal-link" onClick={() => { flush(); onDone(); }}>סיום</button>
        <button type="button" className="cal-link pg-danger" onClick={() => void remove()}>מחיקה</button>
      </div>
    </form>
  );
}

const repeatText = (r: Reminder) => r.repeat === 'daily' ? 'כל יום' : r.repeat === 'once' ? heDate(r.date ?? '') : (r.days ?? []).map((d) => WEEKDAYS[d]).join(' ');

export function RemindersSheet({ p, today, onP, onClose }: { p: Pregnancy; today: string; onP: OnP; onClose: () => void }) {
  const [editing, setEditing] = useState<string | 'new' | null>(p.reminders.length ? null : 'new');
  return (
    <Sheet title="תזכורות" onClose={onClose}>
      <ul className="pg-rems">
        {p.reminders.map((r) => (
          <li key={r.id}>
            {editing === r.id
              ? <ReminderEditor p={p} r={r} today={today} onP={onP} onDone={() => setEditing(null)} />
              : <button type="button" className="pg-rem" onClick={() => setEditing(r.id)}><span>{r.text}</span><small>{repeatText(r)}</small></button>}
          </li>
        ))}
      </ul>
      {editing === 'new'
        ? <ReminderEditor p={p} today={today} onP={onP} onDone={() => setEditing(null)} />
        : <button type="button" className="sh-btn cal-wide" onClick={() => setEditing('new')}><FaPlus aria-hidden /> תזכורת חדשה</button>}
      <p className="cal-muted pg-note">התזכורות מופיעות בדף בלבד (בלי התראות לטלפון).</p>
    </Sheet>
  );
}
