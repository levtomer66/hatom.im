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

export default function PagingPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [emoji, setEmoji] = useState(DEFAULT_PAGE_EMOJI);
  const [message, setMessage] = useState('');
  const [sendState, setSendState] = useState<SendState>('idle');
  const [sendError, setSendError] = useState<string | null>(null);

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
      </main>
    </div>
  );
}
