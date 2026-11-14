// Volume records: the heaviest single workout (by total volume, kg).
//   - Feed + group record: each user's heaviest SHARED workout, from the
//     feed-post snapshots (stats.totalVolumeKg) — the same data that drives
//     The Moving Car — so the record board and the car never disagree.
//   - The caller's own personal record (`myBest`) counts every completed
//     workout, shared or not; only you see it.
// Nothing is stored: records are derived on read.
//
// Import-free so node --test can load it.

// One workout's volume, as read from a feed post or a workout.
export interface VolumeRecordRow {
  userId: string;
  kg: number;
  workoutId: string;
  workoutDate: string; // YYYY-MM-DD
}

export interface VolumeRecord extends VolumeRecordRow {
  displayName: string;
}

export interface VolumeRecords {
  group: VolumeRecord | null; // group record holder
  byUser: VolumeRecord[]; // one per user, heaviest first
}

// What GET /api/workout/feed/records returns. `myBest` is the CALLER's
// heaviest completed workout, shared or not — the honest personal record for
// the live workout bar. Other users' records only ever come from shared posts.
export interface VolumeRecordsResponse extends VolumeRecords {
  myBest: VolumeRecordRow | null;
}

export type RecordKind = 'group' | 'personal';
export const RECORD_ICON: Record<RecordKind, string> = { group: '👑', personal: '🏆' };

// Heaviest of a set of rows (ties → earlier workout), or null.
export function bestRow(rows: readonly VolumeRecordRow[]): VolumeRecordRow | null {
  let best: VolumeRecordRow | null = null;
  for (const r of rows) {
    if (!Number.isFinite(r.kg) || r.kg <= 0) continue;
    if (!best || r.kg > best.kg || (r.kg === best.kg && r.workoutDate < best.workoutDate)) best = r;
  }
  return best;
}

// Pick each user's best post and the overall best. Ties keep the EARLIER
// workout — whoever got there first holds the record.
export function computeVolumeRecords(
  posts: readonly VolumeRecordRow[],
  displayName: (userId: string) => string,
): VolumeRecords {
  const best = new Map<string, VolumeRecordRow>();
  for (const p of posts) {
    if (!Number.isFinite(p.kg) || p.kg <= 0) continue;
    const cur = best.get(p.userId);
    if (!cur || p.kg > cur.kg || (p.kg === cur.kg && p.workoutDate < cur.workoutDate)) {
      best.set(p.userId, p);
    }
  }
  const byUser = [...best.values()]
    .sort((a, b) => b.kg - a.kg || a.workoutDate.localeCompare(b.workoutDate))
    .map((r) => ({ ...r, displayName: displayName(r.userId) }));
  return { group: byUser[0] ?? null, byUser };
}

// Which badge a feed post earns: the group record outranks a personal one.
export function recordBadgeFor(
  records: VolumeRecords | null,
  post: { workoutId: string; userId: string },
): RecordKind | null {
  if (!records) return null;
  if (records.group?.workoutId === post.workoutId) return 'group';
  const mine = records.byUser.find((r) => r.userId === post.userId);
  return mine?.workoutId === post.workoutId ? 'personal' : null;
}

// Live progress toward a record, 0..1 (clamped). No record → null (nothing
// to chase yet).
export function recordProgress(currentKg: number, recordKg: number | null | undefined): number | null {
  if (recordKg == null || !(recordKg > 0)) return null;
  return Math.max(0, Math.min(1, currentKg / recordKg));
}
