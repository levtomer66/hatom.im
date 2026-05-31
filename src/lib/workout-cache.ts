// Cache-tag helpers for workout data. The PB endpoint memoizes its
// (expensive, full-collection-scan) computation per user with
// `unstable_cache` tagged by `personalBestsTag(userId)`. Any handler
// that mutates a user's workouts must call
// `revalidateTag(personalBestsTag(userId))` so the next PB read
// recomputes. Kept in a plain lib (not the route file) because
// App Router route modules may only export HTTP handlers + framework
// config — arbitrary named exports there are not allowed.

export function personalBestsTag(userId: string): string {
  return `workout-pb:${userId}`;
}
