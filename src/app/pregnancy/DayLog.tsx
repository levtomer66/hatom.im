'use client';

// The day log (docs/superpowers/specs/2026-11-26-pregnancy-day-log-design.md): the day
// sheet — mood, symptoms, measurements with their last earlier value, notes, and the
// day's events — and the compact row the week sheet shows under each day. Anyone in
// the pregnancy writes. Each part saves on its own (useAutosave), so two people
// editing one day don't undo each other.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FaPlus, FaStar, FaRegStar, FaTrash } from 'react-icons/fa';
import { dayOfPregnancy, heDate, weekDay } from '@/lib/pregnancy/dates';
import {
  bpValue, dayAllowed, measuresFrom, measureText, trendText, MAX_NOTE_TEXT, MEASURES, MOODS, STRENGTH, SYMPTOMS,
  type DayLog, type DayNote, type MeasureFields, type Measures, type Mood, type PrevValues, type Strength, type SymptomId,
} from '@/lib/pregnancy/daylog';
import type { Pregnancy } from '@/lib/pregnancy/pregnancy';
import type { PEvent } from '@/lib/pregnancy/schedule';
import Sheet from '../calories/Sheet';
import { statusText, useAutosave, type SaveStatus } from '../calories/autosave';
import * as api from './api';

const MOOD_NAMES = ['קשה', 'לא משהו', 'בסדר', 'טוב', 'מעולה'];
const err = (e: unknown) => (e instanceof Error ? e.message : 'לא נשמר');
const wd = (edd: string, date: string) => { const { w, d } = weekDay(dayOfPregnancy(edd, date)); return `${w}+${d}`; };
const who = (email: string, me: string) => (email === me ? 'אני' : email.split('@')[0]);

const fieldsOf = (m?: Measures): MeasureFields => ({
  sys: m?.bp ? String(m.bp[0]) : '', dia: m?.bp ? String(m.bp[1]) : '',
  sugar: m?.sugar !== undefined ? String(m.sugar) : '', belly: m?.belly !== undefined ? String(m.belly) : '', fhr: m?.fhr !== undefined ? String(m.fhr) : '',
});

