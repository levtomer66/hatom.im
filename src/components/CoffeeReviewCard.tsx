'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { Cormorant_Garamond, DM_Mono } from 'next/font/google';
import { CoffeeReview } from '@/types/coffee';
import EditCoffeeReviewForm from './EditCoffeeReviewForm';

const cormorant = Cormorant_Garamond({ subsets: ['latin'], weight: ['300', '400', '600', '700'], style: ['normal', 'italic'] });
const dmMono = DM_Mono({ subsets: ['latin'], weight: ['300', '400', '500'] });

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

const RatingBar = ({ value, label }: { value: number; label: string }) => (
  <div style={{ marginBottom: '10px' }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
      <span style={{ fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#7a6e60' }}>{label}</span>
      {value > 0 ? (
        <span className={dmMono.className} style={{ fontSize: '12px', color: '#bf7030' }}>{value.toFixed(1)}</span>
      ) : (
        <span style={{ fontSize: '10px', color: '#3a342c', fontStyle: 'italic' }}>—</span>
      )}
    </div>
    <div style={{ height: '1px', background: '#1e1a15', position: 'relative' }}>
      {value > 0 && (
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0,
          width: `${(value / 10) * 100}%`,
          background: 'linear-gradient(to right, #7a4010, #bf7030)',
          height: '1px',
        }} />
      )}
    </div>
  </div>
);

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
  const overviewRatings = [
    { label: 'קפה', value: avgCategory(review.tomCoffeeRating ?? 0, review.tomerCoffeeRating ?? 0) },
    { label: 'אוכל', value: avgCategory(review.tomFoodRating ?? 0, review.tomerFoodRating ?? 0) },
    { label: 'אווירה', value: avgCategory(review.tomAtmosphereRating ?? 0, review.tomerAtmosphereRating ?? 0) },
    { label: 'מחיר', value: avgCategory(review.tomPriceRating ?? 0, review.tomerPriceRating ?? 0) },
  ];
  const tomRatings = [
    { label: 'קפה', value: review.tomCoffeeRating ?? 0 },
    { label: 'אוכל', value: review.tomFoodRating ?? 0 },
    { label: 'אווירה', value: review.tomAtmosphereRating ?? 0 },
    { label: 'מחיר', value: review.tomPriceRating ?? 0 },
  ];
  const tomerRatings = [
    { label: 'קפה', value: review.tomerCoffeeRating ?? 0 },
    { label: 'אוכל', value: review.tomerFoodRating ?? 0 },
    { label: 'אווירה', value: review.tomerAtmosphereRating ?? 0 },
    { label: 'מחיר', value: review.tomerPriceRating ?? 0 },
  ];

  const ratings = activeTab === 'overview' ? overviewRatings : activeTab === 'tom' ? tomRatings : tomerRatings;

  const medalColors: Record<number, string> = { 1: '#d4a017', 2: '#a8a8b0', 3: '#b07040' };

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
        display: 'flex',
        borderTop: '1px solid #1e1a15',
        padding: '28px 0',
        gap: '0',
        transition: 'background 0.3s',
        background: hovered ? 'rgba(191,112,48,0.04)' : 'transparent',
        position: 'relative',
        direction: 'rtl',
      }}
    >
      {/* Rank */}
      <div style={{ width: '80px', flexShrink: 0, display: 'flex', alignItems: 'flex-start', paddingTop: '4px' }}>
        <span className={cormorant.className} style={{
          fontSize: '4rem',
          fontWeight: 300,
          lineHeight: 1,
          color: rank && rank <= 3 ? medalColors[rank] : '#2a2318',
          userSelect: 'none',
        }}>
          {rank ? String(rank).padStart(2, '0') : '—'}
        </span>
      </div>

      {/* Image */}
      <div style={{ width: '140px', height: '140px', flexShrink: 0, marginLeft: '24px', background: '#1a1510', overflow: 'hidden' }}>
        {(review.photoUrl || review.photoData) && !imageError ? (
          <Image
            src={review.photoData ? `/api/coffee-reviews/${review.id}/image` : (review.photoUrl || '')}
            alt={review.placeName}
            width={140} height={140}
            style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'sepia(20%) contrast(1.1)', transition: 'transform 0.4s', transform: hovered ? 'scale(1.05)' : 'scale(1)' }}
            onError={() => setImageError(true)}
          />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2.5rem', opacity: 0.15 }}>☕</div>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, paddingRight: '28px', paddingLeft: '20px' }}>
        {/* Name + score */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
          <h3 className={cormorant.className} style={{ fontSize: '1.6rem', fontWeight: 600, color: '#ede5d5', margin: 0, lineHeight: 1.1 }}>
            {review.placeName}
          </h3>
          <div style={{ textAlign: 'left' }}>
            {combinedAvg > 0 ? (
              <>
                <span className={cormorant.className} style={{ fontSize: '2.2rem', fontWeight: 700, color: '#bf7030', lineHeight: 1 }}>{combinedAvg.toFixed(1)}</span>
                <span className={dmMono.className} style={{ fontSize: '10px', color: '#5a4e40', display: 'block', textAlign: 'center' }}>/10</span>
              </>
            ) : (
              <span style={{ fontSize: '12px', color: '#3a342c', fontStyle: 'italic' }}>לא דורג</span>
            )}
          </div>
        </div>

        {/* Links */}
        {(review.mapsUrl || review.instagramUrl) && (
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
            {review.mapsUrl && (
              <a href={review.mapsUrl} target="_blank" rel="noopener noreferrer" className={dmMono.className}
                style={{ fontSize: '10px', letterSpacing: '0.1em', color: '#7a6e5a', border: '1px solid #2a2520', padding: '3px 8px', textDecoration: 'none', transition: 'color 0.2s, border-color 0.2s' }}
                onMouseEnter={e => { (e.target as HTMLElement).style.color = '#bf7030'; (e.target as HTMLElement).style.borderColor = '#bf7030'; }}
                onMouseLeave={e => { (e.target as HTMLElement).style.color = '#7a6e5a'; (e.target as HTMLElement).style.borderColor = '#2a2520'; }}
              >
                📍 MAPS
              </a>
            )}
            {review.instagramUrl && (
              <a href={review.instagramUrl} target="_blank" rel="noopener noreferrer" className={dmMono.className}
                style={{ fontSize: '10px', letterSpacing: '0.1em', color: '#7a6e5a', border: '1px solid #2a2520', padding: '3px 8px', textDecoration: 'none', transition: 'color 0.2s, border-color 0.2s' }}
                onMouseEnter={e => { (e.target as HTMLElement).style.color = '#bf7030'; (e.target as HTMLElement).style.borderColor = '#bf7030'; }}
                onMouseLeave={e => { (e.target as HTMLElement).style.color = '#7a6e5a'; (e.target as HTMLElement).style.borderColor = '#2a2520'; }}
              >
                📸 IG
              </a>
            )}
          </div>
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: '14px', borderBottom: '1px solid #1e1a15', paddingBottom: '8px' }}>
          {(['overview', 'tom', 'tomer'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={dmMono.className}
              style={{
                background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0',
                fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase',
                color: activeTab === tab ? '#bf7030' : '#4a4235',
                borderBottom: activeTab === tab ? '1px solid #bf7030' : '1px solid transparent',
                transition: 'color 0.2s',
              }}
            >
              {tab === 'overview' ? 'סיכום' : tab === 'tom' ? 'תום' : 'תומר'}
            </button>
          ))}
        </div>

        {/* Ratings */}
        <div style={{ minWidth: '200px' }}>
          {ratings.map(r => <RatingBar key={r.label} label={r.label} value={r.value} />)}
          {activeTab === 'overview' && (
            <div style={{ display: 'flex', gap: '24px', marginTop: '12px', paddingTop: '8px', borderTop: '1px solid #1e1a15' }}>
              {[{ name: 'תום', avg: tomAvg }, { name: 'תומר', avg: tomerAvg }].map(({ name, avg }) => (
                <div key={name} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <span style={{ fontSize: '10px', color: '#4a4235', letterSpacing: '0.1em' }}>{name}</span>
                  <span className={dmMono.className} style={{ fontSize: '13px', color: avg > 0 ? '#bf7030' : '#2a2318' }}>
                    {avg > 0 ? avg.toFixed(1) : '—'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ position: 'absolute', bottom: '24px', left: '0', display: 'flex', gap: '8px', opacity: hovered ? 1 : 0, transition: 'opacity 0.2s' }}>
        <button onClick={() => setIsEditing(true)} className={dmMono.className}
          style={{ background: 'none', border: '1px solid #2a2520', color: '#5a4e40', cursor: 'pointer', padding: '4px 10px', fontSize: '9px', letterSpacing: '0.1em' }}>
          EDIT
        </button>
        <button onClick={handleDelete} disabled={isDeleting} className={dmMono.className}
          style={{ background: 'none', border: '1px solid #2a2520', color: '#6a2020', cursor: 'pointer', padding: '4px 10px', fontSize: '9px', letterSpacing: '0.1em' }}>
          {isDeleting ? '...' : 'DEL'}
        </button>
      </div>
    </div>
  );
};

export default CoffeeReviewCard;
