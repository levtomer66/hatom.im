'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Navbar from '@/components/Navbar';
import {
  CreateSpaSessionDto,
  MASSAGE_TYPES,
  MassageType,
  SPA_DURATIONS,
  SPA_USERS,
  SpaDuration,
  SpaSession,
  SpaUserId,
  getMassageTypeEmoji,
  getMassageTypeLabel,
  getSpaUser,
  otherSpaUser,
} from '@/types/spa';
import { buildGoogleCalendarUrl } from '@/lib/googleCalendarUrl';
import './spa.css';

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function todayLocalDateTimeValue(): string {
  // default datetime-local value: tomorrow 19:00 local
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(19, 0, 0, 0);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

const CONFETTI_EMOJIS = ['🔥', '💋', '🌶️', '🥵', '💦', '😈', '❤️‍🔥', '💄'];

export default function SpaPage() {
  const [sessions, setSessions] = useState<SpaSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdSession, setCreatedSession] = useState<SpaSession | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);
  const [copyMsg, setCopyMsg] = useState<string | null>(null);

  const happyEndingRef = useRef(false);

  const [giverId, setGiverId] = useState<SpaUserId>('tom');
  const [scheduledAt, setScheduledAt] = useState<string>(todayLocalDateTimeValue());
  const [durationMinutes, setDurationMinutes] = useState<SpaDuration>(60);
  const [massageType, setMassageType] = useState<MassageType>('swedish');
  const [preferences, setPreferences] = useState<string>('');

  const receiverId = otherSpaUser(giverId);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/spa/sessions')
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((data: SpaSession[]) => {
        if (!cancelled) setSessions(data);
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) setError('Could not load existing sessions.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const sortedSessions = useMemo(() => {
    const now = Date.now();
    const upcoming: SpaSession[] = [];
    const past: SpaSession[] = [];
    for (const s of sessions) {
      const t = new Date(s.scheduledAt).getTime();
      if (Number.isNaN(t) || t >= now) upcoming.push(s);
      else past.push(s);
    }
    upcoming.sort(
      (a, b) =>
        new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
    );
    past.sort(
      (a, b) =>
        new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime()
    );
    return [...upcoming, ...past];
  }, [sessions]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const happyEnding = happyEndingRef.current;
    happyEndingRef.current = false;

    const dto: CreateSpaSessionDto = {
      giverId,
      scheduledAt: new Date(scheduledAt).toISOString(),
      durationMinutes,
      massageType,
      preferences: preferences.trim(),
      happyEnding,
    };

    try {
      const res = await fetch('/api/spa/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dto),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Request failed (${res.status})`);
      }
      const created = (await res.json()) as SpaSession;
      setSessions((prev) => [created, ...prev]);
      setCreatedSession(created);
      setPreferences('');
      if (created.happyEnding) {
        setShowConfetti(true);
        window.setTimeout(() => setShowConfetti(false), 2800);
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to schedule session.');
    } finally {
      setSubmitting(false);
    }
  }

  function triggerSecret() {
    happyEndingRef.current = true;
  }

  async function copyLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopyMsg('Copied!');
      window.setTimeout(() => setCopyMsg(null), 1500);
    } catch {
      setCopyMsg('Copy failed');
      window.setTimeout(() => setCopyMsg(null), 1500);
    }
  }

  return (
    <>
      <Navbar />
      <div className="spa-page">
        <div className="spa-container">
          <div className="spa-hero">
            <h1>💆‍♀️ Spa של התומ.ים 💆‍♂️</h1>
            <p>Schedule a massage for the other Tom. Calendar invite included.</p>
          </div>

          <div className="spa-grid">
            <form
              className="spa-card spa-form-card"
              onSubmit={handleSubmit}
              autoComplete="off"
            >
              <p className="spa-section-title">Who&apos;s giving the massage?</p>
              <div className="spa-segmented" role="tablist">
                {SPA_USERS.map((u) => (
                  <button
                    type="button"
                    key={u.id}
                    className={giverId === u.id ? 'active' : ''}
                    onClick={() => setGiverId(u.id)}
                  >
                    {u.name}
                  </button>
                ))}
              </div>
              <p style={{ marginTop: '0.75rem', marginBottom: '1rem' }}>
                <span className="spa-receiver-pill">
                  for {getSpaUser(receiverId).name} 💕
                </span>
              </p>

              <div className="spa-row">
                <div className="spa-field">
                  <label htmlFor="spa-when">When</label>
                  <input
                    id="spa-when"
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    required
                  />
                </div>
                <div className="spa-field">
                  <label htmlFor="spa-duration">Duration</label>
                  <select
                    id="spa-duration"
                    value={durationMinutes}
                    onChange={(e) =>
                      setDurationMinutes(Number(e.target.value) as SpaDuration)
                    }
                  >
                    {SPA_DURATIONS.map((d) => (
                      <option key={d} value={d}>
                        {d} min
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <p className="spa-section-title">Massage type</p>
              <div className="spa-massage-grid" style={{ marginBottom: '1rem' }}>
                {MASSAGE_TYPES.map((m) => (
                  <button
                    type="button"
                    key={m.id}
                    className={`spa-massage-btn ${massageType === m.id ? 'active' : ''}`}
                    onClick={() => setMassageType(m.id)}
                  >
                    <span className="emoji">{m.emoji}</span>
                    {m.label}
                  </button>
                ))}
              </div>

              <div className="spa-field">
                <label htmlFor="spa-prefs">Preferences</label>
                <textarea
                  id="spa-prefs"
                  value={preferences}
                  onChange={(e) => setPreferences(e.target.value)}
                  placeholder="Pressure, focus areas, oil, music, candles..."
                />
              </div>

              {error && <div className="spa-error">{error}</div>}

              <div className="spa-submit-row">
                <button
                  type="submit"
                  className="spa-submit"
                  disabled={submitting}
                >
                  {submitting ? 'Scheduling…' : 'Schedule Session ✨'}
                </button>
                <button
                  type="submit"
                  className="spa-secret-btn"
                  onClick={triggerSecret}
                  disabled={submitting}
                  aria-label="♡"
                >
                  ♡
                </button>
              </div>

              {createdSession && (
                <div className="spa-result">
                  <h3>Session scheduled ✨</h3>
                  <p style={{ margin: 0, fontSize: '0.9rem', color: '#555' }}>
                    {getSpaUser(createdSession.giverId).name} →{' '}
                    {getSpaUser(createdSession.receiverId).name} ·{' '}
                    {getMassageTypeEmoji(createdSession.massageType)}{' '}
                    {getMassageTypeLabel(createdSession.massageType)} ·{' '}
                    {formatWhen(createdSession.scheduledAt)}
                  </p>
                  <div className="spa-result-actions">
                    <a
                      className="spa-gcal-btn"
                      href={buildGoogleCalendarUrl(createdSession)}
                      target="_blank"
                      rel="noreferrer noopener"
                    >
                      📅 Add to Google Calendar
                    </a>
                    <button
                      type="button"
                      className="spa-copy-btn"
                      onClick={() =>
                        copyLink(buildGoogleCalendarUrl(createdSession))
                      }
                    >
                      🔗 {copyMsg ?? 'Copy invite link'}
                    </button>
                  </div>
                </div>
              )}
            </form>

            <div className="spa-card">
              <p className="spa-section-title">Scheduled sessions</p>
              {loading ? (
                <p className="spa-empty">Loading…</p>
              ) : sortedSessions.length === 0 ? (
                <p className="spa-empty">No sessions yet. Book the first one ✨</p>
              ) : (
                <div className="spa-session-list">
                  {sortedSessions.map((s) => {
                    const isPast = new Date(s.scheduledAt).getTime() < Date.now();
                    return (
                      <div
                        key={s.id}
                        className={`spa-session-card ${isPast ? 'past' : ''}`}
                      >
                        <div className="spa-session-header">
                          <span className="spa-session-flow">
                            {getSpaUser(s.giverId).name} → {getSpaUser(s.receiverId).name}
                          </span>
                          <span className="spa-session-type">
                            {getMassageTypeEmoji(s.massageType)}{' '}
                            {getMassageTypeLabel(s.massageType)}
                          </span>
                        </div>
                        <p className="spa-session-when">
                          {formatWhen(s.scheduledAt)} · {s.durationMinutes} min
                        </p>
                        {s.preferences && (
                          <p className="spa-session-prefs">“{s.preferences}”</p>
                        )}
                        <div className="spa-session-actions">
                          <a
                            href={buildGoogleCalendarUrl(s)}
                            target="_blank"
                            rel="noreferrer noopener"
                          >
                            📅 Add to Calendar
                          </a>
                        </div>
                        {s.happyEnding && (
                          <span
                            className="spa-session-sparkle"
                            aria-hidden="true"
                          >
                            ✨
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showConfetti && (
        <div className="spa-confetti-overlay" aria-hidden="true">
          {Array.from({ length: 36 }).map((_, i) => {
            const left = Math.random() * 100;
            const duration = 2.2 + Math.random() * 1.4;
            const delay = Math.random() * 0.6;
            const emoji =
              CONFETTI_EMOJIS[i % CONFETTI_EMOJIS.length];
            return (
              <span
                key={i}
                className="spa-confetti-piece"
                style={{
                  left: `${left}%`,
                  animationDuration: `${duration}s`,
                  animationDelay: `${delay}s`,
                  fontSize: `${1.5 + Math.random() * 1.5}rem`,
                }}
              >
                {emoji}
              </span>
            );
          })}
        </div>
      )}
    </>
  );
}
