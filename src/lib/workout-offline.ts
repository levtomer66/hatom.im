// Offline-safety helpers for the workout PWA.
//
// The service worker (`public/workout-sw.js`) returns a SYNTHETIC 202
// `{ queued: true }` for any mutating workout API call it couldn't deliver
// (offline / 5xx), so the UI can keep going for edits that will drain later.
// That is safe for a PUT against an EXISTING workout — the queued request
// carries the workout's real id and applies on drain — but it is NOT safe
// for the CREATE POST: a queued create has no server id yet, so every later
// autosave/complete PUT (which needs `workout.id`) would be silently dropped
// and the whole session — sets and completion — lost. Callers must detect a
// create that didn't actually land and refuse to start a phantom session.
//
// Pure + import-free so it is unit-testable with `node --test`.

// True when a create response is a workout the server actually created — it
// carries a real string id. The synthetic queued 202 has no id, so this is
// false for it (and for any malformed / non-created body).
export function isCreatedWorkout(responseBody: unknown): boolean {
  if (responseBody && typeof responseBody === 'object' && 'id' in responseBody) {
    const id = (responseBody as { id?: unknown }).id;
    return typeof id === 'string' && id.length > 0;
  }
  return false;
}
