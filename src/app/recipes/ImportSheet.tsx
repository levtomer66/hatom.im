'use client';

import { useState } from 'react';
import Sheet from '../calories/Sheet';

const PROMPT = 'שמור את המתכון הזה ב-hatom (recipes_save): ';

/** How importing works: in Claude, through the hatom connector; this copies the prompt to start with. */
export default function ImportSheet({ onClose }: { onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(PROMPT);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };
  return (
    <Sheet title="ייבוא מתכון" onClose={onClose}>
      <ol className="rc-import-steps">
        <li>מעתיקים את הקישור למתכון (אינסטגרם, טיקטוק, יוטיוב, אתר) או מצלמים את המסך.</li>
        <li>פותחים את Claude עם החיבור ל-hatom.</li>
        <li>מדביקים את הבקשה, ואחריה את הקישור או צילום המסך.</li>
      </ol>
      <p className="cal-muted">Claude יתרגם לעברית, ימיר כוסות ואונקיות לגרמים ומעלות לצלזיוס, יחליף מוצרים אמריקאיים במקבילים ישראליים, וישמור את המתכון כאן.</p>
      <code className="rc-import-prompt" dir="rtl">{PROMPT}…</code>
      <button type="button" className="sh-btn sh-btn--primary cal-wide" onClick={() => void copy()}>{copied ? 'הועתק ✓' : 'העתקת הבקשה'}</button>
    </Sheet>
  );
}
