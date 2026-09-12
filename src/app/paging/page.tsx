'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Navbar from '@/components/Navbar';
import { hasPermission } from '@/lib/permissions';
import { useCopyApiKey } from '@/lib/useCopyApiKey';
import {
  DEFAULT_PAGE_EMOJI,
  MAX_PAGE_MESSAGE_LENGTH,
} from '@/types/paging';
import './paging.css';

type SendState = 'idle' | 'sending' | 'sent' | 'error';

export default function PagingPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [emoji, setEmoji] = useState(DEFAULT_PAGE_EMOJI);
  const [message, setMessage] = useState('');
  const [sendState, setSendState] = useState<SendState>('idle');
  const [sendError, setSendError] = useState<string | null>(null);

  // Copy the personal API key (created on first use, never rendered) for the
  // "Pager" iPhone Shortcut.
  const { copyState: keyCopyState, copyApiKey } = useCopyApiKey();

  useEffect(() => {
    if (status === 'loading') return;
    if (!session?.user) router.replace('/login?from=/paging');
    else if (!hasPermission(session, 'paging')) router.replace('/');
  }, [router, session, status]);

  async function sendPage(event: FormEvent) {
    event.preventDefault();
    setSendState('sending');
    setSendError(null);
    try {
      const response = await fetch('/api/paging/pages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emoji, message }),
      });
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) throw new Error(body.error ?? `Failed (${response.status})`);
      setSendState('sent');
      setMessage('');
    } catch (sendError) {
      setSendState('error');
      setSendError(sendError instanceof Error ? sendError.message : 'שליחת הפייג׳ נכשלה');
    }
  }

  if (
    status === 'loading' ||
    !session?.user ||
    !hasPermission(session, 'paging')
  ) {
    return <div className="paging-page-blank" />;
  }

  return (
    <div>
      <Navbar />
      <main className="paging-page">
        <section className="paging-card paging-send" aria-labelledby="paging-send-heading">
          <p className="paging-overline">HATOM PAGER</p>
          <h1 id="paging-send-heading">📟 שליחת פייג׳</h1>
          <form onSubmit={sendPage}>
            <label htmlFor="paging-emoji">אימוג׳י</label>
            <input
              id="paging-emoji"
              value={emoji}
              onChange={(event) => setEmoji(event.target.value)}
              placeholder={DEFAULT_PAGE_EMOJI}
              inputMode="text"
              autoComplete="off"
            />
            <label htmlFor="paging-message">
              הודעה אופציונלית
              <span className="paging-char-count" aria-hidden="true">
                {message.length}/{MAX_PAGE_MESSAGE_LENGTH}
              </span>
            </label>
            <textarea
              id="paging-message"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              maxLength={MAX_PAGE_MESSAGE_LENGTH}
              rows={3}
            />
            {sendError && (
              <p className="paging-error" role="alert">
                {sendError}
              </p>
            )}
            {sendState === 'sent' && (
              <p className="paging-success" role="status">
                הפייג׳ נשלח ✓
              </p>
            )}
            <button type="submit" disabled={sendState === 'sending'} aria-busy={sendState === 'sending'}>
              {sendState === 'sending' ? 'שולח…' : 'שלח פייג׳'}
            </button>
          </form>
        </section>

        <section className="paging-card paging-shortcut" aria-labelledby="paging-shortcut-heading">
          <p className="paging-overline">iPhone</p>
          <h2 id="paging-shortcut-heading">📲 קיצור לאייפון</h2>
          <p className="paging-shortcut-hint">
            שליחת פייג׳ בלחיצה אחת מהאייפון: העתיקו את מפתח ה-API, הוסיפו את
            הקיצור, והדביקו את המפתח כשמתבקשים בהתקנה.
          </p>
          <div className="paging-shortcut-actions">
            <button type="button" className="paging-key-btn" onClick={copyApiKey} disabled={keyCopyState === 'copying'}>
              {keyCopyState === 'copying'
                ? '…מעתיק'
                : keyCopyState === 'copied'
                  ? '✓ הועתק'
                  : keyCopyState === 'error'
                    ? '✗ שגיאה — נסו שוב'
                    : '🔑 העתק מפתח API'}
            </button>
            <a
              className="paging-shortcut-download"
              href="/shortcuts/page.shortcut"
              download="hatom-pager.shortcut"
            >
              ➕ הוסף קיצור דרך
            </a>
          </div>
        </section>
      </main>
    </div>
  );
}
