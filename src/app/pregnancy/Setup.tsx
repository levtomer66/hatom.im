'use client';

// Setting up (the one "להתחיל" button) and ⚙ (everything saves as you change it):
// how the pregnancy is dated, her pre-pregnancy weight and height, the caffeine
// limit, who's in it, and "הלידה הייתה 🎉". Spec § Access, § The week.

import React, { useCallback, useState } from 'react';
import { eddFrom, heDate, type DatingMethod } from '@/lib/pregnancy/dates';
import type { Dating, Pregnancy } from '@/lib/pregnancy/pregnancy';
import Sheet from '../calories/Sheet';
import { statusText, useAutosave } from '../calories/autosave';
import * as api from './api';

const METHODS: [DatingMethod, string, string][] = [
  ['lmp', 'וסת אחרונה', 'היום הראשון של הווסת האחרונה'],
  ['us', 'לפי אולטרסאונד', 'תאריך הבדיקה והשבוע שנמדד'],
  ['transfer5', 'החזרה (יום 5)', 'תאריך החזרת עובר בן 5 ימים'],
  ['transfer3', 'החזרה (יום 3)', 'תאריך החזרת עובר בן 3 ימים'],
  ['edd', 'תאריך לידה משוער', 'התאריך שהרופא/ה נתנו'],
];

interface DateFields { method: DatingMethod; date: string; w: string; d: string }

const toBody = (f: DateFields) => ({ method: f.method, date: f.date, ...(f.method === 'us' ? { w: Number(f.w), d: Number(f.d || 0) } : {}) });
const fieldsOf = (d?: Dating): DateFields => ({ method: d?.method ?? 'lmp', date: d?.date ?? '', w: d?.w !== undefined ? String(d.w) : '', d: d?.d !== undefined ? String(d.d) : '' });
const num = (s: string) => (s.trim() ? Number(s.replace(',', '.')) : null);

function DatingFields({ f, onChange }: { f: DateFields; onChange: (f: DateFields) => void }) {
  const hint = METHODS.find((m) => m[0] === f.method)?.[2];
  const body = toBody(f);
  const edd = f.date ? eddFrom(body.method, body.date, body.w, body.d) : null;
  return (
    <>
      <div className="cal-chips is-scroll" role="radiogroup" aria-label="לפי מה">
        {METHODS.map(([k, label]) => (
          <button key={k} type="button" role="radio" aria-checked={f.method === k} className={`sh-chip ${f.method === k ? 'is-on' : ''}`} onClick={() => onChange({ ...f, method: k })}>{label}</button>
        ))}
      </div>
      <label className="cal-field"><span>{hint}</span><input type="date" value={f.date} onChange={(e) => onChange({ ...f, date: e.target.value })} /></label>
      {f.method === 'us' ? (
        <div className="pg-row2">
          <label className="cal-field"><span>שבוע</span><input inputMode="numeric" value={f.w} placeholder="8" onChange={(e) => onChange({ ...f, w: e.target.value })} /></label>
          <label className="cal-field"><span>ימים</span><input inputMode="numeric" value={f.d} placeholder="2" onChange={(e) => onChange({ ...f, d: e.target.value })} /></label>
        </div>
      ) : null}
      {edd && f.method !== 'edd' ? <p className="cal-muted">תאריך לידה משוער: <b>{heDate(edd)}</b></p> : null}
    </>
  );
}

export function Setup({ today, heightKnown, onDone }: { today: string; heightKnown: boolean; onDone: () => void }) {
  const [f, setF] = useState<DateFields>(fieldsOf());
  const [kg, setKg] = useState('');
  const [height, setHeight] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      await api.setup({ ...toBody(f), preKg: num(kg), heightCm: heightKnown ? null : num(height), today });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'לא נשמר');
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="sh-card pg-setup">
      <h2>מזל טוב! 🤍</h2>
      <p className="cal-muted">כמה פרטים כדי לחשב את השבוע. אפשר לשנות בכל רגע ב־⚙.</p>
      <form className="pg-form" onSubmit={(e) => { e.preventDefault(); void start(); }}>
        <DatingFields f={f} onChange={setF} />
        <div className="pg-row2">
          <label className="cal-field"><span>משקל לפני ההריון (ק״ג)</span><input inputMode="decimal" value={kg} placeholder="60" onChange={(e) => setKg(e.target.value)} /></label>
          {!heightKnown ? <label className="cal-field"><span>גובה (ס״מ)</span><input inputMode="numeric" value={height} placeholder="165" onChange={(e) => setHeight(e.target.value)} /></label> : null}
        </div>
        <p className="cal-muted pg-note">המשקל והגובה – בשביל מעקב העלייה במשקל. לא חובה.</p>
        {error ? <p className="cal-error" role="alert">{error}</p> : null}
        <button type="submit" className="sh-btn sh-btn--primary cal-wide" disabled={busy || !f.date}>{busy ? 'רגע…' : 'להתחיל'}</button>
      </form>
    </section>
  );
}

export function InviteCards({ invites, onDone }: { invites: { id: string; owner: string; by: string }[]; onDone: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const answer = async (id: string, accept: boolean) => {
    try {
      await api.answerInvite(id, accept);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'לא הצליח');
    }
  };
  return (
    <>
      {invites.map((i) => (
        <section key={i.id} className="sh-card pg-invite">
          <p><b>{i.by}</b> מזמינ/ה אותך לעקוב אחרי ההריון 🤍</p>
          <div className="pg-sug-btns">
            <button type="button" className="sh-btn sh-btn--primary" onClick={() => void answer(i.id, true)}>הצטרפות</button>
            <button type="button" className="sh-btn" onClick={() => void answer(i.id, false)}>לא עכשיו</button>
          </div>
        </section>
      ))}
      {error ? <p className="cal-error" role="alert">{error}</p> : null}
    </>
  );
}

