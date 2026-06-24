'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Navbar from '@/components/Navbar';
import { hasPermission } from '@/lib/permissions';
import {
  CoffeeOrder,
  CoffeeFavorite,
  CoffeeDrinkConfig,
  CreateCoffeeOrderDto,
  CoffeeSugar,
  COFFEE_DRINKS,
  COFFEE_MILKS,
  COFFEE_SUGARS,
  MAX_PUMPS,
  drinkSummary,
  defaultDrinkConfig,
} from '@/types/coffee-order';
import './coffee-order.css';

// datetime-local default: tomorrow 09:00 local.
function defaultScheduledValue(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  const pad = (n: number) => n.toString().padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}

function formatWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function CoffeeOrderPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  // Middleware already gates, but this covers soft-nav edge cases — same shape
  // as family-tree/page.tsx and spa/page.tsx.
  useEffect(() => {
    if (status === 'loading') return;
    if (!session?.user) {
      router.replace('/login?from=/coffee-order');
      return;
    }
    if (!hasPermission(session, 'coffee-order')) {
      router.replace('/');
    }
  }, [session, status, router]);

  // ---- form state ----
  const [config, setConfig] = useState<CoffeeDrinkConfig>(defaultDrinkConfig);
  const [deliveryNow, setDeliveryNow] = useState(true);
  const [scheduledAt, setScheduledAt] = useState<string>(defaultScheduledValue());

  // ---- data ----
  const [orders, setOrders] = useState<CoffeeOrder[]>([]);
  const [favorites, setFavorites] = useState<CoffeeFavorite[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [placed, setPlaced] = useState<CoffeeOrder | null>(null);

  const canRead =
    status === 'authenticated' && hasPermission(session, 'coffee-order');

  useEffect(() => {
    if (!canRead) return;
    let cancelled = false;
    Promise.all([
      fetch('/api/coffee-order/orders').then((r) =>
        r.ok ? r.json() : Promise.reject(r)
      ),
      fetch('/api/coffee-order/favorites').then((r) =>
        r.ok ? r.json() : Promise.reject(r)
      ),
    ])
      .then(([o, f]: [CoffeeOrder[], CoffeeFavorite[]]) => {
        if (cancelled) return;
        setOrders(o);
        setFavorites(f);
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) setError('Could not load your orders.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [canRead]);

  function setField<K extends keyof CoffeeDrinkConfig>(
    key: K,
    value: CoffeeDrinkConfig[K]
  ) {
    setConfig((prev) => ({ ...prev, [key]: value }));
  }

  function adjustPump(key: 'vanillaPumps' | 'caramelPumps', delta: number) {
    setConfig((prev) => {
      const next = Math.min(MAX_PUMPS, Math.max(0, prev[key] + delta));
      return { ...prev, [key]: next };
    });
  }

  async function placeOrder(dto: CreateCoffeeOrderDto) {
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/coffee-order/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dto),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Request failed (${res.status})`);
      }
      const created = (await res.json()) as CoffeeOrder;
      setOrders((prev) => [created, ...prev]);
      setPlaced(created);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to place order.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    placeOrder({
      ...config,
      deliveryType: deliveryNow ? 'now' : 'scheduled',
      ...(deliveryNow ? {} : { scheduledAt: new Date(scheduledAt).toISOString() }),
    });
  }

  async function saveFavorite() {
    const name = window.prompt('Name this favorite (e.g. "Morning"):');
    if (!name || !name.trim()) return;
    setError(null);
    try {
      const res = await fetch('/api/coffee-order/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...config, name: name.trim() }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Request failed (${res.status})`);
      }
      const created = (await res.json()) as CoffeeFavorite;
      setFavorites((prev) => [created, ...prev]);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to save favorite.');
    }
  }

  function configFromFavorite(f: CoffeeFavorite): CoffeeDrinkConfig {
    return {
      drink: f.drink,
      milk: f.milk,
      sugar: f.sugar,
      vanillaPumps: f.vanillaPumps,
      caramelPumps: f.caramelPumps,
      notes: f.notes,
    };
  }

  function loadFavorite(f: CoffeeFavorite) {
    setConfig(configFromFavorite(f));
    setPlaced(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function orderFavoriteNow(f: CoffeeFavorite) {
    placeOrder({ ...configFromFavorite(f), deliveryType: 'now' });
  }

  async function deleteFavorite(id: string) {
    try {
      const res = await fetch(`/api/coffee-order/favorites/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      setFavorites((prev) => prev.filter((f) => f.id !== id));
    } catch (err) {
      console.error(err);
      setError('Failed to delete favorite.');
    }
  }

  async function deleteOrder(id: string) {
    try {
      const res = await fetch(`/api/coffee-order/orders/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) throw new Error(`Failed (${res.status})`);
      setOrders((prev) => prev.filter((o) => o.id !== id));
      if (placed?.id === id) setPlaced(null);
    } catch (err) {
      console.error(err);
      setError('Failed to cancel order.');
    }
  }

  const sortedOrders = useMemo(
    () =>
      [...orders].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
    [orders]
  );

  // Blank wrapper while loading / before the redirect for a no-permission user.
  if (
    status === 'loading' ||
    !session?.user ||
    !hasPermission(session, 'coffee-order')
  ) {
    return <div className="coffee-page-blank" />;
  }

  return (
    <div>
      <Navbar />
      <div className="coffee-page">
        <div className="coffee-container">
          <header className="coffee-hero">
            <p className="coffee-hero-overline">— freshly brewed —</p>
            <h1 className="coffee-hero-title">☕ Coffee Order</h1>
          </header>

          <div className="coffee-grid">
            {/* ---- order form ---- */}
            <form className="coffee-card coffee-form-card" onSubmit={handleSubmit}>
              <h2 className="coffee-section-title">Your drink</h2>

              <div className="coffee-field">
                <label id="coffee-type-label">Type</label>
                <div className="coffee-segmented" role="group" aria-labelledby="coffee-type-label">
                  {COFFEE_DRINKS.map((d) => (
                    <button
                      type="button"
                      key={d.id}
                      className={`coffee-seg-btn ${config.drink === d.id ? 'active' : ''}`}
                      onClick={() => setField('drink', d.id)}
                      aria-pressed={config.drink === d.id}
                    >
                      {d.emoji && <span className="emoji">{d.emoji}</span>}
                      <span>{d.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="coffee-field">
                <label id="coffee-milk-label">Milk</label>
                <div className="coffee-segmented" role="group" aria-labelledby="coffee-milk-label">
                  {COFFEE_MILKS.map((m) => (
                    <button
                      type="button"
                      key={m.id}
                      className={`coffee-seg-btn ${config.milk === m.id ? 'active' : ''}`}
                      onClick={() => setField('milk', m.id)}
                      aria-pressed={config.milk === m.id}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="coffee-row">
                <div className="coffee-field">
                  <label htmlFor="coffee-sugar">Sugar</label>
                  <select
                    id="coffee-sugar"
                    value={config.sugar}
                    onChange={(e) =>
                      setField('sugar', e.target.value as CoffeeSugar)
                    }
                  >
                    {COFFEE_SUGARS.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="coffee-row">
                <div className="coffee-field">
                  <label id="coffee-vanilla-label">Vanilla pumps</label>
                  <div className="coffee-stepper" role="group" aria-labelledby="coffee-vanilla-label">
                    <button
                      type="button"
                      onClick={() => adjustPump('vanillaPumps', -1)}
                      aria-label="Less vanilla"
                    >
                      −
                    </button>
                    <span>{config.vanillaPumps}</span>
                    <button
                      type="button"
                      onClick={() => adjustPump('vanillaPumps', 1)}
                      aria-label="More vanilla"
                    >
                      +
                    </button>
                  </div>
                </div>
                <div className="coffee-field">
                  <label id="coffee-caramel-label">Caramel pumps</label>
                  <div className="coffee-stepper" role="group" aria-labelledby="coffee-caramel-label">
                    <button
                      type="button"
                      onClick={() => adjustPump('caramelPumps', -1)}
                      aria-label="Less caramel"
                    >
                      −
                    </button>
                    <span>{config.caramelPumps}</span>
                    <button
                      type="button"
                      onClick={() => adjustPump('caramelPumps', 1)}
                      aria-label="More caramel"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

              <div className="coffee-field">
                <label htmlFor="coffee-notes">Notes</label>
                <textarea
                  id="coffee-notes"
                  value={config.notes}
                  onChange={(e) => setField('notes', e.target.value)}
                  placeholder="Extra hot, oat foam, …"
                  rows={2}
                  maxLength={500}
                />
              </div>

              <h2 className="coffee-section-title">When</h2>
              <div className="coffee-segmented coffee-when">
                <button
                  type="button"
                  className={`coffee-seg-btn ${deliveryNow ? 'active' : ''}`}
                  onClick={() => setDeliveryNow(true)}
                  aria-pressed={deliveryNow}
                >
                  Now
                </button>
                <button
                  type="button"
                  className={`coffee-seg-btn ${!deliveryNow ? 'active' : ''}`}
                  onClick={() => setDeliveryNow(false)}
                  aria-pressed={!deliveryNow}
                >
                  Later
                </button>
              </div>
              {!deliveryNow && (
                <div className="coffee-field">
                  <label htmlFor="coffee-when">Scheduled time</label>
                  <input
                    id="coffee-when"
                    type="datetime-local"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    required
                  />
                </div>
              )}

              {error && <div className="coffee-error">{error}</div>}

              <div className="coffee-form-actions">
                <button
                  type="button"
                  className="coffee-btn-secondary"
                  onClick={saveFavorite}
                >
                  ★ Save as favorite
                </button>
                <button
                  type="submit"
                  className="coffee-btn-primary"
                  disabled={submitting}
                >
                  {submitting ? 'Sending…' : 'Order'}
                </button>
              </div>

              {placed && (
                <div className="coffee-result">
                  <h3>Order placed ☕</h3>
                  <p>
                    {drinkSummary(placed)}
                    {' · '}
                    {placed.deliveryType === 'scheduled' && placed.scheduledAt
                      ? formatWhen(placed.scheduledAt)
                      : 'now'}
                  </p>
                </div>
              )}
            </form>

            {/* ---- favorites + history ---- */}
            <aside className="coffee-side">
              <div className="coffee-card">
                <h2 className="coffee-section-title">★ Favorites</h2>
                {loading ? (
                  <p className="coffee-empty">Loading…</p>
                ) : favorites.length === 0 ? (
                  <p className="coffee-empty">
                    No favorites yet — build a drink and tap “Save as favorite”.
                  </p>
                ) : (
                  <div className="coffee-fav-list">
                    {favorites.map((f) => (
                      <article key={f.id} className="coffee-fav-card">
                        <button
                          type="button"
                          className="coffee-fav-body"
                          onClick={() => loadFavorite(f)}
                          title="Load into form"
                        >
                          <span className="coffee-fav-name">{f.name}</span>
                          <span className="coffee-fav-summary">
                            {drinkSummary(f)}
                          </span>
                        </button>
                        <div className="coffee-fav-actions">
                          <button
                            type="button"
                            className="coffee-quick-btn"
                            onClick={() => orderFavoriteNow(f)}
                            disabled={submitting}
                          >
                            ⚡ Order now
                          </button>
                          <button
                            type="button"
                            className="coffee-delete"
                            onClick={() => deleteFavorite(f.id)}
                            aria-label="Delete favorite"
                          >
                            ✕
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </div>

              <div className="coffee-card">
                <h2 className="coffee-section-title">Recent orders</h2>
                {loading ? (
                  <p className="coffee-empty">Loading…</p>
                ) : sortedOrders.length === 0 ? (
                  <p className="coffee-empty">No orders yet.</p>
                ) : (
                  <div className="coffee-order-list">
                    {sortedOrders.map((o) => (
                      <article key={o.id} className="coffee-order-card">
                        <div className="coffee-order-main">
                          <span className="coffee-order-summary">
                            {drinkSummary(o)}
                          </span>
                          <span className="coffee-order-when">
                            {o.deliveryType === 'scheduled' && o.scheduledAt
                              ? `⏰ ${formatWhen(o.scheduledAt)}`
                              : `now · ${formatWhen(o.createdAt)}`}
                          </span>
                          {o.notes && (
                            <span className="coffee-order-notes">“{o.notes}”</span>
                          )}
                        </div>
                        <button
                          type="button"
                          className="coffee-delete"
                          onClick={() => deleteOrder(o.id)}
                          aria-label="Cancel order"
                        >
                          ✕
                        </button>
                      </article>
                    ))}
                  </div>
                )}
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
