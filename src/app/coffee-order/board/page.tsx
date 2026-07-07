'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Navbar from '@/components/Navbar';
import { hasPermission } from '@/lib/permissions';
import {
  CoffeeOrder,
  OrderStatus,
  isBaristaEmail,
  drinkSummary,
} from '@/types/coffee-order';
import '../coffee-order.css';

// How often the board refetches while open — it's meant to sit on the
// barista's phone, so it keeps itself current without manual refresh.
const POLL_MS = 30_000;

// Cap the completed section so the board stays a queue, not an archive.
const DONE_SHOWN = 20;

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('he-IL', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// A scheduled order is "due" at its scheduled time; a now-order at creation.
function dueTime(o: CoffeeOrder): number {
  const iso =
    o.deliveryType === 'scheduled' && o.scheduledAt ? o.scheduledAt : o.createdAt;
  return new Date(iso).getTime();
}

export default function CoffeeBoardPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const isBarista =
    status === 'authenticated' &&
    hasPermission(session, 'coffee-order') &&
    isBaristaEmail(session?.user?.email);

  // Same soft-nav guard shape as the order page, plus the barista check —
  // non-baristas land back on the order form.
  useEffect(() => {
    if (status === 'loading') return;
    if (!session?.user) {
      router.replace('/login?from=/coffee-order/board');
      return;
    }
    if (!isBarista) {
      router.replace('/coffee-order');
    }
  }, [session, status, isBarista, router]);

  const [orders, setOrders] = useState<CoffeeOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Order id with an in-flight status PATCH; disables that card's button.
  const [busyId, setBusyId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/coffee-order/board');
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      setOrders((await res.json()) as CoffeeOrder[]);
      setError(null);
    } catch (err) {
      console.error(err);
      setError('לא ניתן לטעון את הלוח.');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial load + poll + refetch when the tab regains focus.
  useEffect(() => {
    if (!isBarista) return;
    refresh();
    const timer = window.setInterval(refresh, POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [isBarista, refresh]);

  async function setOrderStatus(id: string, next: OrderStatus) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/coffee-order/orders/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      const updated = (await res.json()) as CoffeeOrder;
      setOrders((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
    } catch (err) {
      console.error(err);
      setError('עדכון ההזמנה נכשל.');
    } finally {
      setBusyId(null);
    }
  }

  // Open orders as a FIFO queue: whatever is due soonest sits on top.
  const open = useMemo(
    () =>
      orders
        .filter((o) => o.status === 'open')
        .sort((a, b) => dueTime(a) - dueTime(b)),
    [orders]
  );
  const done = useMemo(
    () =>
      orders
        .filter((o) => o.status === 'done')
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )
        .slice(0, DONE_SHOWN),
    [orders]
  );

  if (status === 'loading' || !session?.user || !isBarista) {
    return <div className="coffee-page-blank" />;
  }

  return (
    <div>
      <Navbar />
      <div className="coffee-page">
        <div className="coffee-container">
          <header className="coffee-hero">
            <p className="coffee-hero-overline">— תור ההכנה —</p>
            <h1 className="coffee-hero-title">📋 לוח בריסטה</h1>
            <Link href="/coffee-order" className="coffee-board-back">
              ← להזמנת קפה
            </Link>
          </header>

          {error && <div className="coffee-error">{error}</div>}

          <div className="coffee-card">
            <h2 className="coffee-section-title">
              ממתינות{' '}
              {!loading && (
                <span className="coffee-board-count">{open.length}</span>
              )}
            </h2>
            {loading ? (
              <p className="coffee-empty">טוען…</p>
            ) : open.length === 0 ? (
              <p className="coffee-empty">אין הזמנות ממתינות ☕ הכל הוגש.</p>
            ) : (
              <div className="coffee-order-list">
                {open.map((o) => (
                  <article key={o.id} className="coffee-order-card">
                    <div className="coffee-order-main">
                      <span className="coffee-board-name">{o.userName}</span>
                      <span className="coffee-order-summary">
                        {drinkSummary(o)}
                      </span>
                      <span className="coffee-order-when">
                        {o.deliveryType === 'scheduled' && o.scheduledAt
                          ? `⏰ ${formatWhen(o.scheduledAt)}`
                          : `עכשיו · ${formatWhen(o.createdAt)}`}
                      </span>
                      {o.notes && (
                        <span className="coffee-order-notes">“{o.notes}”</span>
                      )}
                    </div>
                    <div className="coffee-order-actions">
                      <button
                        type="button"
                        className="coffee-quick-btn"
                        onClick={() => setOrderStatus(o.id, 'done')}
                        disabled={busyId === o.id}
                      >
                        ✓ בוצע
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>

          {!loading && done.length > 0 && (
            <div className="coffee-card">
              <h2 className="coffee-section-title">הושלמו</h2>
              <div className="coffee-order-list">
                {done.map((o) => (
                  <article
                    key={o.id}
                    className="coffee-order-card coffee-board-done"
                  >
                    <div className="coffee-order-main">
                      <span className="coffee-board-name">{o.userName}</span>
                      <span className="coffee-order-summary">
                        {drinkSummary(o)}
                      </span>
                      <span className="coffee-order-when">
                        {formatWhen(o.createdAt)}
                      </span>
                    </div>
                    <div className="coffee-order-actions">
                      <button
                        type="button"
                        className="coffee-quick-btn"
                        onClick={() => setOrderStatus(o.id, 'open')}
                        disabled={busyId === o.id}
                      >
                        ↩ החזר לתור
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
