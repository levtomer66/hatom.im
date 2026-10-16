'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  EMOJI_MAX,
  EVENT_KINDS,
  NOTE_MAX,
  TITLE_MAX,
  getEventKind,
  type CalendarEvent,
  type CalendarEventInput,
  type EventKind,
} from '@/lib/calendar';

// An event to edit, or the date to prefill for a new one.
export type SheetTarget = { event: CalendarEvent } | { date: string };

interface Props {
  initial: SheetTarget;
  onSave: (input: CalendarEventInput) => Promise<void>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
}

export default function EventSheet({ initial, onSave, onDelete, onClose }: Props) {
  const editing = 'event' in initial ? initial.event : null;
  const [title, setTitle] = useState(editing?.title ?? '');
  const [date, setDate] = useState(editing?.date ?? ('date' in initial ? initial.date : ''));
  const [kind, setKind] = useState<EventKind>(editing?.kind ?? 'event');
  const [emoji, setEmoji] = useState(editing?.emoji ?? '');
  const [note, setNote] = useState(editing?.note ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const busyRef = useRef(busy);
  useEffect(() => {
    busyRef.current = busy;
  }, [busy]);

  // Can't close mid-save: the request would land after the sheet is gone.
  const close = useCallback(() => {
    if (!busyRef.current) onClose();
  }, [onClose]);

  // Focus moves into the sheet, stays there (Tab wraps), and returns to
  // whatever opened it.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    titleRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      if (e.key !== 'Tab' || !formRef.current) return;
      const focusable = [...formRef.current.querySelectorAll<HTMLElement>('input, button')].filter(
        (el) => !(el as HTMLButtonElement).disabled,
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      opener?.focus();
    };
  }, [close]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date) {
      setError('צריך שם ותאריך.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSave({ title, date, kind, emoji: emoji || undefined, note: note || undefined });
    } catch {
      setError('השמירה נכשלה. בדקו את הפרטים ונסו שוב.');
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!onDelete) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    setBusy(true);
    try {
      await onDelete();
    } catch {
      setError('המחיקה נכשלה. נסו שוב.');
      setBusy(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div className="cal-sheet-backdrop" onClick={close}>
      <form
        ref={formRef}
        className="cal-sheet"
        role="dialog"
        aria-modal="true"
        aria-labelledby="cal-sheet-title"
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
      >
        <h2 id="cal-sheet-title" className="cal-sheet-title">
          {editing ? 'עריכת אירוע' : 'אירוע חדש'}
        </h2>

        <label className="cal-field">
          <span>שם</span>
          <input
            ref={titleRef}
            value={title}
            maxLength={TITLE_MAX}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="למשל: יום הולדת לאמא"
          />
        </label>

        <label className="cal-field">
          <span>תאריך</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>

        <fieldset className="cal-field cal-kinds">
          <legend>סוג</legend>
          {EVENT_KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              className={`cal-kind cal-kind--${k.id}`}
              aria-pressed={kind === k.id}
              onClick={() => setKind(k.id)}
            >
              <span aria-hidden>{k.emoji}</span> {k.label}
            </button>
          ))}
        </fieldset>
        <p className="cal-hint">
          {getEventKind(kind).recurring ? 'חוזר כל שנה באותו תאריך.' : 'קורה פעם אחת.'}
        </p>

        <div className="cal-row">
          <label className="cal-field cal-field--emoji">
            <span>אימוג׳י</span>
            <input
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              placeholder={getEventKind(kind).emoji}
              maxLength={EMOJI_MAX}
            />
          </label>
          <label className="cal-field cal-field--grow">
            <span>הערה</span>
            <input
              value={note}
              maxLength={NOTE_MAX}
              onChange={(e) => setNote(e.target.value)}
              placeholder="לא חובה"
            />
          </label>
        </div>

        {error && (
          <p className="cal-error" role="alert">
            {error}
          </p>
        )}

        <div className="cal-sheet-actions">
          <button type="submit" className="cal-btn cal-btn--primary" disabled={busy}>
            {editing ? 'שמירת שינויים' : 'הוספה ללוח'}
          </button>
          <button type="button" className="cal-btn" onClick={close} disabled={busy}>
            ביטול
          </button>
          {onDelete && (
            <button type="button" className="cal-btn cal-btn--danger" onClick={remove} disabled={busy}>
              {confirmDelete ? 'ללחוץ שוב למחיקה' : 'מחיקה'}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
