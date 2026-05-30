'use client';

import React, { useState } from 'react';

interface ExercisePhotoProps {
  src?: string;
  className?: string;
  style?: React.CSSProperties;
  // Visual fallback when the photo is missing OR the URL fails to load.
  // Defaults to the lifter emoji used elsewhere across the workout app.
  fallback?: React.ReactNode;
  alt?: string;
}

// Resilient exercise photo:
//  - When `src` is absent, renders the emoji fallback.
//  - When `src` is present, renders an `<img>` that swaps to the fallback
//    on load error — earlier we used CSS background-image, which fails
//    silently on a 404 (the empty container shows the bg color and the
//    fallback text never appears). Pexels image withdrawals in the
//    exercise library caused empty grey squares on a handful of
//    exercises; this component swaps to the emoji instead. (M-2)
//
// The component itself is presentation-only: the parent's class
// controls size, border-radius, etc. We layer the fallback under an
// absolutely-positioned <img> so the fallback is what shows through
// when the img doesn't paint (broken URL).
export default function ExercisePhoto({
  src,
  className,
  style,
  fallback = '🏋️',
  alt = '',
}: ExercisePhotoProps) {
  const [errored, setErrored] = useState(false);
  const showImg = !!src && !errored;

  return (
    <div
      className={className}
      style={{
        position: 'relative',
        backgroundColor: 'var(--workout-bg-secondary)',
        backgroundImage: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        ...style,
      }}
    >
      <span
        aria-hidden={showImg ? 'true' : undefined}
        style={{
          // Sits at the bottom layer. Visible when no img, hidden behind
          // the img once it paints successfully.
          position: 'absolute',
          inset: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}
      >
        {fallback}
      </span>
      {showImg && (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={src}
          alt={alt}
          onError={() => setErrored(true)}
          style={{
            position: 'relative',
            zIndex: 1,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      )}
    </div>
  );
}
