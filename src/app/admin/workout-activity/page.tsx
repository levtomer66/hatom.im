import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import Navbar from '@/components/Navbar';
import { getWorkoutActivity } from '@/lib/workout-activity';
import '../allowlist/admin.css';
import './activity.css';

// Owner-only analytics for the /workout feature: who's active, how many
// workouts each has logged, and how recent. Read-only. Always dynamic —
// the numbers change as people train.
export const dynamic = 'force-dynamic';

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  return iso.slice(0, 10);
}

export default async function WorkoutActivityPage() {
  const session = await auth();
  if (!session?.user) {
    redirect('/login?from=/admin/workout-activity');
  }
  if (!session.user.isOwner) {
    redirect('/');
  }

  const data = await getWorkoutActivity();
  const { summary, users, withAccessNoWorkouts } = data;

  const cards: { label: string; value: number; hint?: string }[] = [
    { label: 'Active users', value: summary.activeUsers, hint: '≥1 workout logged' },
    { label: 'Active last 7d', value: summary.activeLast7, hint: 'trained this week' },
    { label: 'Total workouts', value: summary.totalWorkouts },
    { label: 'Workouts · 7d', value: summary.workoutsLast7 },
    { label: 'Workouts · 30d', value: summary.workoutsLast30 },
    { label: 'In progress', value: summary.inProgress, hint: 'not completed' },
    { label: 'Completed', value: summary.completed },
    { label: 'Sets logged', value: summary.totalSets },
  ];

  return (
    <>
      <Navbar />
      <main className="admin-page">
        <div className="admin-container wa-container" dir="ltr">
          <header className="admin-hero">
            <h1>Workout activity</h1>
            <p>
              Owner-only view of the workout tracker. Generated {fmtDate(data.generatedAt)}.
            </p>
          </header>

          <section className="wa-cards">
            {cards.map((c) => (
              <div key={c.label} className="wa-card">
                <div className="wa-card-value">{c.value.toLocaleString()}</div>
                <div className="wa-card-label">{c.label}</div>
                {c.hint && <div className="wa-card-hint">{c.hint}</div>}
              </div>
            ))}
          </section>

          <section className="admin-card wa-table-wrap">
            <h2 className="wa-section-title">Per user</h2>
            {users.length === 0 ? (
              <div className="admin-empty">No workouts logged yet.</div>
            ) : (
              <table className="wa-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th>Role</th>
                    <th className="wa-num">Workouts</th>
                    <th className="wa-num">Done</th>
                    <th className="wa-num">In prog.</th>
                    <th className="wa-num">7d</th>
                    <th className="wa-num">30d</th>
                    <th className="wa-num">Sets</th>
                    <th>Last active</th>
                    <th>First</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.userId}>
                      <td>
                        <div className="wa-user-name">{u.name}</div>
                        <div className="wa-user-email">{u.userId}</div>
                      </td>
                      <td>
                        {u.isOwner ? (
                          <span className="wa-badge wa-badge--owner">Owner</span>
                        ) : u.isAllowlisted ? (
                          <span className="wa-badge">Allowlisted</span>
                        ) : (
                          <span className="wa-muted">—</span>
                        )}
                        {!u.isOwner && !u.hasWorkoutAccess && (
                          <span className="wa-badge wa-badge--warn" title="Has history but no current /workout grant">
                            no access
                          </span>
                        )}
                      </td>
                      <td className="wa-num wa-strong">{u.total}</td>
                      <td className="wa-num">{u.completed}</td>
                      <td className="wa-num">{u.inProgress}</td>
                      <td className="wa-num">{u.last7}</td>
                      <td className="wa-num">{u.last30}</td>
                      <td className="wa-num">{u.totalSets}</td>
                      <td>{fmtDate(u.lastDate)}</td>
                      <td>{fmtDate(u.firstDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {withAccessNoWorkouts.length > 0 && (
            <section className="admin-card wa-table-wrap">
              <h2 className="wa-section-title">Has access · no workouts yet</h2>
              <ul className="wa-roster">
                {withAccessNoWorkouts.map((r) => (
                  <li key={r.email}>
                    <span className="wa-user-name">{r.name}</span>
                    <span className="wa-user-email">{r.email}</span>
                    {r.isOwner && <span className="wa-badge wa-badge--owner">Owner</span>}
                    {!r.isOwner && r.isAllowlisted && <span className="wa-badge">Allowlisted</span>}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </main>
    </>
  );
}
