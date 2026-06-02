'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWorkoutUser } from '@/context/WorkoutUserContext';
import { useT } from '@/lib/workout-i18n';
import Header from '@/components/workout/Header';
import BottomNav from '@/components/workout/BottomNav';
import { WORKOUT_PLAYLISTS } from '@/data/workout-playlists';
import { WORKOUT_SPOTIFY_PLAYLISTS } from '@/data/workout-spotify-playlists';

type MusicTab = 'spotify' | 'soundcloud';

export default function MusicPage() {
  const router = useRouter();
  const { currentUser, isLoading } = useWorkoutUser();
  const t = useT();
  // Default to the Spotify tab — the embedded players are the richer view.
  const [tab, setTab] = useState<MusicTab>('spotify');

  useEffect(() => {
    if (!isLoading && !currentUser) {
      router.replace('/login?from=/workout/music');
    }
  }, [isLoading, currentUser, router]);

  // Loading state
  if (isLoading) {
    return (
      <main className="workout-main">
        <div className="loading-spinner" />
      </main>
    );
  }

  // Not logged in
  if (!currentUser) {
    return (
      <main className="workout-main">
        <div className="loading-spinner" />
      </main>
    );
  }

  const TABS: { key: MusicTab; label: string; accent: string }[] = [
    { key: 'spotify', label: 'Spotify', accent: '#1DB954' },
    { key: 'soundcloud', label: 'SoundCloud', accent: '#ff5500' },
  ];

  return (
    <main className="workout-main">
      <Header title={t('music.title')} />

      <div className="workout-page">
        {/* Source tabs */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
          {TABS.map(({ key, label, accent }) => {
            const active = tab === key;
            return (
              <button
                key={key}
                onClick={() => setTab(key)}
                aria-pressed={active}
                style={{
                  flex: 1,
                  padding: '10px 12px',
                  borderRadius: '999px',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  cursor: 'pointer',
                  background: active ? 'var(--workout-bg-card)' : 'transparent',
                  color: active ? accent : 'var(--workout-text-muted)',
                  border: `1px solid ${active ? accent : 'var(--workout-bg-card)'}`,
                  transition: 'all 0.15s ease',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {tab === 'spotify' ? (
          <div>
            {WORKOUT_SPOTIFY_PLAYLISTS.map((p) => (
              <div key={p.id} style={{ marginBottom: '18px' }}>
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: '0.95rem',
                    color: 'var(--workout-text)',
                    marginBottom: '8px',
                  }}
                >
                  {p.title}
                </div>
                <iframe
                  title={p.title}
                  src={`https://open.spotify.com/embed/playlist/${p.id}?utm_source=generator`}
                  width="100%"
                  height={352}
                  loading="lazy"
                  allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                  style={{ borderRadius: '12px', border: 0, display: 'block' }}
                />
              </div>
            ))}
          </div>
        ) : (
          <div>
            {WORKOUT_PLAYLISTS.map((playlist) =>
              playlist.scTrackId ? (
                <div key={playlist.id} style={{ marginBottom: '18px' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'baseline',
                      gap: '8px',
                      marginBottom: '8px',
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 600,
                        fontSize: '0.95rem',
                        color: 'var(--workout-text)',
                        lineHeight: 1.3,
                        minWidth: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {playlist.title}
                    </span>
                    <span
                      style={{
                        fontSize: '0.8rem',
                        color: 'var(--workout-text-muted)',
                        flexShrink: 0,
                      }}
                    >
                      {playlist.durationLabel}
                    </span>
                  </div>
                  <iframe
                    title={playlist.title}
                    width="100%"
                    height={300}
                    scrolling="no"
                    loading="lazy"
                    allow="autoplay; encrypted-media"
                    src={`https://w.soundcloud.com/player/?url=${encodeURIComponent(
                      `https://api.soundcloud.com/tracks/${playlist.scTrackId}`,
                    )}&color=%23ff5500&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false&visual=true`}
                    style={{ borderRadius: '12px', border: 0, display: 'block' }}
                  />
                </div>
              ) : (
                /* Fallback: an unresolved set (couldn't get a track id) still
                   links out to SoundCloud rather than showing a broken embed. */
                <a
                  key={playlist.id}
                  href={playlist.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Open ${playlist.title} on SoundCloud`}
                  style={{ display: 'block', textDecoration: 'none', color: 'inherit', marginBottom: '12px' }}
                >
                  <div
                    className="workout-card"
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '1.05rem', lineHeight: 1.3, color: 'var(--workout-text)' }}>
                        {playlist.title}
                      </div>
                      <div style={{ marginTop: '4px', fontSize: '0.85rem', color: 'var(--workout-text-muted)' }}>
                        {t('music.duration')}: {playlist.durationLabel}
                      </div>
                    </div>
                    <span style={{ color: '#ff5500', fontWeight: 600, fontSize: '0.9rem', whiteSpace: 'nowrap', flexShrink: 0 }} aria-hidden="true">
                      Open ↗
                    </span>
                  </div>
                </a>
              ),
            )}
          </div>
        )}
      </div>

      <BottomNav />
    </main>
  );
}
