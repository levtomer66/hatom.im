'use client';

// Where the page prices: a place set by hand (address search, remembered on
// this device until "המיקום שלי"), else the device's live location (read on
// load and on ↻, sent only to our own API, never stored), and the radius
// chip, remembered on this device. Without either the server uses the
// household's home spot (docs/superpowers/specs/2026-11-18-shopping-no-cities-design.md).
import { useCallback, useEffect, useMemo, useState } from 'react';
import { DEFAULT_RADIUS_KM, distanceM, parseCentre, parseRadius, type Centre } from '@/lib/shopping/near';
import type { Place } from '@/lib/shopping/geocode';

export type LocState = 'idle' | 'locating' | 'found' | 'denied' | 'unavailable';

const LS_RADIUS = 'shopping:radius';
const LS_PLACE = 'shopping:place';

function readPlace(): Place | null {
  try {
    const p = JSON.parse(localStorage.getItem(LS_PLACE) ?? 'null') as Place | null;
    const c = p && typeof p.label === 'string' ? parseCentre(p.lat, p.lng) : null;
    return c && typeof c === 'object' ? { label: p!.label, ...c } : null;
  } catch {
    return null;
  }
}
/** A new fix closer than this to the last one is GPS jitter: keep the old one (no refetch). */
const MOVED_M = 150;

const round4 = (x: number) => Math.round(x * 1e4) / 1e4;

/** One location read; rejects with 'denied' or 'unavailable'. */
export function readLocation(): Promise<Centre> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return reject(new Error('unavailable'));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: round4(p.coords.latitude), lng: round4(p.coords.longitude) }),
      (err) => reject(new Error(err.code === err.PERMISSION_DENIED ? 'denied' : 'unavailable')),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60 * 1000 },
    );
  });
}

/** The query string the pricing routes take: lat, lng (when known) and r. */
export function nearQuery(live: Centre | null, radiusKm: number): string {
  return live ? `lat=${live.lat}&lng=${live.lng}&r=${radiusKm}` : `r=${radiusKm}`;
}

export function useWhere() {
  const [live, setLive] = useState<Centre | null>(null);
  const [loc, setLoc] = useState<LocState>('idle');
  const [radius, setRadiusState] = useState<number>(DEFAULT_RADIUS_KM);
  /** A place set by hand; while set, it is the centre and GPS is not read. */
  const [place, setPlaceState] = useState<Place | null>(null);

  const locate = useCallback(() => {
    setLoc('locating');
    readLocation()
      .then((p) => {
        setLive((prev) => (prev && distanceM(prev, p) < MOVED_M ? prev : p));
        setLoc('found');
      })
      .catch((e: Error) => setLoc(e.message === 'denied' ? 'denied' : 'unavailable'));
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(LS_RADIUS);
      if (saved) setRadiusState(parseRadius(saved));
    } catch { /* private mode */ }
    const p = readPlace();
    if (p) setPlaceState(p);
    else locate();
  }, [locate]);

  /** Use a place by hand (null: back to the device's location, read now). */
  const setPlace = useCallback((p: Place | null) => {
    setPlaceState(p);
    try {
      if (p) localStorage.setItem(LS_PLACE, JSON.stringify(p));
      else localStorage.removeItem(LS_PLACE);
    } catch { /* private mode */ }
    if (!p) locate();
  }, [locate]);

  const setRadius = useCallback((r: number) => {
    setRadiusState(r);
    try { localStorage.setItem(LS_RADIUS, String(r)); } catch { /* private mode */ }
  }, []);

  /** The point sent to the API: the place set by hand, else the live location (null: the server uses the home spot). */
  const centre = useMemo<Centre | null>(() => (place ? { lat: place.lat, lng: place.lng } : live), [place, live]);
  const query = useMemo(() => nearQuery(centre, radius), [centre, radius]);
  return { live, loc, radius, setRadius, locate, query, place, setPlace, centre };
}