export function SettingsSheet({ p, me, today, heightFromProfile, onP, onLeft, onClose }: {
  p: Pregnancy; me: string; today: string; heightFromProfile: boolean; onP: (p: Pregnancy) => void; onLeft: () => void; onClose: () => void;
}) {
  const owner = p.owner === me;
  const [f, setF] = useState<DateFields>(fieldsOf(p.dating));
  const [kg, setKg] = useState(p.preKg !== null ? String(p.preKg) : '');
  const [height, setHeight] = useState(p.heightCm !== null ? String(p.heightCm) : '');
  const [limit, setLimit] = useState(String(p.cafLimit));
  const [email, setEmail] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  const patch = useCallback(async (b: Record<string, unknown>): Promise<string | null> => {
    try {
      onP((await api.patch({ ...b, today })).p);
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : 'לא נשמר';
    }
  }, [onP, today]);

  const dateBody = f.date && (f.method !== 'us' || f.w.trim()) ? toBody(f) : undefined;
  const dates = useAutosave(dateBody, toBody(fieldsOf(p.dating)), patch);
  const kgN = num(kg);
  const hN = num(height);
  const limN = num(limit);
  const body = {
    preKg: kgN,
    ...(heightFromProfile ? {} : { heightCm: hN }),
    ...(limN !== null ? { cafLimit: Math.round(limN) } : {}),
  };
  const mine = useAutosave(owner ? body : undefined, owner ? { preKg: p.preKg, ...(heightFromProfile ? {} : { heightCm: p.heightCm }), cafLimit: p.cafLimit } : undefined, patch);

  const close = () => { dates.flush(); mine.flush(); onClose(); };
  const invite = async () => {
    setMsg(null);
    try {
      const r = await api.invite(email);
      onP(r.p);
      setEmail('');
      setMsg(r.noAccess ? 'ההזמנה נשלחה. עוד אין לו/ה הרשאה לדף – צריך לתת אותה בדף ההרשאות.' : 'ההזמנה נשלחה – היא תופיע אצלם בדף.');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'לא הצליח');
    }
  };
  const removePerson = async (who: string) => {
    try {
      const r = await api.removePerson(who);
      if (who === me) return onLeft();
      onP(r.p);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'לא הצליח');
    }
  };
  const end = async () => {
    if (!window.confirm('לסמן שהלידה הייתה? הדף יתחיל מחדש, ומה שנשמר עד עכשיו יישמר בצד.')) return;
    try { await api.end(); onLeft(); } catch (e) { setMsg(e instanceof Error ? e.message : 'לא הצליח'); }
  };

  return (
    <Sheet title="הגדרות" onClose={close}>
      <form className="pg-form" onSubmit={(e) => { e.preventDefault(); close(); }}>
        <h3 className="sh-section-title">תיארוך</h3>
        <DatingFields f={f} onChange={setF} />
        {dates.error ? <p className="cal-error" role="alert">{dates.error}</p> : null}
        <p className="cal-muted cal-save-state" aria-live="polite">{statusText(dates.status)}</p>

        {owner ? (
          <>
            <h3 className="sh-section-title">שלי</h3>
            <div className="pg-row2">
              <label className="cal-field"><span>משקל לפני ההריון (ק״ג)</span><input inputMode="decimal" value={kg} onChange={(e) => setKg(e.target.value)} /></label>
              {!heightFromProfile ? <label className="cal-field"><span>גובה (ס״מ)</span><input inputMode="numeric" value={height} onChange={(e) => setHeight(e.target.value)} /></label> : null}
            </div>
            <label className="cal-field"><span>גבול קפאין יומי (מ״ג)</span><input inputMode="numeric" value={limit} onChange={(e) => setLimit(e.target.value)} /></label>
            {mine.error ? <p className="cal-error" role="alert">{mine.error}</p> : null}
            <p className="cal-muted cal-save-state" aria-live="polite">{statusText(mine.status)}</p>
          </>
        ) : null}
      </form>

      <h3 className="sh-section-title">מי עוקב</h3>
      <ul className="pg-people">
        {p.members.map((m) => (
          <li key={m}>
            <span>{m}{m === p.owner ? <small> · בהריון</small> : null}{m === me ? <small> · אני</small> : null}</span>
            {(owner && m !== p.owner) || (!owner && m === me) ? <button type="button" className="cal-link pg-danger" onClick={() => void removePerson(m)}>{m === me ? 'יציאה' : 'הסרה'}</button> : null}
          </li>
        ))}
        {p.invites.map((i) => (
          <li key={i.email} className="is-pending">
            <span>{i.email}<small> · הוזמנ/ה</small></span>
            {owner ? <button type="button" className="cal-link pg-danger" onClick={() => void removePerson(i.email)}>ביטול</button> : null}
          </li>
        ))}
      </ul>
      {owner ? (
        <form className="pg-invite-form" onSubmit={(e) => { e.preventDefault(); void invite(); }}>
          <input type="email" inputMode="email" value={email} placeholder="מייל של בן/בת הזוג" aria-label="מייל להזמנה" onChange={(e) => setEmail(e.target.value)} />
          <button type="submit" className="sh-btn" disabled={!email.trim()}>הזמנה</button>
        </form>
      ) : null}
      {msg ? <p className="cal-muted" role="status">{msg}</p> : null}

      {owner ? <button type="button" className="sh-btn cal-wide pg-end" onClick={() => void end()}>הלידה הייתה 🎉</button> : null}
    </Sheet>
  );
}
