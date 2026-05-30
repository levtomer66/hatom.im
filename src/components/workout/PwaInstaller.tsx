'use client';

import React, { useEffect, useState } from 'react';

// Registers /workout-sw.js the first time anything under /workout
// renders, then listens for online/offline transitions so we can ask
// the SW to drain its queue and surface a small indicator while we're
// disconnected. Renders the indicator element itself — keeps the
// workout layout untouched apart from one mount point.
export default function PwaInstaller() {
  const [online, setOnline] = useState(true);
  const [queuedCount, setQueuedCount] = useState(0);
  const [justSyncedAt, setJustSyncedAt] = useState<number | null>(null);

  useEffect(() => {
    if (typeof navigator === 'undefined') return;
    setOnline(navigator.onLine);

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/workout-sw.js', { scope: '/' })
        .catch((err) => console.error('workout SW register failed', err));
    }

    const onOnline = () => {
      setOnline(true);
      navigator.serviceWorker?.controller?.postMessage('flush-outbox');
    };
    const onOffline = () => setOnline(false);
    const onMessage = (e: MessageEvent) => {
      const data = e.data;
      if (!data || typeof data !== 'object') return;
      if (data.type === 'outbox-queued') {
        setQueuedCount((n) => n + 1);
      } else if (data.type === 'outbox-flushed') {
        setQueuedCount(0);
        setJustSyncedAt(Date.now());
      } else if (data.type === 'outbox-dropped') {
        setQueuedCount((n) => Math.max(0, n - 1));
      }
    };

    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    navigator.serviceWorker?.addEventListener('message', onMessage);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      navigator.serviceWorker?.removeEventListener('message', onMessage);
    };
  }, []);

  // Hide the "synced" toast after 3 s.
  useEffect(() => {
    if (justSyncedAt === null) return;
    const t = setTimeout(() => setJustSyncedAt(null), 3000);
    return () => clearTimeout(t);
  }, [justSyncedAt]);

  if (online && queuedCount === 0 && justSyncedAt === null) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        insetInlineEnd: 12,
        bottom: 84,
        zIndex: 90,
        padding: '8px 12px',
        borderRadius: 999,
        fontSize: '0.85rem',
        fontWeight: 600,
        boxShadow: '0 4px 14px rgba(0, 0, 0, 0.35)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        background: !online
          ? 'rgba(180, 60, 60, 0.92)'
          : queuedCount > 0
            ? 'rgba(201, 168, 76, 0.92)'
            : 'rgba(60, 140, 80, 0.92)',
        color: '#fff',
        pointerEvents: 'none',
        transition: 'background 0.25s ease',
      }}
    >
      {!online
        ? `⚠️ אופליין${queuedCount > 0 ? ` · ${queuedCount} בתור` : ''}`
        : queuedCount > 0
          ? `↻ מסנכרן ${queuedCount}…`
          : '✓ סונכרן'}
    </div>
  );
}
