import React, { useId } from 'react';
import { MEASURES, type MeasureId } from '@/lib/laundry';

// Drawings of the actual measures on the shelf, so "פקק ורוד – 80 מ״ל" and
// "פקק קטן" are recognisable at a glance.
export default function MeasureIcon({ measure, size = 44 }: { measure: MeasureId; size?: number }) {
  const ml = MEASURES[measure].ml;
  const clipId = `ld-cup-${useId().replace(/[^\w-]/g, '')}`;
  if (ml) {
    // Pink measuring cup filled to the 80 / 120 ml line.
    const level = ml >= 120 ? 14 : 24;
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
        <path d="M9 8h30l-4 34a3 3 0 0 1-3 2.6H16A3 3 0 0 1 13 42z" fill="#ffd6e8" stroke="#e0418a" strokeWidth="2.2" strokeLinejoin="round" />
        <clipPath id={clipId}>
          <path d="M9 8h30l-4 34a3 3 0 0 1-3 2.6H16A3 3 0 0 1 13 42z" />
        </clipPath>
        <rect x="0" y={level} width="48" height="48" fill="#ff5fa2" opacity="0.85" clipPath={`url(#${clipId})`} />
        <line x1="31" y1={level} x2="37" y2={level} stroke="#fff" strokeWidth="2" />
        <text x="23" y="38" textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff">{ml}</text>
      </svg>
    );
  }
  if (measure === 'small-cap') {
    return (
      <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
        <rect x="12" y="20" width="24" height="16" rx="3" fill="#eef1f6" stroke="#5b6478" strokeWidth="2.2" />
        <path d="M17 22v12M22 22v12M27 22v12M32 22v12" stroke="#9aa3b5" strokeWidth="1.5" />
        <rect x="10" y="17" width="28" height="5" rx="2" fill="#dfe4ee" stroke="#5b6478" strokeWidth="2" />
      </svg>
    );
  }
  // Half a clear cup of scent beads.
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <path d="M10 7h28l-3 35a3 3 0 0 1-3 2.6H16A3 3 0 0 1 13 42z" fill="#f2f8ff" stroke="#7e8ca6" strokeWidth="2.2" strokeLinejoin="round" />
      <line x1="11.6" y1="26" x2="36.4" y2="26" stroke="#7e8ca6" strokeWidth="1.5" strokeDasharray="2 2" />
      {[
        [17, 31], [23, 30], [29, 31], [20, 36], [26, 36], [32, 35], [17, 41], [23, 41], [29, 40],
      ].map(([cx, cy]) => (
        <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r="2.6" fill="#b48ef0" />
      ))}
    </svg>
  );
}
