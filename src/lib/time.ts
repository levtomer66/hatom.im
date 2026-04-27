// "01:30" / "0:45" — minute:second display for rest timers and timed sets.
// Negative inputs render as "0:00"; non-finite inputs likewise.
export function formatSeconds(total: number): string {
  if (!Number.isFinite(total) || total <= 0) return '0:00';
  const t = Math.round(total);
  const m = Math.floor(t / 60);
  const s = t % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
