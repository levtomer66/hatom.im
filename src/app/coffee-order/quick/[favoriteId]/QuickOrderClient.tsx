'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { CoffeeOrder, drinkSummary } from '@/types/coffee-order';

type State =
  | { phase: 'ordering' }
  | { phase: 'done'; order: CoffeeOrder }
  | { phase: 'error'; message: string };

export default function QuickOrderClient({ favoriteId }: { favoriteId: string }) {
  const [state, setState] = useState<State>({ phase: 'ordering' });
  // Guard React's dev double-mount so we never place two orders per open.
  const firedRef = useRef(false);

  async function placeOrder() {
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
    }
  }

  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;
    void placeOrder();
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
