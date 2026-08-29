'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useWorkoutUser } from '@/context/WorkoutUserContext';
import { useWorkoutLanguage } from '@/context/WorkoutLanguageContext';
import { useWorkoutUnit } from '@/context/WorkoutUnitContext';
import { useT, formatDate, getLocalizedTemplateName } from '@/lib/workout-i18n';
import { getVolumeBrag } from '@/lib/workout-volume-jokes';
import Header from '@/components/workout/Header';
import BottomNav from '@/components/workout/BottomNav';

// Shape of one GET /api/workout/feed item (server attaches displayName).
// Declared locally so this client page never imports the server-only model.
interface FeedItem {
  id: string;
  userId: string;
  workoutId: string;
  workoutName: string;
  workoutDate: string;
  workoutStartedAt: string;
  stats: {
    setsLogged: number;
    exercisesDone: number;
    exercisesTotal: number;
    totalVolumeKg: number;
  };
  sharedAt: string;
  displayName: string;
}

const PAGE_SIZE = 20;

export default function FeedPage() {
  const router = useRouter();
  const { currentUser, isLoading } = useWorkoutUser();
  const { language } = useWorkoutLanguage();
  const { unit } = useWorkoutUnit();
  const t = useT();

  useEffect(() => {
    if (!isLoading && !currentUser) {
      router.replace('/login?from=/workout/feed');
    }
  }, [isLoading, currentUser, router]);

  const [posts, setPosts] = useState<FeedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [unsharingId, setUnsharingId] = useState<string | null>(null);
  const nextSkipRef = useRef(0);
  const inFlightRef = useRef(false);

  // Load one page (fetches PAGE_SIZE + 1 to detect "has more" without a
  // trailing empty request). Dedupes on id so a re-share/refresh can't double.
  const loadPage = useCallback(async (skip: number) => {
    if (!currentUser || inFlightRef.current) return;
    inFlightRef.current = true;
    const initial = skip === 0;
    if (initial) setLoading(true);
    else setLoadingMore(true);
    try {
      const res = await fetch(`/api/workout/feed?limit=${PAGE_SIZE + 1}&skip=${skip}`);
      if (res.ok) {
        const batch: FeedItem[] = await res.json();
        const more = batch.length > PAGE_SIZE;
        const page = more ? batch.slice(0, PAGE_SIZE) : batch;
        setPosts((prev) => {
          const base = initial ? [] : prev;
          const seen = new Set(base.map((p) => p.id));
          return [...base, ...page.filter((p) => !seen.has(p.id))];
        });
        nextSkipRef.current = skip + page.length;
        setHasMore(more);
        setLoadError(false);
      } else {
        setLoadError(true);
      }
    } catch (error) {
      console.error('Error loading feed:', error);
      setLoadError(true);
    } finally {
      if (initial) setLoading(false);
      else setLoadingMore(false);
      inFlightRef.current = false;
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser) loadPage(0);
  }, [currentUser, loadPage]);

  const unshare = async (post: FeedItem) => {
    if (unsharingId) return;
    setUnsharingId(post.id);
    try {
      const res = await fetch(`/api/workout/feed/${post.workoutId}`, { method: 'DELETE' });
      if (res.ok) {
        setPosts((prev) => prev.filter((p) => p.id !== post.id));
      }
    } catch (error) {
      console.error('Error unsharing:', error);
    } finally {
      setUnsharingId(null);
    }
  };

  const volumeText = (kg: number) =>
    unit === 'lb'
      ? `${Math.round(kg * 2.20462).toLocaleString()} lb`
      : `${Math.round(kg).toLocaleString()} kg`;

  if (isLoading || !currentUser) {
    return (
      <main className="workout-main">
        <Header title={t('feed.title')} />
        <div className="workout-page">
          <div className="loading-spinner" />
        </div>
        <BottomNav />
      </main>
    );
  }

  return (
    <main className="workout-main">
      <Header title={t('feed.title')} />
      <div className="workout-page">
        {loading ? (
          <div className="loading-spinner" />
        ) : posts.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🔥</div>
            <div className="empty-state-text">{t('feed.empty')}</div>
          </div>
        ) : (
          <div className="feed-list">
            {posts.map((post) => {
              const mine = post.userId === currentUser.id;
              const brag = getVolumeBrag(post.stats.totalVolumeKg, language, post.workoutId);
              return (
                <div key={post.id} className="feed-post">
                  <div className="feed-post-head">
                    <div className="feed-post-who">
                      <span className="feed-post-name">{post.displayName}</span>
                      <span className="feed-post-action"> · {t('feed.completed')}</span>
                    </div>
                    {mine && (
                      <button
                        type="button"
                        className="feed-post-unshare"
                        onClick={() => unshare(post)}
                        disabled={unsharingId === post.id}
                        title={t('feed.unshare')}
                        aria-label={t('feed.unshare')}
                      >
                        ✕
                      </button>
                    )}
                  </div>
                  <div className="feed-post-workout">
                    {getLocalizedTemplateName(post.workoutName, language)}
                    <span className="feed-post-date">
                      {' · '}
                      {formatDate(post.workoutDate, language, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                  </div>
                  <div className="feed-post-stats">
                    <span><strong>{post.stats.setsLogged}</strong> {t('workout.summary.sets')}</span>
                    <span>·</span>
                    <span><strong>{post.stats.exercisesDone}/{post.stats.exercisesTotal}</strong> {t('workout.summary.exercises')}</span>
                    <span>·</span>
                    <span><strong>{volumeText(post.stats.totalVolumeKg)}</strong></span>
                  </div>
                  <div className="feed-post-brag">{brag}</div>
                </div>
              );
            })}

            {loadError && <div className="empty-state-text">⚠️</div>}

            {hasMore && (
              <button
                type="button"
                className="workout-btn workout-btn-secondary workout-btn-full"
                onClick={() => loadPage(nextSkipRef.current)}
                disabled={loadingMore}
              >
                {loadingMore ? '…' : t('feed.load_more')}
              </button>
            )}
          </div>
        )}
      </div>
      <BottomNav />
    </main>
  );
}
