'use client';

import React from 'react';
import { FaYoutube, FaInstagram } from 'react-icons/fa';
import { youtubeSearchUrl, instagramSearchUrl } from '@/lib/exercise-links';

interface ExerciseExternalLinksProps {
  // Always pass the canonical ENGLISH name — YouTube / Instagram fitness
  // content is mostly English-tagged and returns the richest results.
  englishName: string;
  size?: number;
}

// Two small brand-coloured icon links that open a YouTube search and an
// Instagram search for the given exercise name in a new tab. Used on the
// exercise card (expanded view) and the exercise detail page.
export default function ExerciseExternalLinks({ englishName, size = 18 }: ExerciseExternalLinksProps) {
  // Prevent the card's own onClick from firing when the user taps an icon.
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  const linkStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: size + 10,
    height: size + 10,
    borderRadius: '6px',
    backgroundColor: 'var(--workout-bg-secondary)',
    transition: 'background-color 0.15s',
  };

  return (
    <div
      className="exercise-external-links"
      onClick={stop}
      style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}
    >
      <a
        href={youtubeSearchUrl(englishName)}
        target="_blank"
        rel="noopener noreferrer"
        title={`YouTube — ${englishName}`}
        aria-label={`Search YouTube for ${englishName}`}
        style={linkStyle}
      >
        <FaYoutube size={size} style={{ color: '#ff0000' }} />
      </a>
      <a
        href={instagramSearchUrl(englishName)}
        target="_blank"
        rel="noopener noreferrer"
        title={`Instagram — ${englishName}`}
        aria-label={`Search Instagram for ${englishName}`}
        style={linkStyle}
      >
        <FaInstagram size={size} style={{ color: '#E1306C' }} />
      </a>
    </div>
  );
}
