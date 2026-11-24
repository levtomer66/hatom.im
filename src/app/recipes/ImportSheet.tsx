'use client';

// ייבוא: a link (Instagram, TikTok, YouTube, a recipe site) and/or the pasted
// caption go to the import agent, which translates and converts the recipe and
// saves it into the caller's book. The request then shows at the top of the book.

import { useState } from 'react';
import type { ImportRequest } from '@/lib/recipes/imports';
import Sheet from '../calories/Sheet';
import * as api from './api';

export default function ImportSheet({ onClose, onRequested }: { onClose: () => void; onRequested: (r: ImportRequest) => void }) {
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      onRequested(await api.requestImport({ url, text, note }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'לא נשלח');
      setBusy(false);
    }
  };

  return (
    <Sheet title="ייבוא מתכון" onClose={onClose}>
      <p className="cal-muted">מדביקים קישור למתכון — אינסטגרם, טיקטוק, יוטיוב או אתר. נתרגם לעברית, נמיר לגרמים ולצלזיוס, נחליף מוצרים במקבילים ישראליים, והמתכון יופיע בספר בעוד כמה דקות.</p>
      <label className="cal-field">
        <span>קישור</span>
        <input className="rc-input" type="url" inputMode="url" dir="ltr" value={url} placeholder="https://www.instagram.com/reel/…" onChange={(e) => setUrl(e.target.value)} />
      </label>
      <label className="cal-field">
        <span>או הטקסט של המתכון (כשהקישור לא נפתח, למשל כיתוב של רילס)</span>
        <textarea className="rc-input" rows={4} maxLength={8000} value={text} onChange={(e) => setText(e.target.value)} />
      </label>
      <label className="cal-field">
        <span>הערה (לא חובה)</span>
        <input className="rc-input" maxLength={500} value={note} placeholder="למשל: בלי חריף" onChange={(e) => setNote(e.target.value)} />
      </label>
      {error ? <p className="cal-error" role="alert">{error}</p> : null}
      <button type="button" className="sh-btn sh-btn--primary cal-wide" disabled={busy || (!url.trim() && !text.trim())} onClick={() => void send()}>ייבוא</button>
    </Sheet>
  );
}
