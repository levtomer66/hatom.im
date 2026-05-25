'use client';

import React, { useEffect, useRef } from 'react';
import type * as LeafletNS from 'leaflet';
import type { CoffeeReview } from '@/types/coffee';

const TILE_URL = 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png';
const TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> · &copy; <a href="https://carto.com/attributions">CARTO</a>';

function averageScore(r: CoffeeReview): number {
  const all = [
    r.tomCoffeeRating, r.tomFoodRating, r.tomAtmosphereRating, r.tomPriceRating,
    r.tomerCoffeeRating, r.tomerFoodRating, r.tomerAtmosphereRating, r.tomerPriceRating,
  ].filter((v): v is number => typeof v === 'number' && v > 0);
  if (!all.length) return 0;
  return all.reduce((a, b) => a + b, 0) / all.length;
}

interface Props {
  reviews: CoffeeReview[];
}

export default function CoffeeReviewMap({ reviews }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletNS.Map | null>(null);

  // Filter pinnable reviews once per render.
  const pins = reviews.filter(
    (r) => typeof r.latitude === 'number' && typeof r.longitude === 'number',
  );

  useEffect(() => {
    if (!containerRef.current) return;
    if (typeof window === 'undefined') return;

    let cancelled = false;
    let layer: LeafletNS.LayerGroup | null = null;

    (async () => {
      const L = (await import('leaflet')).default;
      if (cancelled || !containerRef.current) return;
      // Leaflet's CSS isn't bundled when we npm-import the library, so
      // inject it once via a stylesheet link. Sourced from unpkg (already
      // on the CSP allowlist) so we don't ship the file ourselves.
      if (!document.getElementById('leaflet-css')) {
        const link = document.createElement('link');
        link.id = 'leaflet-css';
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }

      if (!mapRef.current) {
        // Default centre = Tel Aviv since the reviewer base is there. Auto-
        // fit-bounds below corrects this whenever we have at least one pin.
        const map = L.map(containerRef.current, {
          center: [32.0853, 34.7818],
          zoom: 12,
          scrollWheelZoom: false,  // avoid hijacking page scroll
          attributionControl: true,
        });
        L.tileLayer(TILE_URL, {
          attribution: TILE_ATTRIBUTION,
          maxZoom: 19,
          subdomains: 'abcd',
        }).addTo(map);
        mapRef.current = map;
      }

      const map = mapRef.current!;
      layer = L.layerGroup().addTo(map);

      const latlngs: LeafletNS.LatLngTuple[] = [];
      for (const r of pins) {
        const avg = averageScore(r);
        const score = avg > 0 ? avg.toFixed(1) : '—';
        const icon = L.divIcon({
          className: 'coffee-pin',
          html: `<span class="coffee-pin-emoji">☕</span><span class="coffee-pin-score">${score}</span>`,
          iconSize: [44, 44],
          iconAnchor: [22, 40],
          popupAnchor: [0, -36],
        });
        const marker = L.marker([r.latitude!, r.longitude!], { icon }).addTo(layer!);
        const popupHtml = `
          <div class="coffee-pin-popup">
            <div class="coffee-pin-popup-name">${escapeHtml(r.placeName)}</div>
            ${r.locationLabel ? `<div class="coffee-pin-popup-loc">${escapeHtml(r.locationLabel)}</div>` : ''}
            <div class="coffee-pin-popup-score">${score} <span>/ 10</span></div>
            ${r.mapsUrl ? `<a class="coffee-pin-popup-link" href="${escapeAttr(r.mapsUrl)}" target="_blank" rel="noopener noreferrer">פתח ב‑Maps ↗</a>` : ''}
          </div>
        `;
        marker.bindPopup(popupHtml, { maxWidth: 240 });
        latlngs.push([r.latitude!, r.longitude!]);
      }

      if (latlngs.length === 1) {
        map.setView(latlngs[0], 14);
      } else if (latlngs.length > 1) {
        map.fitBounds(L.latLngBounds(latlngs), { padding: [32, 32], maxZoom: 14 });
      }
    })();

    return () => {
      cancelled = true;
      if (layer) layer.remove();
    };
    // We intentionally use a JSON shape of `pins` as the dep so we re-pin
    // only when the actual review set/locations change, not on every
    // referentially-new array.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(pins.map((p) => [p.id, p.latitude, p.longitude]))]);

  // Tear the map fully down on unmount so a route change doesn't leak
  // the Leaflet container/listeners.
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  if (pins.length === 0) return null;

  return (
    <div className="coffee-map-frame">
      <div ref={containerRef} className="coffee-map-canvas" />
      <p className="coffee-map-hint">
        {pins.length} / {reviews.length} ביקורות מסומנות על המפה
      </p>
    </div>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) =>
    c === '&' ? '&amp;' :
    c === '<' ? '&lt;' :
    c === '>' ? '&gt;' :
    c === '"' ? '&quot;' : '&#39;',
  );
}

function escapeAttr(s: string): string {
  return escapeHtml(s);
}
