'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Share_Tech_Mono, Rajdhani } from 'next/font/google';
import { CoffeeReview } from '@/types/coffee';
import EditCoffeeReviewForm from './EditCoffeeReviewForm';

const shareTech = Share_Tech_Mono({ subsets: ['latin'], weight: ['400'] });
const rajdhani = Rajdhani({ subsets: ['latin'], weight: ['400', '500', '600', '700'] });

interface CoffeeReviewCardProps {
  review: CoffeeReview;
  onDelete: (id: string) => Promise<void>;
  onUpdate: () => void;
  rank?: number;
}

const nonZeroAvg = (vals: number[]) => {
  const rated = vals.filter(v => v > 0);
  return rated.length ? rated.reduce((a, b) => a + b, 0) / rated.length : 0;
};

// Segmented LED-style bar
const LedBar = ({ value, label, color = '#00e5ff' }: { value: number; label: string; color?: string }) => {
  const segments = 10;
  const filled = Math.round(value);
  return (
    <div style={{ marginBottom: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
        <span className={shareTech.className} style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.12em' }}>{label}</span>
        <span className={shareTech.className} style={{ fontSize: '11px', color: value > 0 ? color : 'rgba(255,255,255,0.15)' }}>
          {value > 0 ? value.toFixed(1) : '—'}
        </span>
      </div>
      <div style={{ display: 'flex', gap: '2px' }}>
        {Array.from({ length: segments }, (_, i) => {
          const active = i < filled;
          const isHigh = i >= 8;
          const isMid = i >= 6 && i < 8;
          const segColor = active ? (isHigh ? '#39ff14' : isMid ? '#ffea00' : color) : 'rgba(255,255,255,0.06)';
          return (
            <div key={i} style={{
              flex: 1, height: '5px',
              background: segColor,
              boxShadow: active ? `0 0 6px ${segColor}` : 'none',
              transition: 'background 0.3s, box-shadow 0.3s',
            }} />
          );
        })}
      </div>
    </div>
  );
};

const CoffeeReviewCard: React.FC<CoffeeReviewCardProps> = ({ review, onDelete, onUpdate, rank }) => {
  const [imageError, setImageError] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'tom' | 'tomer'>('overview');
  const [hovered, setHovered] = useState(false);

  const tomAvg = nonZeroAvg([review.tomCoffeeRating ?? 0, review.tomFoodRating ?? 0, review.tomAtmosphereRating ?? 0, review.tomPriceRating ?? 0]);
  const tomerAvg = nonZeroAvg([review.tomerCoffeeRating ?? 0, review.tomerFoodRating ?? 0, review.tomerAtmosphereRating ?? 0, review.tomerPriceRating ?? 0]);
  const combinedAvg = nonZeroAvg([tomAvg, tomerAvg].filter(v => v > 0));

  const avgCategory = (a: number, b: number) => nonZeroAvg([a, b].filter(v => v > 0));
  const overviewBars = [
    { value: avgCategory(review.tomCoffeeRating ?? 0, review.tomerCoffeeRating ?? 0), label: 'COFFEE' },
    { value: avgCategory(review.tomFoodRating ?? 0, review.tomerFoodRating ?? 0), label: 'FOOD' },
    { value: avgCategory(review.tomAtmosphereRating ?? 0, review.tomerAtmosphereRating ?? 0), label: 'VIBES' },
    { value: avgCategory(review.tomPriceRating ?? 0, review.tomerPriceRating ?? 0), label: 'PRICE' },
  ];
  const tomBars = [
    { value: review.tomCoffeeRating ?? 0, label: 'COFFEE' },
    { value: review.tomFoodRating ?? 0, label: 'FOOD' },
    { value: review.tomAtmosphereRating ?? 0, label: 'VIBES' },
    { value: review.tomPriceRating ?? 0, label: 'PRICE' },
  ];
  const tomerBars = [
    { value: review.tomerCoffeeRating ?? 0, label: 'COFFEE' },
    { value: review.tomerFoodRating ?? 0, label: 'FOOD' },
    { value: review.tomerAtmosphereRating ?? 0, label: 'VIBES' },
    { value: review.tomerPriceRating ?? 0, label: 'PRICE' },
  ];

  const bars = activeTab === 'overview' ? overviewBars : activeTab === 'tom' ? tomBars : tomerBars;

  // Neon color based on score
  const scoreColor = combinedAvg >= 8.5 ? '#39ff14' : combinedAvg >= 7 ? '#00e5ff' : combinedAvg >= 5 ? '#ffea00' : '#ff6b2b';
  const rankColors: Record<number, string> = { 1: '#ffd700', 2: '#c0c0c0', 3: '#cd7f32' };
  const borderColor = hovered ? (rank && rank <= 3 ? rankColors[rank] : '#00e5ff') : 'rgba(0,229,255,0.2)';

  const handleDelete = async () => {
    if (window.confirm('האם אתה בטוח שברצונך למחוק ביקורת זו?')) {
      setIsDeleting(true);
      try { await onDelete(review.id); } catch { setIsDeleting(false); }
    }
  };

  if (isEditing) {
    return <EditCoffeeReviewForm review={review} onSuccess={() => { setIsEditing(false); onUpdate(); }} onCancel={() => setIsEditing(false)} />;
  }

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'linear-gradient(145deg, rgba(10,14,30,0.95) 0%, rgba(6,8,20,0.98) 100%)',
        border: `1px solid ${borderColor}`,
        boxShadow: hovered
          ? `0 0 20px rgba(0,229,255,0.15), 0 0 40px rgba(0,229,255,0.06), inset 0 0 20px rgba(0,229,255,0.03)`
          : `0 0 8px rgba(0,229,255,0.05)`,
        position: 'relative',
        overflow: 'hidden',
        transition: 'border-color 0.3s, box-shadow 0.3s',
      }}
    >
      {/* Scanline overlay */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1,
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.07) 2px, rgba(0,0,0,0.07) 4px)',
      }} />

      {/* Corner accent lines */}
      <div style={{ position: 'absolute', top: 0, right: 0, width: '40px', height: '1px', background: borderColor, opacity: 0.6 }} />
      <div style={{ position: 'absolute', top: 0, right: 0, width: '1px', height: '40px', background: borderColor, opacity: 0.6 }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, width: '40px', height: '1px', background: borderColor, opacity: 0.6 }} />
      <div style={{ position: 'absolute', bottom: 0, left: 0, width: '1px', height: '40px', background: borderColor, opacity: 0.6 }} />

      {/* Image */}
      <div style={{ height: '160px', background: '#0a0e1e', overflow: 'hidden', position: 'relative' }}>
        {(review.photoUrl || review.photoData) && !imageError ? (
          <Image
            src={review.photoData ? `/api/coffee-reviews/${review.id}/image` : (review.photoUrl || '')}
            alt={review.placeName}
            fill
            style={{ objectFit: 'cover', filter: 'saturate(0.6) brightness(0.7) contrast(1.2)', mixBlendMode: 'luminosity', opacity: hovered ? 0.75 : 0.55, transition: 'opacity 0.4s' }}
            onError={() => setImageError(true)}
            sizes="(max-width: 768px) 100vw, 33vw"
          />
        ) : null}
        {/* Neon gradient overlay on image */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to top, rgba(6,8,20,1) 0%, rgba(6,8,20,0.4) 60%, transparent 100%)',
        }} />

        {/* Rank badge */}
        {rank && (
          <div className={shareTech.className} style={{
            position: 'absolute', top: '10px', right: '10px',
            fontSize: '11px', letterSpacing: '0.15em',
            color: rank <= 3 ? rankColors[rank] : 'rgba(255,255,255,0.3)',
            textShadow: rank <= 3 ? `0 0 12px ${rankColors[rank]}` : 'none',
          }}>
            #{String(rank).padStart(2, '0')}
          </div>
        )}

        {/* Score overlay */}
        {combinedAvg > 0 && (
          <div style={{ position: 'absolute', bottom: '10px', right: '12px' }}>
            <span className={shareTech.className} style={{
              fontSize: '2rem', fontWeight: 700, color: scoreColor,
              textShadow: `0 0 20px ${scoreColor}, 0 0 40px ${scoreColor}66`,
              lineHeight: 1,
            }}>
              {combinedAvg.toFixed(1)}
            </span>
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ padding: '14px 16px 16px', position: 'relative', zIndex: 2, direction: 'rtl' }}>
        {/* Place name */}
        <h3 className={rajdhani.className} style={{
          fontSize: '1.25rem', fontWeight: 700, color: '#e8f0fe',
          margin: '0 0 8px 0', lineHeight: 1.2,
          textShadow: hovered ? '0 0 20px rgba(232,240,254,0.4)' : 'none',
          transition: 'text-shadow 0.3s',
        }}>
          {review.placeName}
        </h3>

        {/* Links */}
        {(review.mapsUrl || review.instagramUrl) && (
          <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
            {review.mapsUrl && (
              <a href={review.mapsUrl} target="_blank" rel="noopener noreferrer" className={shareTech.className}
                style={{ fontSize: '9px', letterSpacing: '0.1em', color: '#00e5ff', border: '1px solid rgba(0,229,255,0.3)', padding: '2px 8px', textDecoration: 'none', background: 'rgba(0,229,255,0.05)' }}>
                ◈ MAPS
              </a>
            )}
            {review.instagramUrl && (
              <a href={review.instagramUrl} target="_blank" rel="noopener noreferrer" className={shareTech.className}
                style={{ fontSize: '9px', letterSpacing: '0.1em', color: '#ff2d78', border: '1px solid rgba(255,45,120,0.3)', padding: '2px 8px', textDecoration: 'none', background: 'rgba(255,45,120,0.05)' }}>
                ◈ IG
              </a>
            )}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0', marginBottom: '12px', borderBottom: '1px solid rgba(0,229,255,0.1)' }}>
          {(['overview', 'tom', 'tomer'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={shareTech.className}
              style={{
                flex: 1, background: 'none', border: 'none', cursor: 'pointer', padding: '6px 0',
                fontSize: '9px', letterSpacing: '0.15em',
                color: activeTab === tab ? '#00e5ff' : 'rgba(255,255,255,0.25)',
                borderBottom: activeTab === tab ? '1px solid #00e5ff' : '1px solid transparent',
                marginBottom: '-1px',
                textShadow: activeTab === tab ? '0 0 10px rgba(0,229,255,0.6)' : 'none',
                transition: 'color 0.2s, text-shadow 0.2s',
              }}
            >
              {tab === 'overview' ? 'OVERVIEW' : tab === 'tom' ? 'TOM' : 'TOMER'}
            </button>
          ))}
        </div>

        {/* LED bars */}
        <div>
          {bars.map(b => <LedBar key={b.label} value={b.value} label={b.label} color="#00e5ff" />)}
        </div>

        {/* Reviewer scores in overview */}
        {activeTab === 'overview' && (
          <div style={{ display: 'flex', gap: '16px', marginTop: '10px', paddingTop: '8px', borderTop: '1px solid rgba(0,229,255,0.08)' }}>
            {[{ name: 'TOM', avg: tomAvg }, { name: 'TOMER', avg: tomerAvg }].map(({ name, avg }) => (
              <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className={shareTech.className} style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.12em' }}>{name}</span>
                <span className={shareTech.className} style={{ fontSize: '13px', color: avg > 0 ? '#ff6b2b' : 'rgba(255,255,255,0.15)', textShadow: avg > 0 ? '0 0 10px rgba(255,107,43,0.5)' : 'none' }}>
                  {avg > 0 ? avg.toFixed(1) : '—'}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '6px', marginTop: '12px', opacity: hovered ? 1 : 0, transition: 'opacity 0.2s' }}>
          <button onClick={() => setIsEditing(true)} className={shareTech.className}
            style={{ background: 'none', border: '1px solid rgba(0,229,255,0.3)', color: 'rgba(0,229,255,0.7)', cursor: 'pointer', padding: '4px 10px', fontSize: '9px', letterSpacing: '0.1em' }}>
            EDIT
          </button>
          <button onClick={handleDelete} disabled={isDeleting} className={shareTech.className}
            style={{ background: 'none', border: '1px solid rgba(255,45,120,0.3)', color: 'rgba(255,45,120,0.7)', cursor: 'pointer', padding: '4px 10px', fontSize: '9px', letterSpacing: '0.1em' }}>
            {isDeleting ? '...' : 'DEL'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default CoffeeReviewCard;
