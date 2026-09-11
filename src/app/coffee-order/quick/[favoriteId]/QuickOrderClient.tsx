'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { CoffeeOrder, drinkSummary } from '@/types/coffee-order';

type State =
  | { phase: 'ordering' }
  | { phase: 'done'; order: CoffeeOrder }
  | { phase: 'error'; message: string };

// iOS resumes a standalone home-screen web app instead of reloading it, so a
// re-tap never remounts. We re-order whenever the app returns to the foreground
// (visibilitychange→visible) — note that fires on ANY foregrounding, not only an
// icon tap, which is acceptable for a page whose sole purpose is to order. Two
// guards keep it from placing stray orders: an in-flight ref (never two
// overlapping POSTs — the cooldown alone can't prevent that, being timed from
// request start, so a slow POST could outlast it) and a cooldown timed from
// completion (spaces repeats; absorbs the dev double-mount).
const REFIRE_COOLDOWN_MS = 2500;

export default function QuickOrderClient({ favoriteId }: { favoriteId: string }) {
  const [state, setState] = useState<State>({ phase: 'ordering' });
  const lastFiredRef = useRef(0);
  const inFlightRef = useRef(false);

  async function placeOrder() {
    if (inFlightRef.current || Date.now() - lastFiredRef.current < REFIRE_COOLDOWN_MS) return;
    inFlightRef.current = true;
    setState({ phase: 'ordering' });
    try {
      const res = await fetch(
        `/api/coffee-order/orders/from-favorite/${encodeURIComponent(favoriteId)}`,
        { method: 'POST' }
      );
      if (res.status === 401) {
        setState({ phase: 'error', message: 'צריך להתחבר קודם' });
        return;
      }
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setState({ phase: 'error', message: body.error ?? 'ההזמנה נכשלה' });
        return;
      }
      const order = (await res.json()) as CoffeeOrder;
      setState({ phase: 'done', order });
    } catch {
      setState({ phase: 'error', message: 'אין חיבור לרשת' });
    } finally {
      inFlightRef.current = false;
      lastFiredRef.current = Date.now();
    }
  }

  useEffect(() => {
    // Fire on first open, and again whenever the app is re-foregrounded — the
    // only signal iOS gives when the user re-taps an already-running PWA.
    void placeOrder();
    const onVisible = () => {
      if (document.visibilityState === 'visible') void placeOrder();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="quick-order" dir="rtl">
      {state.phase === 'ordering' && (
        <>
          <div className="quick-spinner" aria-hidden />
          <p className="quick-status">מזמין…</p>
        </>
      )}
      {state.phase === 'done' && (
        <>
          <div className="quick-check" aria-hidden>✓</div>
          <p className="quick-status">הוזמן!</p>
          <p className="quick-summary">{drinkSummary(state.order)}</p>
          <button type="button" className="quick-again" onClick={() => void placeOrder()}>
            הזמן שוב
          </button>
          <Link href="/coffee-order" className="quick-link">לעמוד הקפה</Link>
        </>
      )}
      {state.phase === 'error' && (
        <>
          <div className="quick-x" aria-hidden>✕</div>
          <p className="quick-status">{state.message}</p>
          <button type="button" className="quick-again" onClick={() => void placeOrder()}>
            נסה שוב
          </button>
          <Link href="/coffee-order" className="quick-link">לעמוד הקפה</Link>
        </>
      )}
    </main>
  );
}
