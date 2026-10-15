import React from 'react';
import { PHOTOS, focusFrame, type StepPhoto } from '@/lib/laundry';

// A label pinned to a point on the photo (fractions of its width / height).
export interface PhotoTag {
  x: number;
  y: number;
  text: string;
  className?: string;
}

const pct = (n: number) => `${n}%`;

// One of the two machine photos, zoomed onto a point, with an optional
// spotlight circle (everything outside it is dimmed) on the thing to touch.
export default function PhotoSpot({
  photo,
  alt,
  aspect = 4 / 3,
  tags = [],
}: {
  photo: StepPhoto;
  alt: string;
  aspect?: number;
  tags?: PhotoTag[];
}) {
  const { src, aspect: photoAspect } = PHOTOS[photo.photo];
  const f = focusFrame(photo.x, photo.y, photo.zoom, photoAspect, aspect);
  const m = photo.marker;
  return (
    <div className="ld-photo" style={{ aspectRatio: aspect }}>
      <div
        className="ld-photo-inner"
        style={{ width: pct(f.width), left: pct(f.left), top: pct(f.top), aspectRatio: photoAspect }}
      >
        {/* Plain <img>: the files are already web-sized, and they sit under the
            gated /laundry prefix where the image optimizer has no session. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} loading="lazy" decoding="async" />
        {m && (
          <span
            className="ld-marker"
            style={{ left: pct(m.x * 100), top: pct(m.y * 100), width: pct(m.r * 200), aspectRatio: m.aspect ?? 1 }}
            aria-hidden
          />
        )}
        {tags.map((t) => (
          <span
            key={t.text}
            className={`ld-tag${t.className ? ` ${t.className}` : ''}`}
            style={{ left: pct(t.x * 100), top: pct(t.y * 100) }}
          >
            {t.text}
          </span>
        ))}
      </div>
    </div>
  );
}
