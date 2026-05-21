import {
  SpaSession,
  SPA_USERS,
  getMassageTypeLabel,
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
  const massageLabel = getMassageTypeLabel(session.massageType);

  const text = `💆 Spa: ${giver.name} → ${receiver.name} (${massageLabel})`;

  const detailLines = [
    `Giver: ${giver.name}`,
    `Receiver: ${receiver.name}`,
    `Massage type: ${massageLabel}`,
    `Duration: ${session.durationMinutes} min`,
  ];
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