export function DaySheet({ p, date, today, me, day, onEvent, onNew, onSaved, onClose }: {
  p: Pregnancy; date: string; today: string; me: string; day: DayLog | null;
  onEvent: (e: PEvent) => void; onNew: (date: string) => void; onSaved: (day: DayLog | null) => void; onClose: () => void;
}) {
  const editable = dayAllowed(p.edd, date, today);
  const [mood, setMood] = useState<Mood | null>(day?.mood ?? null);
  const [sym, setSym] = useState<Partial<Record<SymptomId, Strength>>>(day?.sym ?? {});
  const [mf, setMf] = useState<MeasureFields>(fieldsOf(day?.m));
  const [notes, setNotes] = useState<DayNote[]>(day?.notes ?? []);
  const [prev, setPrev] = useState<PrevValues>({});
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { void api.getPrev(date).then((r) => setPrev(r.prev)).catch(() => {}); }, [date]);

  // The last saved measurements: a half-typed blood pressure keeps the saved pair (measuresFrom).
  const savedM = useRef<Measures | undefined>(day?.m);
  const put = useCallback(async (patch: Parameters<typeof api.putDay>[1]): Promise<string | null> => {
    try {
      const saved = (await api.putDay(date, patch, today)).day;
      if ('m' in patch) savedM.current = saved?.m;
      onSaved(saved); setError(null); return null;
    } catch (e) { setError(err(e)); return err(e); }
  }, [date, today, onSaved]);

  const moodSave = useAutosave<{ mood: Mood | null }>({ mood }, { mood: day?.mood ?? null }, put, 300);
  const symSave = useAutosave<{ sym: typeof sym | null }>({ sym: Object.keys(sym).length ? sym : null }, { sym: day?.sym && Object.keys(day.sym).length ? day.sym : null }, put, 500);
  const wantedM = measuresFrom(mf, savedM.current);
  const bpHalf = bpValue(mf.sys, mf.dia) === undefined;
  const mSave = useAutosave<{ m: Measures | null }>(wantedM === undefined ? undefined : { m: wantedM }, { m: day?.m && Object.keys(day.m).length ? day.m : null }, put);

  // Leaving the sheet any way (closing, or for an event) sends what's still waiting.
  const leave = (go: () => void) => { void moodSave.flush(); void symSave.flush(); void mSave.flush(); go(); };
  const close = () => leave(onClose);
  const status: SaveStatus = [moodSave.status, symSave.status, mSave.status].includes('saving') ? 'saving'
    : [moodSave.status, symSave.status, mSave.status].includes('saved') ? 'saved' : 'idle';

  const cycle = (id: SymptomId) => setSym((s) => {
    const next = { ...s };
    const v = ((s[id] ?? 0) + 1) % 4;
    if (v) next[id] = v as Strength; else delete next[id];
    return next;
  });

  // Notes save at once (add / edit on blur / star / delete), each answering the whole day.
  const [draft, setDraft] = useState('');
  const [draftStar, setDraftStar] = useState(false);
  const [busy, setBusy] = useState(false);
  const noteCall = async (fn: () => Promise<{ day: DayLog | null }>) => {
    setBusy(true);
    try { const { day: d } = await fn(); setNotes(d?.notes ?? []); onSaved(d); setError(null); return true; } catch (e) { setError(err(e)); return false; } finally { setBusy(false); }
  };
  const addNote = async () => {
    if (!draft.trim()) return;
    if (await noteCall(() => api.addNote(date, draft, draftStar, today))) { setDraft(''); setDraftStar(false); }
  };

  const events = p.events.filter((e) => e.date === date).sort((a, b) => (a.time ?? '').localeCompare(b.time ?? ''));
  const day0 = dayOfPregnancy(p.edd, date) >= 0;

  return (
    <Sheet title={heDate(date)} onClose={close} className="pg-daysheet">
      <p className="cal-muted pg-daysheet-wd">{day0 ? <>שבוע <bdi dir="ltr">{wd(p.edd, date)}</bdi>{date === today ? ' · היום' : ''}</> : 'לפני תחילת ההריון'}</p>

      {editable ? (
        <>
          <h3 className="sh-section-title">מצב רוח</h3>
          <div className="pg-moods" role="group" aria-label="מצב רוח">
            {MOODS.map((m, i) => (
              <button key={m} type="button" className={`pg-mood${mood === i + 1 ? ' is-on' : ''}`} aria-pressed={mood === i + 1} aria-label={MOOD_NAMES[i]}
                onClick={() => setMood(mood === i + 1 ? null : ((i + 1) as Mood))}>{m}</button>
            ))}
          </div>

          <h3 className="sh-section-title">תסמינים</h3>
          <div className="pg-syms" role="group" aria-label="תסמינים">
            {SYMPTOMS.map((s) => {
              const v = sym[s.id];
              return (
                <button key={s.id} type="button" className={`sh-chip pg-sym${v ? ' is-on' : ''}`} aria-pressed={!!v} onClick={() => cycle(s.id)}
                  aria-label={`${s.name}${v ? `, ${STRENGTH[v - 1]}` : ''}`}>
                  {s.name}{v ? <small> · {STRENGTH[v - 1]}</small> : null}
                </button>
              );
            })}
          </div>
          <p className="cal-muted pg-hint">לחיצה נוספת מחזקת: קל ← בינוני ← חזק ← בלי</p>

          <h3 className="sh-section-title">מדידות</h3>
          {MEASURES.map((def) => {
            const pv = prev[def.id];
            const now = def.id === 'bp' ? bpValue(mf.sys, mf.dia) : mf[def.id].trim() && Number.isFinite(Number(mf[def.id])) ? Number(mf[def.id]) : null;
            return (
              <div key={def.id} className="pg-measure">
                {def.id === 'bp' ? (
                  <div className="cal-field">
                    <span>{def.name} <small>({def.unit})</small></span>
                    <div className="pg-bp">
                      <input inputMode="numeric" aria-label="לחץ דם עליון" placeholder="עליון" value={mf.sys} onChange={(e) => setMf({ ...mf, sys: e.target.value })} />
                      <span aria-hidden>/</span>
                      <input inputMode="numeric" aria-label="לחץ דם תחתון" placeholder="תחתון" value={mf.dia} onChange={(e) => setMf({ ...mf, dia: e.target.value })} />
                    </div>
                    {bpHalf ? <small className="pg-bp-half" role="status">{mf.sys.trim() ? 'חסר ערך תחתון' : 'חסר ערך עליון'} – לחץ הדם יישמר כששניהם מלאים</small> : null}
                  </div>
                ) : (
                  <label className="cal-field">
                    <span>{def.name} <small>({def.unit})</small></span>
                    <input inputMode="numeric" aria-label={def.name} value={mf[def.id]} onChange={(e) => setMf({ ...mf, [def.id]: e.target.value })} />
                  </label>
                )}
                {pv ? (
                  <p className="cal-muted pg-prev">
                    קודם {measureText(def.id, pv.value)} ב־<bdi dir="ltr">{wd(p.edd, pv.date)}</bdi>
                    {now ? <> · <bdi dir="ltr">{trendText(def.id, now, pv.value)}</bdi></> : null}
                  </p>
                ) : null}
              </div>
            );
          })}

          <h3 className="sh-section-title">הערות</h3>
          {notes.length ? (
            <ul className="pg-notes">
              {notes.map((n) => <NoteRow key={n.id} n={n} me={me} busy={busy}
                onSave={(text, star) => void noteCall(() => api.editNote(date, n.id, text, star))}
                onDelete={() => void noteCall(() => api.deleteNote(date, n.id))} />)}
            </ul>
          ) : null}
          <div className="pg-note-new">
            <button type="button" className="sh-icon-btn pg-star" aria-pressed={draftStar} aria-label="אבן דרך" onClick={() => setDraftStar(!draftStar)}>{draftStar ? <FaStar /> : <FaRegStar />}</button>
            <textarea rows={2} maxLength={MAX_NOTE_TEXT} placeholder="מה קרה היום? (⭐ = אבן דרך, כמו בעיטה ראשונה)" value={draft} onChange={(e) => setDraft(e.target.value)} />
            <button type="button" className="sh-btn" disabled={busy || !draft.trim()} onClick={() => void addNote()}>להוסיף</button>
          </div>
        </>
      ) : (
        <p className="cal-muted">{date > today ? 'את היום הזה אפשר יהיה למלא כשיגיע.' : 'אפשר לרשום רק מתחילת ההריון.'}</p>
      )}

      <h3 className="sh-section-title">אירועים</h3>
      {events.map((e) => (
        <button key={e.id} type="button" className="pg-ev" onClick={() => leave(() => onEvent(e))}>📍 {e.title}{e.time ? <small> · {e.time}</small> : null}</button>
      ))}
      <button type="button" className="sh-chip pg-add-ev" onClick={() => leave(() => onNew(date))}><FaPlus aria-hidden /> אירוע</button>

      {error ? <p className="cal-error" role="alert">{error}</p> : null}
      <p className="cal-muted cal-save-state" aria-live="polite">{statusText(status)}</p>
    </Sheet>
  );
}

