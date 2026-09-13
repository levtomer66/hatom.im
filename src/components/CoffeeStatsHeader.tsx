'use client';

import React from 'react';
import { noaShalev } from '@/lib/noaShalev';
import { CoffeeReview, computeStats } from '@/types/coffee';

const playfair = noaShalev;
const courier = noaShalev;

interface CoffeeStatsHeaderProps {
  // Always the full unfiltered list — the leaderboard shouldn't change just
  // because someone typed into the search box.
  reviews: CoffeeReview[];
}

interface Tile {
  key: string;
  emoji: string;
  title: string;
  value: string;
  sub?: string;
}

// Six tiles built from computeStats(). Each stat is optional (a fresh journal
// has no cheapest/most-controversial/etc.), so a tile is only pushed when its
// datum exists — the row simply has fewer tiles rather than showing a blank.
const CoffeeStatsHeader: React.FC<CoffeeStatsHeaderProps> = ({ reviews }) => {
  const stats = computeStats(reviews);
  const tiles: Tile[] = [];

  tiles.push({
    key: 'count',
    emoji: '🏙️',
    title: 'סה"כ בתי קפה',
    value: String(stats.count),
  });

  if (stats.kingOfCoffee) {
    tiles.push({
      key: 'king',
      emoji: '☕',
      title: 'מלך הקפה',
      value: stats.kingOfCoffee.name,
      sub: stats.kingOfCoffee.score.toFixed(1),
    });
  }

  if (stats.bestValue) {
    tiles.push({
      key: 'value',
      emoji: '💰',
      title: 'הכי משתלם',
      value: stats.bestValue.name,
      sub: stats.bestValue.score.toFixed(1),
    });
  }

  if (stats.cheapest) {
    tiles.push({
      key: 'cheapest',
      emoji: '🪙',
      title: 'הכי זול',
      value: stats.cheapest.name,
      sub: `₪${stats.cheapest.price}`,
    });
  }

  if (stats.mostControversial) {
    tiles.push({
      key: 'controversial',
      emoji: '🔥',
      title: 'הכי שנוי במחלוקת',
      value: stats.mostControversial.name,
      sub: `פער ${stats.mostControversial.gap.toFixed(1)}`,
    });
  }

  if (typeof stats.avgPrice === 'number') {
    tiles.push({
      key: 'avgPrice',
      emoji: '📊',
      title: 'מחיר ממוצע',
      value: `₪${stats.avgPrice}`,
    });
  }

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '14px',
        justifyContent: 'center',
        marginBottom: '36px',
        direction: 'rtl',
      }}
    >
      {tiles.map((t) => (
        <div
          key={t.key}
          style={{
            background: 'linear-gradient(160deg, #fdf6e3, #f5e8c8)',
            border: '1px solid #c4a870',
            boxShadow: '2px 3px 10px rgba(100,60,10,0.1), 0 1px 3px rgba(100,60,10,0.06)',
            padding: '14px 18px',
            flex: '1 1 150px',
            minWidth: '140px',
            maxWidth: '220px',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '1.4rem', marginBottom: '4px', lineHeight: 1 }}>{t.emoji}</div>
          <div
            className={courier.className}
            style={{
              fontSize: '9px',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: '#a08040',
              marginBottom: '6px',
            }}
          >
            {t.title}
          </div>
          <div
            className={playfair.className}
            style={{
              fontSize: '1.05rem',
              fontWeight: 700,
              color: '#2a1a06',
              lineHeight: 1.25,
              overflowWrap: 'anywhere',
            }}
          >
            {t.value}
          </div>
          {t.sub && (
            <div className={courier.className} style={{ fontSize: '11px', color: '#8a6020', marginTop: '3px' }}>
              {t.sub}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default CoffeeStatsHeader;
