import clientPromise from '@/lib/mongodb';
import { getAllAuthorizedEmails } from '@/models/AuthorizedEmail';
import { isOwnerEmail, OWNER_EMAILS } from '@/types/auth';
import { getUserDisplayName } from '@/types/workout';

// Owner-only workout-activity analytics. Read-only aggregation across three
// collections (workouts + the Auth.js `users` roster + `authorizedEmails`),
// surfaced at /admin/workout-activity. Uses the raw mongodb driver via
// clientPromise — same access path as the AuthorizedEmail model — so it
// composes cleanly in a server component without a mongoose connection.

export interface UserActivity {
  userId: string;          // == email
  name: string;
  isOwner: boolean;
  isAllowlisted: boolean;
  hasWorkoutAccess: boolean;
  total: number;
  completed: number;
  inProgress: number;
  last7: number;
  last30: number;
  firstDate: string | null;   // YYYY-MM-DD
  lastDate: string | null;    // YYYY-MM-DD
  lastActiveAt: string | null; // ISO
  totalSets: number;
}

export interface RosterEntry {
  email: string;
  name: string;
  isOwner: boolean;
  isAllowlisted: boolean;
  hasWorkoutAccess: boolean;
}

export interface WorkoutActivity {
  generatedAt: string;
  summary: {
    totalWorkouts: number;
    activeUsers: number;       // distinct users with >=1 workout
    activeLast7: number;       // users with a workout in the last 7 days
    workoutsLast7: number;
    workoutsLast30: number;
    completed: number;
    inProgress: number;
    totalSets: number;
  };
  users: UserActivity[];                // one row per user with >=1 workout, most-recent first
  withAccessNoWorkouts: RosterEntry[];  // can use /workout but have logged nothing yet
}

interface WorkoutGroupRow {
  _id: string;
  total: number;
  completed: number;
  last7: number;
  last30: number;
  firstDate: string | null;
  lastDate: string | null;
  lastActiveAt: Date | null;
  totalSets: number;
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export async function getWorkoutActivity(now: Date = new Date()): Promise<WorkoutActivity> {
  const client = await clientPromise;
  const db = client.db();

  const cutoff = (days: number): string => {
    const d = new Date(now);
    d.setUTCDate(d.getUTCDate() - days);
    return isoDay(d);
  };
  const cutoff7 = cutoff(7);
  const cutoff30 = cutoff(30);

  // Per-user workout rollup. `date` is a YYYY-MM-DD string, so lexical
  // comparison is a valid date-range filter; `updatedAt` is a real Date
  // (last interaction). totalSets reduces over each workout's exercises[].
  const grouped = (await db
    .collection('workouts')
    .aggregate<WorkoutGroupRow>([
      {
        $group: {
          _id: '$userId',
          total: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ['$isCompleted', true] }, 1, 0] } },
          last7: { $sum: { $cond: [{ $gte: ['$date', cutoff7] }, 1, 0] } },
          last30: { $sum: { $cond: [{ $gte: ['$date', cutoff30] }, 1, 0] } },
          firstDate: { $min: '$date' },
          lastDate: { $max: '$date' },
          lastActiveAt: { $max: '$updatedAt' },
          totalSets: {
            $sum: {
              $reduce: {
                input: { $ifNull: ['$exercises', []] },
                initialValue: 0,
                in: { $add: ['$$value', { $size: { $ifNull: ['$$this.sets', []] } }] },
              },
            },
          },
        },
      },
      { $sort: { lastActiveAt: -1 } },
    ])
    .toArray()) as WorkoutGroupRow[];

  // Roster context: Auth.js `users` gives the display name from Google;
  // `authorizedEmails` gives who's allowlisted + holds the 'workout' grant.
  const [authUsers, authorized] = await Promise.all([
    db
      .collection<{ email?: string; name?: string }>('users')
      .find({}, { projection: { email: 1, name: 1 } })
      .toArray(),
    getAllAuthorizedEmails(),
  ]);

  const googleName = new Map<string, string>();
  for (const u of authUsers) {
    if (u.email) googleName.set(u.email.toLowerCase(), u.name || '');
  }
  const allowlisted = new Map<string, boolean>();
  const workoutGrant = new Map<string, boolean>();
  for (const a of authorized) {
    allowlisted.set(a.email.toLowerCase(), true);
    workoutGrant.set(a.email.toLowerCase(), a.allowedPages.includes('workout'));
  }

  const displayName = (email: string): string => {
    const lc = email.toLowerCase();
    return googleName.get(lc) || getUserDisplayName(email) || email;
  };
  const owns = (email: string) => isOwnerEmail(email);
  const hasAccess = (email: string) => owns(email) || workoutGrant.get(email.toLowerCase()) === true;

  const users: UserActivity[] = grouped.map((g) => ({
    userId: g._id,
    name: displayName(g._id),
    isOwner: owns(g._id),
    isAllowlisted: allowlisted.get(g._id.toLowerCase()) === true,
    hasWorkoutAccess: hasAccess(g._id),
    total: g.total,
    completed: g.completed,
    inProgress: g.total - g.completed,
    last7: g.last7,
    last30: g.last30,
    firstDate: g.firstDate ?? null,
    lastDate: g.lastDate ?? null,
    lastActiveAt: g.lastActiveAt ? new Date(g.lastActiveAt).toISOString() : null,
    totalSets: g.totalSets ?? 0,
  }));

  // Users who CAN use /workout (owner or 'workout' grant) but have logged
  // nothing — useful "active vs. dormant" context.
  const withWorkouts = new Set(users.map((u) => u.userId.toLowerCase()));
  const accessEmails = new Set<string>([
    ...OWNER_EMAILS.map((e) => e.toLowerCase()),
    ...[...workoutGrant.entries()].filter(([, v]) => v).map(([e]) => e),
  ]);
  const withAccessNoWorkouts: RosterEntry[] = [...accessEmails]
    .filter((e) => !withWorkouts.has(e))
    .map((e) => ({
      email: e,
      name: displayName(e),
      isOwner: owns(e),
      isAllowlisted: allowlisted.get(e) === true,
      hasWorkoutAccess: true,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const sum = (sel: (u: UserActivity) => number) => users.reduce((acc, u) => acc + sel(u), 0);

  return {
    generatedAt: now.toISOString(),
    summary: {
      totalWorkouts: sum((u) => u.total),
      activeUsers: users.length,
      activeLast7: users.filter((u) => u.last7 > 0).length,
      workoutsLast7: sum((u) => u.last7),
      workoutsLast30: sum((u) => u.last30),
      completed: sum((u) => u.completed),
      inProgress: sum((u) => u.inProgress),
      totalSets: sum((u) => u.totalSets),
    },
    users,
    withAccessNoWorkouts,
  };
}