function NoteRow({ n, me, busy, onSave, onDelete }: { n: DayNote; me: string; busy: boolean; onSave: (text: string, star: boolean) => void; onDelete: () => void }) {
  const [text, setText] = useState(n.text);
  useEffect(() => setText(n.text), [n.text]);
  const changed = text.trim() && text.trim() !== n.text;
  return (
    <li className={`pg-note${n.star ? ' is-star' : ''}`}>
      <button type="button" className="sh-icon-btn pg-star" disabled={busy} aria-pressed={!!n.star} aria-label="אבן דרך" onClick={() => onSave(n.text, !n.star)}>{n.star ? <FaStar /> : <FaRegStar />}</button>
      <div className="pg-note-body">
        <textarea rows={1} maxLength={MAX_NOTE_TEXT} value={text} aria-label="הערה" onChange={(e) => setText(e.target.value)} onBlur={() => { if (changed) onSave(text, !!n.star); }} />
        <small className="cal-muted">{who(n.by, me)} · {new Date(n.at).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' })}</small>
      </div>
      <button type="button" className="sh-icon-btn" disabled={busy} aria-label="מחיקת הערה" onClick={onDelete}><FaTrash /></button>
    </li>
  );
}

/** Under a day in the week sheet: mood, symptoms with their strength, measurements, notes' first lines. */
export function DayLogRow({ day }: { day: DayLog }) {
  const syms = SYMPTOMS.filter((s) => day.sym?.[s.id]);
  const ms = MEASURES.filter((m) => day.m?.[m.id] !== undefined);
  if (!day.mood && !syms.length && !ms.length && !day.notes?.length) return null;
  return (
    <div className="pg-daylog">
      {day.mood ? <span className="pg-daylog-mood" aria-label={`מצב רוח: ${MOOD_NAMES[day.mood - 1]}`}>{MOODS[day.mood - 1]}</span> : null}
      {syms.map((s) => (
        <span key={s.id} className="pg-daylog-sym" aria-label={`${s.name}, ${STRENGTH[day.sym![s.id]! - 1]}`}>
          {s.name} <i aria-hidden>{'•'.repeat(day.sym![s.id]!)}</i>
        </span>
      ))}
      {ms.length ? <span className="pg-daylog-m">{ms.map((m) => `${m.name} ${measureText(m.id, day.m![m.id]!)}`).join(' · ')}</span> : null}
      {day.notes?.map((n) => <span key={n.id} className="pg-daylog-note">{n.star ? '⭐ ' : ''}{n.text.split('\n')[0]}</span>)}
    </div>
  );
}
