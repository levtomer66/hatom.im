import {
  SpaSession,
  SPA_USERS,
  flagsLabel,
  getSpaUser,
} from '@/types/spa';

// Format a Date as the YYYYMMDDTHHmmssZ string Google Calendar expects.
function formatGcalUtc(d: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  return (
    `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}` +
    `T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
  );
}

export function buildGoogleCalendarUrl(session: SpaSession): string {
  const start = new Date(session.scheduledAt);
  const end = new Date(start.getTime() + session.durationMinutes * 60_000);

  const giver = getSpaUser(session.giverId);
  const receiver = getSpaUser(session.receiverId);

  // When the easter-egg ♡ is armed, append a 🔥 to the calendar title so
  // either Tom can spot a spicy session at a glance without leaking the
  // details into a calendar invite preview.
  const heat = session.happyEnding ? ' 🔥' : '';
  const text = `💆 Spa: ${giver.name} → ${receiver.name}${heat}`;

  const detailLines = [
    `Giver: ${giver.name}`,
    `Receiver: ${receiver.name}`,
    `Duration: ${session.durationMinutes} min`,
    `Flags: ${flagsLabel(session.flags)}`,
  ];
  if (session.happyEnding) {
    detailLines.push('Happy ending: 🔥💋');
  }
  if (session.preferences.trim()) {
    detailLines.push('', 'Preferences:', session.preferences.trim());
  }
  const details = detailLines.join('\n');

  const guests = SPA_USERS.map((u) => u.email).join(',');

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text,
    dates: `${formatGcalUtc(start)}/${formatGcalUtc(end)}`,
    details,
    add: guests,
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
