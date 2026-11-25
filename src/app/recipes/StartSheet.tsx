'use client';

// + → "איך מתחילים?" (spec 2026-11-25 § Start sheet): four ways in. An idea, a
// pasted text or a link becomes an import request for the cloud agent (it shows
// at the top of the book); "מאפס" opens an empty recipe in the editor.

import { useState } from 'react';
import { FaArrowRight, FaFileAlt, FaLink, FaMagic, FaPen } from 'react-icons/fa';
import type { ImportRequest } from '@/lib/recipes/imports';
import Sheet from '../calories/Sheet';
import { CauldronArt } from './art';
import * as api from './api';

type Step = 'cards' | 'idea' | 'text' | 'link';

const CARDS: { step: Exclude<Step, 'cards'> | 'scratch'; title: string; line: string; Icon: typeof FaMagic }[] = [
  { step: 'idea', title: 'מרעיון למתכון', line: 'כתבו רעיון ונכתוב מתכון מלא', Icon: FaMagic },
  { step: 'text', title: 'הדבקת טקסט', line: 'הדביקו מתכון ונסדר אותו', Icon: FaFileAlt },
  { step: 'link', title: 'קישור', line: 'אינסטגרם, טיקטוק, יוטיוב או אתר מתכונים', Icon: FaLink },
  { step: 'scratch', title: 'מאפס', line: 'טופס ריק, ממלאים לבד', Icon: FaPen },
];

export default function StartSheet({ onClose, onQueued, onScratch }: {
  onClose: () => void; onQueued: (r: ImportRequest) => void; onScratch: () => Promise<void>;
}) {
  const [step, setStep] = useState<Step>('cards');
  const [value, setValue] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const go = (s: Step) => { setStep(s); setValue(''); setError(null); };

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      const body = step === 'idea' ? { prompt: value, note } : step === 'text' ? { text: value, note } : { url: value, note };
      onQueued(await api.requestImport(body));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'לא נשלח');
      setBusy(false);
    }
  };

  const scratch = async () => {
    setBusy(true);
    try { await onScratch(); } catch (e) { setError(e instanceof Error ? e.message : 'לא נוצר'); setBusy(false); }
  };

  if (step === 'cards') {
    return (
      <Sheet title="מתכון חדש" onClose={onClose} className="rc-start">
        <CauldronArt className="rc-start-art" />
        <h2 className="rc-serif rc-start-title">איך מתחילים?</h2>
        <p className="rc-start-line">בחרו את הדרך המהירה להכניס מתכון</p>
        <div className="rc-start-cards">
          {CARDS.map(({ step: s, title, line, Icon }) => (
            <button key={s} type="button" className="rc-start-card" disabled={busy}
              onClick={() => (s === 'scratch' ? void scratch() : go(s))}>
              <span className="rc-start-icon"><Icon aria-hidden /></span>
              <span><strong className="rc-serif">{title}</strong><small>{line}</small></span>
            </button>
          ))}
        </div>
        {error ? <p className="cal-error" role="alert">{error}</p> : null}
      </Sheet>
    );
  }

  const card = CARDS.find((c) => c.step === step)!;
  return (
    <Sheet title={card.title} onClose={onClose} className="rc-start">
      <button type="button" className="rc-start-back" aria-label="חזרה" onClick={() => go('cards')}><FaArrowRight aria-hidden /> חזרה</button>
      <h2 className="rc-serif rc-start-title">{card.title}</h2>
      {step === 'idea' ? (
        <label className="cal-field">
          <span>מה בא לכם להכין?</span>
          <textarea className="rc-input" rows={3} maxLength={500} value={value} placeholder="שקשוקה מהירה לשניים עם פטה" onChange={(e) => setValue(e.target.value)} />
        </label>
      ) : step === 'text' ? (
        <label className="cal-field">
          <span>טקסט המתכון (גם באנגלית — נתרגם ונמיר לגרמים ולצלזיוס)</span>
          <textarea className="rc-input" rows={6} maxLength={8000} value={value} onChange={(e) => setValue(e.target.value)} />
        </label>
      ) : (
        <label className="cal-field">
          <span>קישור למתכון</span>
          <input className="rc-input" type="url" inputMode="url" dir="ltr" value={value} placeholder="https://www.instagram.com/reel/…" onChange={(e) => setValue(e.target.value)} />
        </label>
      )}
      <label className="cal-field">
        <span>הערה (לא חובה)</span>
        <input className="rc-input" maxLength={500} value={note} placeholder="למשל: בלי חריף" onChange={(e) => setNote(e.target.value)} />
      </label>
      {error ? <p className="cal-error" role="alert">{error}</p> : null}
      <button type="button" className="rc-cta cal-wide" disabled={busy || !value.trim()} onClick={() => void send()}>
        {step === 'idea' ? 'יאללה' : 'ייבוא'}
      </button>
      <p className="cal-muted rc-start-hint">המתכון יופיע בראש הספר בעוד כמה דקות.</p>
    </Sheet>
  );
}
