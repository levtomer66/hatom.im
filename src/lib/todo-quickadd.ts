import type { TodoMember } from '../types/todo.ts';

export interface QuickAddResult {
  text: string;
  assignees: string[];        // emails
  dueDate?: string;           // 'YYYY-MM-DD'
}

const WEEKDAYS: Record<string, number> = {
  sunday: 0, sun: 0,
  monday: 1, mon: 1,
  tuesday: 2, tue: 2, tues: 2,
  wednesday: 3, wed: 3,
  thursday: 4, thu: 4, thurs: 4,
  friday: 5, fri: 5,
  saturday: 6, sat: 6,
};

function ymd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Resolve a `!token` (without the '!') to 'YYYY-MM-DD', or null if not a date.
// A weekday equal to `today` resolves to today (offset 0), not next week.
export function resolveDueToken(token: string, today: Date): string | null {
  const t = token.toLowerCase();
  if (t === 'today') return ymd(today);
  if (t === 'tomorrow') {
    return ymd(new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1));
  }
  if (t in WEEKDAYS) {
    const offset = (WEEKDAYS[t] - today.getDay() + 7) % 7;
    return ymd(new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset));
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) {
    const [y, m, d] = t.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    if (dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d) return t;
    return null;
  }
  return null;
}

// Match an `@token` (without the '@') to exactly one member. Returns the email,
// or null when zero or multiple members match (ambiguous → left as literal text).
export function resolveAssigneeToken(token: string, members: TodoMember[]): string | null {
  const t = token.toLowerCase();
  if (!t) return null;
  const matches = members.filter((m) => {
    const local = m.email.toLowerCase().split('@')[0];
    const name = m.name.toLowerCase().replace(/\s+/g, '');
    return m.email.toLowerCase() === t || local.startsWith(t) || name.startsWith(t);
  });
  const emails = [...new Set(matches.map((m) => m.email))];
  return emails.length === 1 ? emails[0] : null;
}

export function parseQuickAdd(
  raw: string,
  members: TodoMember[],
  today: Date = new Date(),
): QuickAddResult {
  const assignees: string[] = [];
  let dueDate: string | undefined;
  const textParts: string[] = [];

  for (const token of raw.split(/\s+/)) {
    if (!token) continue;
    if (token.startsWith('@') && token.length > 1) {
      const email = resolveAssigneeToken(token.slice(1), members);
      if (email) {
        if (!assignees.includes(email)) assignees.push(email);
        continue;
      }
    } else if (token.startsWith('!') && token.length > 1) {
      const due = resolveDueToken(token.slice(1), today);
      if (due) {
        dueDate = due;          // last valid !date wins
        continue;
      }
    }
    textParts.push(token);
  }

  return { text: textParts.join(' ').trim(), assignees, dueDate };
}
