'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Tangerine, Cormorant_Garamond, Frank_Ruhl_Libre } from 'next/font/google';
import Navbar from '@/components/Navbar';
import {
  CreateSpaSessionDto,
  SPA_DURATIONS,
  SPA_FLAGS,
  SPA_USERS,
  SpaDuration,
  SpaFlags,
  SpaSession,
  SpaUserId,
  emptyFlags,
  flagsLabel,
  getSpaUser,
  otherSpaUser,
} from '@/types/spa';
import { buildGoogleCalendarUrl } from '@/lib/googleCalendarUrl';
import './spa.css';

// Tangerine handles the love-letter cursive moments (page title, accents).
// Cormorant Garamond carries everything else with an italic-friendly serif.
// Frank Ruhl Libre fills in for Hebrew so the same family-feel persists in RTL.
const tangerine = Tangerine({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-tangerine',
  display: 'swap',
});
const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-cormorant',
  display: 'swap',
});
const frankRuhl = Frank_Ruhl_Libre({
  subsets: ['hebrew', 'latin'],
  weight: ['300', '400', '500', '700'],
  variable: '--font-frank',
  display: 'swap',
});

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

  const [happyEndingArmed, setHappyEndingArmed] = useState(false);
  const confettiTimerRef = useRef<number | null>(null);

  function fireConfetti() {
    if (confettiTimerRef.current !== null) {
      window.clearTimeout(confettiTimerRef.current);
    }
    setShowConfetti(true);
    confettiTimerRef.current = window.setTimeout(() => {
      setShowConfetti(false);
      confettiTimerRef.current = null;
    }, 2800);
  }

  const [giverId, setGiverId] = useState<SpaUserId>('tom');
  const [scheduledAt, setScheduledAt] = useState<string>(todayLocalDateTimeValue());
  const [durationMinutes, setDurationMinutes] = useState<SpaDuration>(60);
  const [flags, setFlags] = useState<SpaFlags>(emptyFlags);
  const [preferences, setPreferences] = useState<string>('');

  function toggleFlag(id: keyof SpaFlags) {
    setFlags((prev) => ({ ...prev, [id]: !prev[id] }));
  }

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
    const happyEnding = happyEndingArmed;
    setHappyEndingArmed(false);

    const dto: CreateSpaSessionDto = {
      giverId,
      scheduledAt: new Date(scheduledAt).toISOString(),
      durationMinutes,
      flags,
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
      setFlags(emptyFlags());
      if (created.happyEnding) fireConfetti();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to schedule session.');
    } finally {
      setSubmitting(false);
    }
  }

  function toggleHappyEnding() {
    setHappyEndingArmed((prev) => {
      const next = !prev;
      if (next) fireConfetti();
      return next;
    });
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
    <div className={`${tangerine.variable} ${cormorant.variable} ${frankRuhl.variable}`}>
      <Navbar />
      <div className="spa-page">
        {/* Drifting petals — pure decoration, low z-index */}
        <div className="spa-petals" aria-hidden="true">
          {Array.from({ length: 14 }).map((_, i) => (
            <span
              key={i}
              className="spa-petal"
              style={{
                left: `${(i * 7.3) % 100}%`,
                animationDuration: `${18 + (i % 6) * 4}s`,
                animationDelay: `${-i * 2.4}s`,
                fontSize: `${0.9 + (i % 4) * 0.35}rem`,
              }}
            >
              {i % 3 === 0 ? '🌹' : i % 3 === 1 ? '❀' : '🌸'}
            </span>
          ))}
        </div>

        {/* Decorative rose-vine corners (SVG, low opacity) */}
        <svg className="spa-corner-vine spa-corner-vine--tl" viewBox="0 0 200 200" aria-hidden="true">
          <path d="M0,0 Q90,30 100,100 T200,200" fill="none" stroke="currentColor" strokeWidth="0.6" />
          <circle cx="30" cy="20" r="4" fill="currentColor" opacity="0.4" />
          <circle cx="70" cy="55" r="3" fill="currentColor" opacity="0.5" />
          <circle cx="110" cy="100" r="5" fill="currentColor" opacity="0.35" />
          <circle cx="150" cy="160" r="3" fill="currentColor" opacity="0.45" />
        </svg>
        <svg className="spa-corner-vine spa-corner-vine--br" viewBox="0 0 200 200" aria-hidden="true">
          <path d="M0,0 Q90,30 100,100 T200,200" fill="none" stroke="currentColor" strokeWidth="0.6" />
          <circle cx="30" cy="20" r="4" fill="currentColor" opacity="0.4" />
          <circle cx="70" cy="55" r="3" fill="currentColor" opacity="0.5" />
          <circle cx="110" cy="100" r="5" fill="currentColor" opacity="0.35" />
          <circle cx="150" cy="160" r="3" fill="currentColor" opacity="0.45" />
        </svg>

        <div className="spa-container">
          <header className="spa-hero">
            <p className="spa-hero-overline">— with love —</p>
            <h1 className="spa-hero-title">Spa</h1>
            <div className="spa-hero-divider" aria-hidden="true">
              <span className="spa-hero-divider-rule" />
              <span className="spa-hero-divider-mark">✿</span>
              <span className="spa-hero-divider-rule" />
            </div>
          </header>

          <div className="spa-grid">
            <form
              className="spa-card spa-form-card"
              onSubmit={handleSubmit}
              autoComplete="off"
            >
              <h2 className="spa-section-title">
                <span className="spa-section-num">i.</span> The Hands
              </h2>
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
              <p className="spa-receiver-row">
                <span className="spa-receiver-pill">
                  pour <em>{getSpaUser(receiverId).name}</em>
                </span>
              </p>

              <div className="spa-divider-ornament" aria-hidden="true">❦</div>

              <h2 className="spa-section-title">
                <span className="spa-section-num">ii.</span> The Hour
              </h2>
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
                  <label htmlFor="spa-duration">How long</label>
                  <select
                    id="spa-duration"
                    value={durationMinutes}
                    onChange={(e) =>
                      setDurationMinutes(Number(e.target.value) as SpaDuration)
                    }
                  >
                    {SPA_DURATIONS.map((d) => (
                      <option key={d} value={d}>
                        {d} minutes
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="spa-divider-ornament" aria-hidden="true">❦</div>

              <h2 className="spa-section-title">
                <span className="spa-section-num">iii.</span> Flags
              </h2>
              <div className="spa-flag-row">
                {SPA_FLAGS.map((f) => (
                  <button
                    type="button"
                    key={f.id}
                    className={`spa-flag-btn ${flags[f.id] ? 'active' : ''}`}
                    onClick={() => toggleFlag(f.id)}
                    aria-pressed={flags[f.id]}
                  >
                    <span className="emoji">{f.emoji}</span>
                    <span className="label">{f.label}</span>
                  </button>
                ))}
                <button
                  type="button"
                  className={`spa-flag-btn spa-flag-btn--secret ${happyEndingArmed ? 'active armed' : ''}`}
                  onClick={toggleHappyEnding}
                  aria-pressed={happyEndingArmed}
                  aria-label="♡"
                >
                  <span className="emoji">{happyEndingArmed ? '♥' : '♡'}</span>
                </button>
              </div>

              <h2 className="spa-section-title spa-section-title--tight">
                <span className="spa-section-num">iv.</span> Whispers
              </h2>
              <div className="spa-field spa-field--tight">
                <label htmlFor="spa-prefs" className="sr-only">Preferences</label>
                <textarea
                  id="spa-prefs"
                  value={preferences}
                  onChange={(e) => setPreferences(e.target.value)}
                  placeholder="Pressure, focus areas, music, candles…"
                  rows={2}
                />
              </div>

              {error && <div className="spa-error">{error}</div>}

              <button
                type="submit"
                className="spa-submit"
                disabled={submitting}
              >
                <span className="spa-submit-flourish" aria-hidden="true">❧</span>
                {submitting ? 'Sealing the envelope…' : 'Send with love'}
                <span className="spa-submit-flourish" aria-hidden="true">❧</span>
              </button>

              {createdSession && (
                <div className="spa-result">
                  <h3>The invitation is sealed.</h3>
                  <p className="spa-result-recap">
                    <strong>{getSpaUser(createdSession.giverId).name}</strong>
                    {' '}pour{' '}
                    <strong>{getSpaUser(createdSession.receiverId).name}</strong>
                    {' · '}
                    {formatWhen(createdSession.scheduledAt)}
                    {' · '}
                    {flagsLabel(createdSession.flags)}
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

            <aside className="spa-card spa-list-card">
              <h2 className="spa-section-title">
                <span className="spa-section-num">❀</span> Our calendar of caresses
              </h2>
              {loading ? (
                <p className="spa-empty">Loading…</p>
              ) : sortedSessions.length === 0 ? (
                <p className="spa-empty">
                  Nothing scheduled yet — <br />
                  <em>send the first letter.</em>
                </p>
              ) : (
                <div className="spa-session-list">
                  {sortedSessions.map((s, i) => {
                    const isPast = new Date(s.scheduledAt).getTime() < Date.now();
                    return (
                      <article
                        key={s.id}
                        className={`spa-session-card ${isPast ? 'past' : ''}`}
                        style={{
                          // tiny postcard-stack rotation, deterministic per index
                          ['--tilt' as string]: `${((i % 5) - 2) * 0.6}deg`,
                        }}
                      >
                        <div className="spa-session-stamp" aria-hidden="true">♥</div>
                        <div className="spa-session-header">
                          <span className="spa-session-flow">
                            <em>{getSpaUser(s.giverId).name}</em>
                            <span className="spa-session-arrow"> ❤ </span>
                            <em>{getSpaUser(s.receiverId).name}</em>
                          </span>
                        </div>
                        <p className="spa-session-when">
                          {formatWhen(s.scheduledAt)} · {s.durationMinutes}′
                        </p>
                        {(s.flags.music ||
                          s.flags.oil ||
                          s.flags.deepPressure ||
                          s.flags.candles) && (
                          <div className="spa-session-flags">
                            {SPA_FLAGS.filter((f) => s.flags[f.id]).map((f) => (
                              <span key={f.id} className="spa-session-flag">
                                <span aria-hidden="true">{f.emoji}</span>{' '}
                                <span className="label">{f.label}</span>
                              </span>
                            ))}
                          </div>
                        )}
                        {s.preferences && (
                          <p className="spa-session-prefs">“{s.preferences}”</p>
                        )}
                        <div className="spa-session-actions">
                          <a
                            href={buildGoogleCalendarUrl(s)}
                            target="_blank"
                            rel="noreferrer noopener"
                          >
                            ✦ add to calendar
                          </a>
                        </div>
                        {s.happyEnding && (
                          <span
                            className="spa-session-sparkle"
                            aria-hidden="true"
                          >
                            ♥
                          </span>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </aside>
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
    </div>
  );
}
