'use client';

import React, { useEffect, useRef, useState } from 'react';
import { FaEye, FaEyeSlash, FaCopy } from 'react-icons/fa';
import type { CoffeeFavorite } from '@/types/coffee-order';
import './ApiSettingsDialog.css';

interface ApiSettings {
  apiKey: string | null;
  defaultCoffeeFavoriteId: string | null;
}

type Feedback = { kind: 'success' | 'error'; text: string } | null;

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Masks a `htm_...` key down to a short, unmistakably-partial preview —
// enough to recognise which key it is, not enough to leak it over a shoulder.
function maskKey(key: string): string {
  if (key.length <= 8) return '•'.repeat(key.length);
  return `${key.slice(0, 8)}${'•'.repeat(Math.min(key.length - 8, 16))}`;
}

// Session-gated key + default-favorite manager, opened from the navbar
// avatar (desktop) and the drawer footer (mobile). Owns its own fetch of
// GET/POST/PATCH /api/user/api-settings — the caller only controls
// open/close.
export default function ApiSettingsDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<ApiSettings | null>(null);
  const [favorites, setFavorites] = useState<CoffeeFavorite[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [busyKey, setBusyKey] = useState(false);
  const [busyFavorite, setBusyFavorite] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [loadError, setLoadError] = useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // Load settings + favorites whenever the dialog opens. Reset transient UI
  // state (reveal, feedback) so a stale reveal/toast from a previous open
  // doesn't leak into a fresh session.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setLoadError(false);
    setRevealed(false);
    setFeedback(null);

    (async () => {
      try {
        const [settingsRes, favoritesRes] = await Promise.all([
          fetch('/api/user/api-settings'),
          fetch('/api/coffee-order/favorites'),
        ]);
        if (!settingsRes.ok) throw new Error('settings');
        const settingsData = (await settingsRes.json()) as ApiSettings;
        const favoritesData: CoffeeFavorite[] = favoritesRes.ok
          ? await favoritesRes.json()
          : [];
        if (cancelled) return;
        setSettings(settingsData);
        setFavorites(favoritesData);
      } catch {
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open]);

  // Escape closes; focus is trapped inside the dialog and returned to the
  // trigger element on close. Body scroll is locked while open, matching the
  // drawer's behaviour.
  useEffect(() => {
    if (!open) return;

    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const focusTimer = window.setTimeout(() => closeButtonRef.current?.focus(), 0);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
      ).filter((el) => el.offsetParent !== null);
      if (focusable.length === 0) return;
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

    document.addEventListener('keydown', onKeyDown, true);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener('keydown', onKeyDown, true);
      document.body.style.overflow = prevOverflow;
      previouslyFocused.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  const generateOrRotate = async () => {
    if (busyKey) return;
    if (settings?.apiKey) {
      const confirmed = window.confirm(
        'החלפת המפתח תבטל את המפתח הקיים לצמיתות — כל קיצור/MCP client שמשתמש בו יפסיק לעבוד. להמשיך?'
      );
      if (!confirmed) return;
    }
    setBusyKey(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/user/api-settings', { method: 'POST' });
      if (!res.ok) throw new Error('generate');
      const data = (await res.json()) as ApiSettings;
      setSettings(data);
      setRevealed(true);
      setFeedback({ kind: 'success', text: 'מפתח חדש נוצר בהצלחה.' });
    } catch {
      setFeedback({ kind: 'error', text: 'יצירת המפתח נכשלה. נסו שוב.' });
    } finally {
      setBusyKey(false);
    }
  };

  const copyKey = async () => {
    if (!settings?.apiKey) return;
    try {
      await navigator.clipboard.writeText(settings.apiKey);
      setFeedback({ kind: 'success', text: 'המפתח הועתק ללוח.' });
    } catch {
      setFeedback({ kind: 'error', text: 'ההעתקה נכשלה — נסו להעתיק ידנית.' });
    }
  };

  const changeDefaultFavorite = async (value: string) => {
    if (busyFavorite || !settings) return;
    const favoriteId = value === '' ? null : value;
    const previous = settings.defaultCoffeeFavoriteId;
    setSettings({ ...settings, defaultCoffeeFavoriteId: favoriteId });
    setBusyFavorite(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/user/api-settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ defaultCoffeeFavoriteId: favoriteId }),
      });
      if (!res.ok) throw new Error('patch');
      const data = (await res.json()) as ApiSettings;
      setSettings(data);
    } catch {
      setSettings((s) => (s ? { ...s, defaultCoffeeFavoriteId: previous } : s));
      setFeedback({ kind: 'error', text: 'עדכון ברירת המחדל נכשל. נסו שוב.' });
    } finally {
      setBusyFavorite(false);
    }
  };

  return (
    <div
      className="api-settings-backdrop"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={dialogRef}
        className="api-settings-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="api-settings-title"
        dir="rtl"
      >
        <div className="api-settings-header">
          <span id="api-settings-title" className="api-settings-title">
            הגדרות API
          </span>
          <button
            ref={closeButtonRef}
            type="button"
            className="api-settings-close"
            aria-label="סגירה"
            onClick={onClose}
          >
            ✕
          </button>
        </div>

        <div className="api-settings-body">
          {loading ? (
            <div className="api-settings-loading">טוען…</div>
          ) : loadError ? (
            <div className="api-settings-feedback api-settings-feedback--error">
              טעינת ההגדרות נכשלה. נסו לפתוח שוב.
            </div>
          ) : (
            <>
              <section>
                <div className="api-settings-section-label">מפתח אישי</div>
                <div className="api-settings-key-row">
                  {settings?.apiKey ? (
                    <>
                      <span className="api-settings-key-value">
                        {revealed ? settings.apiKey : maskKey(settings.apiKey)}
                      </span>
                      <button
                        type="button"
                        className="api-settings-icon-btn"
                        aria-label={revealed ? 'הסתרת המפתח' : 'הצגת המפתח'}
                        onClick={() => setRevealed((r) => !r)}
                      >
                        {revealed ? <FaEyeSlash /> : <FaEye />}
                      </button>
                      <button
                        type="button"
                        className="api-settings-icon-btn"
                        aria-label="העתקת המפתח"
                        onClick={copyKey}
                      >
                        <FaCopy />
                      </button>
                    </>
                  ) : (
                    <span className="api-settings-key-empty">עדיין אין מפתח</span>
                  )}
                </div>

                <div className="api-settings-actions">
                  <button
                    type="button"
                    className={`api-settings-btn ${settings?.apiKey ? '' : 'api-settings-btn--primary'}`}
                    onClick={generateOrRotate}
                    disabled={busyKey}
                  >
                    {busyKey ? 'רגע…' : settings?.apiKey ? 'החלף מפתח' : 'צור מפתח'}
                  </button>
                </div>
              </section>

              <section>
                <label className="api-settings-section-label" htmlFor="api-settings-default-favorite">
                  ברירת מחדל לקפה
                </label>
                <select
                  id="api-settings-default-favorite"
                  className="api-settings-select"
                  value={settings?.defaultCoffeeFavoriteId ?? ''}
                  onChange={(e) => changeDefaultFavorite(e.target.value)}
                  disabled={busyFavorite}
                >
                  <option value="">ברירת מחדל מובנית</option>
                  {favorites.map((fav) => (
                    <option key={fav.id} value={fav.id}>
                      {fav.name}
                    </option>
                  ))}
                </select>
              </section>

              {feedback && (
                <div className={`api-settings-feedback api-settings-feedback--${feedback.kind}`} role="status">
                  {feedback.text}
                </div>
              )}

              <div className="api-settings-warning">
                המפתח הוא אמצעי נוחות, לא הגנה מלאה: מי שמחזיק בו יכול להזמין קפה, לשלוח
                פייג׳רים ולערוך משימות בשמכם. שמרו עליו פרטי, ואם דלף — החליפו אותו מיד.
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
