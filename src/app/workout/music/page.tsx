'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useWorkoutUser } from '@/context/WorkoutUserContext';
import { useT } from '@/lib/workout-i18n';
import Header from '@/components/workout/Header';
import BottomNav from '@/components/workout/BottomNav';
import { WORKOUT_PLAYLISTS } from '@/data/workout-playlists';

export default function MusicPage() {
  const router = useRouter();
  const { currentUser, isLoading } = useWorkoutUser();
  const t = useT();

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

  return (
    <main className="workout-main">
      <Header title={t('music.title')} />

      <div className="workout-page">
        {WORKOUT_PLAYLISTS.map(playlist => (
          <a
            key={playlist.id}
            href={playlist.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open ${playlist.title} on SoundCloud`}
            style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}
          >
            <div
              className="workout-card"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontWeight: 600,
                    fontSize: '1.05rem',
                    lineHeight: 1.3,
                    color: 'var(--workout-text)',
                  }}
                >
                  {playlist.title}
                </div>
                <div
                  style={{
                    marginTop: '4px',
                    fontSize: '0.85rem',
                    color: 'var(--workout-text-muted)',
                  }}
                >
                  {t('music.duration')}: {playlist.durationLabel}
                </div>
              </div>
              <span
                style={{
                  color: '#ff5500',
                  fontWeight: 600,
                  fontSize: '0.9rem',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
                aria-hidden="true"
              >
                Open ↗
              </span>
            </div>
          </a>
        ))}
      </div>

      <BottomNav />
    </main>
  );
}
