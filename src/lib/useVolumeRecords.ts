'use client';

import { useEffect, useState } from 'react';
import type { VolumeRecordsResponse } from '@/lib/workout-records';

// Fetch the shared-workout volume records (see /api/workout/feed/records).
// `refreshKey` re-fetches (e.g. after unsharing a post). Failures leave the
// records null, which every consumer renders as "nothing to show".
export function useVolumeRecords(enabled: boolean, refreshKey = 0): VolumeRecordsResponse | null {
  const [records, setRecords] = useState<VolumeRecordsResponse | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    fetch('/api/workout/feed/records')
      .then((res) => (res.ok ? res.json() : null))
      .then((data: VolumeRecordsResponse | null) => {
        if (!cancelled && data) setRecords(data);
      })
      .catch((error) => console.error('Error loading volume records:', error));
    return () => {
      cancelled = true;
    };
  }, [enabled, refreshKey]);
  return records;
}
