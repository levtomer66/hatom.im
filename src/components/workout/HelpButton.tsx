'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { FaRegLightbulb } from 'react-icons/fa';
import { useT } from '@/lib/workout-i18n';
import { useWorkoutLanguage } from '@/context/WorkoutLanguageContext';
import { useWorkoutUser } from '@/context/WorkoutUserContext';

const NTFY_TOPIC = 'hatomim_workout_help';
const NTFY_URL = `https://ntfy.sh/${NTFY_TOPIC}`;

type Status = 'idle' | 'sending' | 'sent' | 'error';

// Floating "help / feedback" button that renders on every workout page.
// On submit, posts the message to a public ntfy.sh topic together with
// who sent it and which route they were on.
export default function HelpButton() {
  const t = useT();
  const { language } = useWorkoutLanguage();
  const { currentUser } = useWorkoutUser();
  const pathname = usePathname();

  const [isOpen, setIsOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<Status>('idle');

  const close = useCallback(() => {
    setIsOpen(false);
    // Reset transient state a moment later so the modal closes cleanly.
    setTimeout(() => {
      setMessage('');
      setStatus('idle');
    }, 200);
  }, []);

  // ESC closes the modal.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, close]);

  const handleSubmit = async () => {
    const trimmed = message.trim();
    if (!trimmed) return;

    setStatus('sending');
    const who = currentUser?.name ?? 'anonymous';
    const body = [
      trimmed,
      '',
      `— ${who} · ${pathname ?? ''} · ${language}`,
    ].join('\n');

    try {
      const res = await fetch(NTFY_URL, {
        method: 'POST',
        body,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          // `Title` and `Tags` must be ASCII for ntfy.sh; keep the actual
          // Hebrew feedback in the body where UTF-8 is fine.
          'Title': `Workout feedback from ${who}`,
          'Tags': 'muscle,speech_balloon',
        },
      });
      if (!res.ok) throw new Error(`ntfy ${res.status}`);
      setStatus('sent');
      setTimeout(close, 1400);
    } catch (err) {
      console.error('ntfy submit failed', err);
      setStatus('error');
    }
  };

  return (
    <>
      {/* Floating trigger — always visible on workout routes. */}
      <button
        type="button"
        className="workout-help-fab"
        onClick={() => setIsOpen(true)}
        aria-label={t('help.button_aria')}
        title={t('help.button_aria')}
      >
        <FaRegLightbulb size={22} />
      </button>

      {isOpen && (
        <div className="workout-modal-overlay" onClick={close}>
          <div
            className="workout-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 460 }}
          >
            <div className="workout-modal-header">
              <h2 className="workout-modal-title">💡 {t('help.modal_title')}</h2>
              <button
                className="workout-modal-close"
                onClick={close}
                aria-label={t('generic.close')}
              >
                ✕
              </button>
            </div>

            <div
              className="workout-modal-body"
              style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
            >
              <p style={{ fontSize: 14, color: 'var(--workout-text-secondary)', margin: 0 }}>
                {t('help.modal_subtitle')}
              </p>

              <textarea
                className="workout-textarea"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder={t('help.placeholder')}
                rows={5}
                autoFocus
                disabled={status === 'sending' || status === 'sent'}
                style={{ resize: 'vertical', minHeight: 110 }}
              />

              {status === 'error' && (
                <div style={{ fontSize: 13, color: 'var(--workout-red)' }}>
                  {t('help.error')}
                </div>
              )}
              {status === 'sent' && (
                <div style={{ fontSize: 13, color: 'var(--workout-green)' }}>
                  ✓ {t('help.sent')}
                </div>
              )}
            </div>

            <div className="workout-modal-footer">
              <button
                type="button"
                className="workout-btn workout-btn-secondary"
                onClick={close}
                disabled={status === 'sending'}
                style={{ marginInlineEnd: 8 }}
              >
                {t('generic.cancel')}
              </button>
              <button
                type="button"
                className="workout-btn workout-btn-primary"
                onClick={handleSubmit}
                disabled={!message.trim() || status === 'sending' || status === 'sent'}
                style={{ opacity: (!message.trim() || status === 'sending' || status === 'sent') ? 0.5 : 1 }}
              >
                {status === 'sending' ? t('help.sending') : t('help.submit')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
