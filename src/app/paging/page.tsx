'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Navbar from '@/components/Navbar';
import { hasPermission } from '@/lib/permissions';
import {
  DEFAULT_PAGE_EMOJI,
  MAX_PAGE_MESSAGE_LENGTH,
} from '@/types/paging';
import './paging.css';

type SendState = 'idle' | 'sending' | 'sent' | 'error';
type ShortcutTokenState = 'idle' | 'creating';
type CopyStatus = 'idle' | 'copied' | 'failed';

const shortcutInstallURL = process.env.NEXT_PUBLIC_PAGING_SHORTCUT_URL;

export default function PagingPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [emoji, setEmoji] = useState(DEFAULT_PAGE_EMOJI);
  const [message, setMessage] = useState('');
  const [sendState, setSendState] = useState<SendState>('idle');
  const [sendError, setSendError] = useState<string | null>(null);
  const [shortcutTokenState, setShortcutTokenState] = useState<ShortcutTokenState>('idle');
  const [shortcutError, setShortcutError] = useState<string | null>(null);
  const [shortcutToken, setShortcutToken] = useState<string | null>(null);
  const [initialCopyStatus, setInitialCopyStatus] = useState<CopyStatus>('idle');
  const [copyAgainStatus, setCopyAgainStatus] = useState<CopyStatus>('idle');

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

  async function createShortcutToken() {
    if (shortcutTokenState === 'creating') return;
    setShortcutTokenState('creating');
    setShortcutError(null);
    setInitialCopyStatus('idle');
    setCopyAgainStatus('idle');
    try {
      const response = await fetch('/api/paging/shortcut-token', { method: 'POST' });
      const body = (await response.json().catch(() => ({}))) as {
        token?: string;
        error?: string;
      };
      if (!response.ok || !body.token) {
        setShortcutError(body.error ?? 'יצירת הטוקן נכשלה');
        return;
      }
      setShortcutToken(body.token);
      try {
        await navigator.clipboard.writeText(body.token);
        setInitialCopyStatus('copied');
      } catch {
        setInitialCopyStatus('failed');
      }
    } catch {
      setShortcutError('שגיאת רשת ביצירת הטוקן. נסה שוב.');
    } finally {
      setShortcutTokenState('idle');
    }
  }

  async function copyShortcutToken() {
    if (!shortcutToken) return;
    setCopyAgainStatus('idle');
    try {
      await navigator.clipboard.writeText(shortcutToken);
      setCopyAgainStatus('copied');
    } catch {
      setCopyAgainStatus('failed');
    }
  }

  const tokenLabel =
    initialCopyStatus === 'copied' ? 'הטוקן הועתק' : 'טוקן קיצור דרך';

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
          <h2 id="paging-shortcut-heading">קיצור דרך באייפון</h2>
          <p>
            צור טוקן, ואז הגדר ב-Shortcuts בקשת POST אל
            <code>https://www.hatom.im/api/paging/pages</code>.
          </p>
          {shortcutError && (
            <p className="paging-error" role="alert">
              {shortcutError}
            </p>
          )}
          <button
            type="button"
            onClick={createShortcutToken}
            disabled={shortcutTokenState === 'creating'}
            aria-busy={shortcutTokenState === 'creating'}
          >
            {shortcutTokenState === 'creating' ? 'יוצר טוקן…' : 'צור והעתק טוקן'}
          </button>
          {shortcutToken && (
            <div className="paging-token-ready">
              <label htmlFor="paging-shortcut-token">{tokenLabel}</label>
              {initialCopyStatus === 'failed' && (
                <p className="paging-error" role="status">
                  לא הצלחנו להעתיק אוטומטית — העתק ידנית מהשדה למטה.
                </p>
              )}
              <input
                id="paging-shortcut-token"
                type="password"
                readOnly
                value={shortcutToken}
                aria-describedby="paging-token-hint"
              />
              <button type="button" onClick={copyShortcutToken}>
                העתק שוב
              </button>
              {copyAgainStatus === 'copied' && (
                <p className="paging-success" role="status">
                  הועתק ללוח ✓
                </p>
              )}
              {copyAgainStatus === 'failed' && (
                <p className="paging-error" role="alert">
                  ההעתקה נכשלה — בחר את הטוקן מהשדה והעתק ידנית.
                </p>
              )}
              {shortcutInstallURL ? (
                <a className="paging-install-link" href={shortcutInstallURL}>
                  פתח והתקן או עדכן את הקיצור
                </a>
              ) : (
                <p>קישור ההתקנה עדיין לא הוגדר.</p>
              )}
              <p id="paging-token-hint">
                הוסף כותרת Authorization שמתחילה ב-
                <code>Bearer</code> ואחריה הטוקן.
              </p>
              <ol>
                <li>
                  הוסף פעולת URL עם
                  <code>https://www.hatom.im/api/paging/pages</code>
                </li>
                <li>הוסף Get Contents of URL מסוג POST עם גוף JSON.</li>
                <li>
                  בגוף שלח <code>emoji</code> בערך <code>📟</code> ואת
                  <code>message</code> כמחרוזת ריקה.
                </li>
                <li>
                  הוסף כותרת <code>Authorization</code> עם
                  <code>Bearer</code>, רווח, והטוקן.
                </li>
              </ol>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
