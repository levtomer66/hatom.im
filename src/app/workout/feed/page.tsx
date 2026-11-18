'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useWorkoutUser } from '@/context/WorkoutUserContext';
import { useWorkoutLanguage } from '@/context/WorkoutLanguageContext';
import { useWorkoutUnit } from '@/context/WorkoutUnitContext';
import { useT, formatDate, getLocalizedTemplateName } from '@/lib/workout-i18n';
import { bragLine } from '@/lib/workout-brag';
import { exerciseNameFor } from '@/lib/workout-brag-names';
import Header from '@/components/workout/Header';
import BottomNav from '@/components/workout/BottomNav';
import MovingCar from '@/components/workout/MovingCar';
import FeedRecords from '@/components/workout/FeedRecords';
import { formatVolume } from '@/lib/weight';
import { useVolumeRecords } from '@/lib/useVolumeRecords';
import { RECORD_ICON, recordBadgeFor } from '@/lib/workout-records';
import ExerciseCard from '@/components/workout/ExerciseCard';
import { EXERCISE_LIBRARY } from '@/data/exercise-library';
import type { ExerciseDefinition, WorkoutExercise } from '@/types/workout';

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
  brag?: unknown;     // stored joke pick; absent on older posts
  includeSets?: boolean; // false = sharer kept the sets private; absent = shared
  sharedAt: string;
  displayName: string;
  likeCount: number;
  likedByMe: boolean;
}

const PAGE_SIZE = 20;

// GET /api/workout/feed/[workoutId] — the sets behind one post, fetched the
// first time someone opens it.
type PostSets =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; exercises: WorkoutExercise[]; map: Record<string, ExerciseDefinition> };

const LIBRARY_MAP: Record<string, ExerciseDefinition> = Object.fromEntries(
  EXERCISE_LIBRARY.map((e) => [e.id, e]),
);

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
  const [togglingId, setTogglingId] = useState<string | null>(null);
  // Bumped when this viewer unshares a post so the car strip re-totals.
  const [carRefresh, setCarRefresh] = useState(0);
  const records = useVolumeRecords(!!currentUser, carRefresh);
  const nextSkipRef = useRef(0);
  // Which posts are expanded, and their sets (cached per workout).
  const [openIds, setOpenIds] = useState<Set<string>>(new Set());
  const [setsById, setSetsById] = useState<Record<string, PostSets>>({});

  const toggleSets = useCallback((workoutId: string) => {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(workoutId)) next.delete(workoutId);
      else next.add(workoutId);
      return next;
    });
    if (setsById[workoutId]?.status === 'ready' || setsById[workoutId]?.status === 'loading') return;
    setSetsById((prev) => ({ ...prev, [workoutId]: { status: 'loading' } }));
    fetch(`/api/workout/feed/${workoutId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data: { exercises: WorkoutExercise[]; customExercises: { id: string; name: string }[] }) => {
        const map = { ...LIBRARY_MAP };
        for (const c of data.customExercises ?? []) {
          map[c.id] = { id: c.id, name: c.name, categories: [], isCustom: true };
        }
        const exercises = [...data.exercises].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        setSetsById((prev) => ({ ...prev, [workoutId]: { status: 'ready', exercises, map } }));
      })
      .catch(() => setSetsById((prev) => ({ ...prev, [workoutId]: { status: 'error' } })));
  }, [setsById]);
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
        setCarRefresh((n) => n + 1);
      }
    } catch (error) {
      console.error('Error unsharing:', error);
    } finally {
      setUnsharingId(null);
    }
  };

  // Merge a partial change into one post by id (drives the optimistic like flow).
  const patchPost = (id: string, changes: Partial<FeedItem>) =>
    setPosts((prev) => prev.map((p) => (p.id === id ? { ...p, ...changes } : p)));

  // Toggle my 💪 on someone else's post. Optimistic: flip locally, then
  // reconcile with the server's authoritative count (or revert on failure).
  const toggleLike = async (post: FeedItem) => {
    if (!currentUser || post.userId === currentUser.id || togglingId) return;
    setTogglingId(post.id);

    const nextLiked = !post.likedByMe;
    patchPost(post.id, {
      likedByMe: nextLiked,
      likeCount: post.likeCount + (nextLiked ? 1 : -1),
    });
    const revert = () =>
      patchPost(post.id, { likedByMe: post.likedByMe, likeCount: post.likeCount });

    try {
      const res = await fetch(`/api/workout/feed/${post.workoutId}/like`, { method: 'POST' });
      if (res.ok) {
        const data: { likeCount: number; likedByMe: boolean } = await res.json();
        patchPost(post.id, { likeCount: data.likeCount, likedByMe: data.likedByMe });
      } else {
        revert();
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      revert();
    } finally {
      setTogglingId(null);
    }
  };

  const volumeText = (kg: number) => formatVolume(kg, unit);

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
      {/* Record board + car sit between the sticky header and the page and
          stay pinned under the header together while posts scroll beneath. */}
      <div className="feed-top">
        <FeedRecords records={records} currentUserId={currentUser.id} />
        <MovingCar refreshKey={carRefresh} />
      </div>
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
              const brag = bragLine(post.brag, post.stats.totalVolumeKg, post.workoutId, language, exerciseNameFor(language));
              const badge = recordBadgeFor(records, post);
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
                  {badge && (
                    <div className={`feed-post-record feed-post-record-${badge}`}>
                      {RECORD_ICON[badge]} {badge === 'group' ? t('records.group_badge') : t('records.personal_badge')}
                    </div>
                  )}
                  <div className="feed-post-brag">{brag}</div>
                  {post.includeSets === false ? (
                    <div className="feed-post-sets-private">🔒 {t('feed.sets_private')}</div>
                  ) : (
                    <button
                      type="button"
                      className="feed-post-sets-toggle"
                      onClick={() => toggleSets(post.workoutId)}
                      aria-expanded={openIds.has(post.workoutId)}
                    >
                      {openIds.has(post.workoutId) ? t('feed.hide_sets') : t('feed.show_sets')}
                    </button>
                  )}
                  {openIds.has(post.workoutId) && (() => {
                    const sets = setsById[post.workoutId];
                    if (!sets || sets.status === 'loading') return <div className="feed-post-sets-status">…</div>;
                    if (sets.status === 'error') return <div className="feed-post-sets-status">⚠️</div>;
                    return (
                      <div className="feed-post-sets">
                        {sets.exercises.map((ex) => (
                          <ExerciseCard
                            key={ex.id}
                            exercise={ex}
                            exerciseDefinition={sets.map[ex.exerciseId] ?? null}
                            pb={null}
                            mode="readonly"
                            exerciseMap={sets.map}
                          />
                        ))}
                      </div>
                    );
                  })()}
                  <div className="feed-post-foot">
                    {mine ? (
                      // Your own post: count is read-only (you can't flex on yourself).
                      <span
                        className="feed-post-like feed-post-like-static"
                        aria-label={`${post.likeCount} ${t('feed.likes')}`}
                      >
                        <span className="feed-post-like-emoji">💪</span>
                        <span className="feed-post-like-count">{post.likeCount}</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        className={`feed-post-like${post.likedByMe ? ' liked' : ''}`}
                        onClick={() => toggleLike(post)}
                        disabled={togglingId === post.id}
                        aria-pressed={post.likedByMe}
                        aria-label={t('feed.like')}
                      >
                        <span className="feed-post-like-emoji">💪</span>
                        <span className="feed-post-like-count">{post.likeCount}</span>
                      </button>
                    )}
                  </div>
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
