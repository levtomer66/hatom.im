import { getUserDisplayName } from '@/types/workout';

// Best-effort ntfy.sh push for a task assignment. Never throws — a failed
// notification must not break the API response. Server-side fetch, so the
// browser CSP doesn't apply (ntfy.sh is on connect-src regardless).
export async function notifyAssignment(
  topic: string,
  opts: { taskText: string; assignees: string[]; byEmail: string },
): Promise<void> {
  try {
    if (!topic || opts.assignees.length === 0) return;
    const who = opts.assignees.map((e) => getUserDisplayName(e)).join(', ');
    const by = getUserDisplayName(opts.byEmail);
    const body = `${who}: ${opts.taskText}${by ? ` (by ${by})` : ''}`;
    await fetch(`https://ntfy.sh/${encodeURIComponent(topic)}`, {
      method: 'POST',
      headers: { Title: 'New to-do assigned', Tags: 'memo' },
      body,
    });
  } catch (e) {
    console.error('ntfy notify failed:', e);
  }
}
