// Bare-date helpers for the ToDo feature. Import-free (unit-tested with
// node --test). `YYYY-MM-DD` is parsed at LOCAL midnight — never `new
// Date(str)`, which is UTC and lands on the previous day west of Greenwich.

export function parseLocalDate(ymd: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return new Date(ymd);
}

export function todayYmd(now: Date = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// True when `dueYmd` is strictly before today's local date. Zero-padded YMD
// strings compare correctly with a plain lexical `<`.
export function isOverdue(dueYmd: string | undefined, now: Date = new Date()): boolean {
  if (!dueYmd) return false;
  return dueYmd < todayYmd(now);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Short human label: 'Today' / 'Tomorrow' / 'Yesterday', a weekday within the
// next week, else 'Mon D' ('Sep 20'); the year is appended only when it isn't
// the current year.
export function formatDueLabel(dueYmd: string, now: Date = new Date()): string {
  const due = parseLocalDate(dueYmd);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86_400_000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays === -1) return 'Yesterday';
  if (diffDays > 1 && diffDays < 7) return WD[due.getDay()];
  const base = `${MONTHS[due.getMonth()]} ${due.getDate()}`;
  return due.getFullYear() === today.getFullYear() ? base : `${base} ${due.getFullYear()}`;
}
