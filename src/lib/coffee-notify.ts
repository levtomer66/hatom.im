import { CoffeeOrder, drinkSummary } from '@/types/coffee-order';

const NTFY_TOPIC = 'hatomim_coffee';

// Push so whoever is making coffee sees the order land. Call inside next/server
// `after()` — a bare fire-and-forget fetch dies when Vercel freezes the
// function right after the response. Failure is logged, never thrown.
export async function notifyCoffeeOrder(order: CoffeeOrder): Promise<void> {
  const when =
    order.deliveryType === 'scheduled' && order.scheduledAt
      ? new Date(order.scheduledAt).toLocaleString('he-IL', {
          dateStyle: 'medium',
          timeStyle: 'short',
          timeZone: 'Asia/Jerusalem',
        })
      : 'עכשיו';
  const bodyLines = [order.userName, drinkSummary(order), `מתי: ${when}`];
  if (order.notes.trim()) bodyLines.push(`הערות: ${order.notes.trim()}`);

  // ntfy Title is an HTTP header and must be ASCII. Strip non-ASCII from the
  // (possibly Hebrew/emoji) display name, falling back to the email local-part.
  const asciiName =
    order.userName.replace(/[^\x20-\x7E]/g, '').trim() ||
    order.userEmail.split('@')[0];

  await fetch(`https://ntfy.sh/${NTFY_TOPIC}`, {
    method: 'POST',
    body: bodyLines.join('\n'),
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      // Title must be ASCII for ntfy.sh.
      Title: `New coffee order: ${asciiName}`,
      Tags: 'coffee',
    },
  }).catch((err) => {
    console.error('ntfy coffee notify failed', err);
  });
}
