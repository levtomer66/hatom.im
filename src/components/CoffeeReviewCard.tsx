'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { noaShalev } from '@/lib/noaShalev';
import {
  CoffeeReview,
  scoreReview,
  priceTier,
  reviewerGap,
  isOpenNow,
  COFFEE_TAGS,
  CoffeeTagDef,
  SortMetric,
} from '@/types/coffee';
import EditCoffeeReviewForm from './EditCoffeeReviewForm';

// Sort metrics that map to a single category ring (as opposed to 'overall'
// or a place-level metric like 'coffeePrice'/'date'/'name', which fall back
// to the overall combined score for the headline).
const CATEGORY_HEADLINE_METRICS = new Set<SortMetric>(['coffee', 'food', 'pastry', 'atmosphere', 'value']);

const playfair = noaShalev;
const courier = noaShalev;

interface CoffeeReviewCardProps {
  review: CoffeeReview;
  // Both callbacks are owner-only. When omitted the card hides the
  // edit + delete affordances, so non-owners get a read-only view.
  onDelete?: (id: string) => Promise<void>;
  onUpdate?: () => void;
  rank?: number;
  isPriority?: boolean;
  // Drives which category the big headline number tracks (the sort-bar's
  // active metric in Task 16). Defaults to 'coffee' so the card is useful
  // before that bar exists. Place-level metrics (coffeePrice/date/name) and
  // 'overall' fall back to the overall combined score.
  headlineMetric?: SortMetric;
}

// SVG ring gauge for a score. Three states: rated (coloured arc + number),
// active-but-unrated (empty ring + "—"), and disabled (dashed grey ring, empty
// centre, and an "אין" line above the category name — the place doesn't have
// this category at all).
const ScoreRing = ({
  score,
  label,
  size = 72,
  disabled = false,
}: { score: number; label: string; size?: number; disabled?: boolean }) => {
  const r = size * 0.38;
  const circ = 2 * Math.PI * r;
  const fill = score > 0 ? (score / 10) * circ : 0;
  const gap = circ - fill;
  const colors = score >= 8 ? '#5a7a3a' : score >= 6 ? '#8a6020' : score >= 4 ? '#c04020' : '#aaa';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={disabled ? '#d0c4a8' : '#e8ddc8'} strokeWidth="4"
          strokeDasharray={disabled ? '3 5' : undefined}
        />
        {!disabled && score > 0 && (
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={colors} strokeWidth="4"
            strokeDasharray={`${fill} ${gap}`} strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 0.8s ease' }}
          />
        )}
        {!disabled && (
          <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central"
            style={{ transform: 'rotate(90deg)', transformOrigin: 'center', fontFamily: 'inherit', fontSize: size * 0.22 + 'px', fill: score > 0 ? '#3a2c1a' : '#bba', fontWeight: 700 }}>
            {score > 0 ? score.toFixed(1) : '—'}
          </text>
        )}
      </svg>
      {/* minHeight keeps all four columns the same height whether or not a
          category is disabled, so the ring grid never jumps. */}
      <div style={{ minHeight: '26px', textAlign: 'center' }}>
        {disabled && (
          <span style={{ display: 'block', fontSize: '10px', color: '#a09070', letterSpacing: '0.08em', fontFamily: 'inherit', fontWeight: 700 }}>
            אין
          </span>
        )}
        <span style={{ display: 'block', fontSize: '10px', color: disabled ? '#b0a488' : '#8a7a60', letterSpacing: '0.08em', textTransform: 'uppercase', fontFamily: 'inherit' }}>
          {label}
        </span>
      </div>
    </div>
  );
};

const CoffeeReviewCard: React.FC<CoffeeReviewCardProps> = ({ review, onDelete, onUpdate, rank, isPriority = false, headlineMetric = 'coffee' }) => {
  const [imageError, setImageError] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'tom' | 'tomer'>('overview');
  const scores = scoreReview(review);
  const tomAvg = scores.tom;
  const tomerAvg = scores.tomer;
  const combinedAvg = scores.combined;

  // Headline tracks headlineMetric: a category metric shows that category's
  // combined score + label; 'overall' and every place-level metric
  // (coffeePrice/date/name) fall back to the overall combined score.
  const headlineCategory = CATEGORY_HEADLINE_METRICS.has(headlineMetric)
    ? scores.categories.find((c) => c.id === (headlineMetric === 'value' ? 'price' : headlineMetric))
    : undefined;
  const headlineValue = headlineCategory ? headlineCategory.combined : combinedAvg;
  const headlineLabel = headlineCategory ? headlineCategory.label : 'כללי';

  const isControversial = reviewerGap(review) >= 2;
  const isOpen = review.openingHours ? isOpenNow(review.openingHours) : false;
  const tagChips: CoffeeTagDef[] = (review.tags ?? [])
    .map((id) => COFFEE_TAGS.find((t) => t.id === id))
    .filter((t): t is CoffeeTagDef => t !== undefined);

  // One list instead of three hand-written literals; the tab picks which
  // number to show and `disabled` rides along unchanged.
  const rings = scores.categories.map((c) => ({
    label: c.label,
    disabled: c.disabled,
    score: activeTab === 'overview' ? c.combined : activeTab === 'tom' ? c.tom : c.tomer,
  }));

  const formattedDate = new Date(review.createdAt).toLocaleDateString('he-IL', { year: 'numeric', month: '2-digit', day: '2-digit' });

  const rankBadge = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : null;

  const canEdit = typeof onDelete === 'function' && typeof onUpdate === 'function';

  const handleDelete = async () => {
    if (!onDelete) return;
    if (window.confirm('האם אתה בטוח שברצונך למחוק ביקורת זו?')) {
      setIsDeleting(true);
      try { await onDelete(review.id); } catch { setIsDeleting(false); }
    }
  };

  if (isEditing && onUpdate) {
    return <EditCoffeeReviewForm review={review} onSuccess={() => { setIsEditing(false); onUpdate(); }} onCancel={() => setIsEditing(false)} />;
  }

  return (
    <div style={{
      background: 'linear-gradient(160deg, #fdf6e3 0%, #f7eed5 100%)',
      border: '1px solid #d4c4a0',
      boxShadow: '3px 5px 18px rgba(90,60,20,0.13), 0 1px 3px rgba(90,60,20,0.08)',
      position: 'relative',
      overflow: 'hidden',
      transition: 'transform 0.25s ease, box-shadow 0.25s ease',
    }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-3px)'; (e.currentTarget as HTMLElement).style.boxShadow = '3px 10px 28px rgba(90,60,20,0.18), 0 2px 6px rgba(90,60,20,0.1)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = ''; (e.currentTarget as HTMLElement).style.boxShadow = '3px 5px 18px rgba(90,60,20,0.13), 0 1px 3px rgba(90,60,20,0.08)'; }}
    >
      {/* Paper grain overlay */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E")`,
        backgroundSize: '200px 200px',
        opacity: 0.5,
      }} />

      {/* Rank stamp */}
      {rankBadge && (
        <div style={{
          position: 'absolute', top: '12px', right: '12px', zIndex: 10,
          fontSize: '2rem', filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.15))',
        }}>
          {rankBadge}
        </div>
      )}

      {/* Controversy badge — sits beside the rank stamp, shifting clear of it
          when both are present. */}
      {isControversial && (
        <div className={courier.className} style={{
          position: 'absolute', top: '16px', right: rankBadge ? '56px' : '12px', zIndex: 10,
          fontSize: '10px', fontWeight: 700, color: '#fdf6e3', background: '#b0402a',
          padding: '3px 8px', borderRadius: '10px', letterSpacing: '0.02em', whiteSpace: 'nowrap',
          boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
        }}>
          🔥 מחלוקת
        </div>
      )}

      {/* Action buttons (owners only — hidden when onDelete/onUpdate absent) */}
      {canEdit && (
        <div style={{ position: 'absolute', top: '10px', left: '10px', zIndex: 10, display: 'flex', gap: '4px' }}>
          <button onClick={() => setIsEditing(true)}
            style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid #c4b080', borderRadius: '50%', width: '30px', height: '30px', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
            ✏️
          </button>
          <button onClick={handleDelete} disabled={isDeleting}
            style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid #c4b080', borderRadius: '50%', width: '30px', height: '30px', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
            🗑️
          </button>
        </div>
      )}

      {/* Image */}
      <div style={{ height: '180px', background: '#ece0c8', overflow: 'hidden', position: 'relative' }}>
        {review.photoUrl && !imageError ? (
          <Image
            src={review.photoUrl}
            alt={review.placeName}
            fill
            style={{ objectFit: 'cover', filter: 'sepia(30%) saturate(0.85) contrast(1.05)' }}
            onError={() => setImageError(true)}
            sizes="(max-width: 600px) 100vw, (max-width: 1000px) 50vw, 320px"
            priority={isPriority}
            unoptimized
          />
        ) : (
          <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '4rem', opacity: 0.2 }}>☕</div>
        )}
        {/* Receipt tape top */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, height: '12px',
          background: 'linear-gradient(160deg, #fdf6e3 0%, #f7eed5 100%)',
          clipPath: 'polygon(0% 100%, 2% 0%, 4% 100%, 6% 0%, 8% 100%, 10% 0%, 12% 100%, 14% 0%, 16% 100%, 18% 0%, 20% 100%, 22% 0%, 24% 100%, 26% 0%, 28% 100%, 30% 0%, 32% 100%, 34% 0%, 36% 100%, 38% 0%, 40% 100%, 42% 0%, 44% 100%, 46% 0%, 48% 100%, 50% 0%, 52% 100%, 54% 0%, 56% 100%, 58% 0%, 60% 100%, 62% 0%, 64% 100%, 66% 0%, 68% 100%, 70% 0%, 72% 100%, 74% 0%, 76% 100%, 78% 0%, 80% 100%, 82% 0%, 84% 100%, 86% 0%, 88% 100%, 90% 0%, 92% 100%, 94% 0%, 96% 100%, 98% 0%, 100% 100%)',
        }} />
      </div>

      {/* Content */}
      <div style={{ padding: '16px 18px 20px', position: 'relative', zIndex: 2, direction: 'rtl' }}>
        {/* Receipt header line */}
        <div style={{ borderTop: '2px dashed #c4b080', marginBottom: '14px', paddingTop: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ flex: 1, paddingLeft: '8px' }}>
              <h3 className={playfair.className} style={{ fontSize: '1.35rem', fontWeight: 700, color: '#2a1e0a', margin: 0, lineHeight: 1.2 }}>
                {review.placeName}
              </h3>
              {review.area && (
                <div className={courier.className} style={{ fontSize: '10px', color: '#8a7050', marginTop: '3px' }}>
                  {review.area}
                </div>
              )}
            </div>
            {headlineValue > 0 ? (
              <div style={{ textAlign: 'center', minWidth: '50px' }}>
                <span className={courier.className} style={{ fontSize: '1.6rem', fontWeight: 700, color: '#5a3a10', lineHeight: 1 }}>{headlineValue.toFixed(1)}</span>
                <div className={courier.className} style={{ fontSize: '9px', color: '#a08060', marginTop: '1px' }}>{headlineLabel}</div>
                {headlineCategory && combinedAvg > 0 && (
                  <div className={courier.className} style={{ fontSize: '9px', color: '#b0a080', marginTop: '2px' }}>
                    כללי {combinedAvg.toFixed(1)}
                  </div>
                )}
              </div>
            ) : (
              <span style={{ fontSize: '11px', color: '#b0a080', fontStyle: 'italic' }}>לא דורג</span>
            )}
          </div>
        </div>

        {/* Coffee price + tier badge + tags */}
        {(!!review.coffeePriceIls || tagChips.length > 0) && (
          <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
            {!!review.coffeePriceIls && (
              <span className={courier.className} style={{
                fontSize: '11px', fontWeight: 700, color: '#5a3a10',
                background: 'rgba(90,58,16,0.08)', border: '1px solid rgba(90,58,16,0.2)',
                padding: '2px 8px', borderRadius: '2px',
              }}>
                ₪{review.coffeePriceIls}
                {review.coffeeDrinkLabel && ` · ${review.coffeeDrinkLabel}`}
                {' '}
                <span style={{ color: '#8a6020' }}>{'₪'.repeat(priceTier(review.coffeePriceIls))}</span>
              </span>
            )}
            {tagChips.map((t) => (
              <span key={t.id} className={courier.className} style={{
                fontSize: '10px', color: '#5a4a30', background: 'rgba(120,100,60,0.08)',
                border: '1px solid rgba(120,100,60,0.2)', padding: '2px 7px', borderRadius: '10px',
              }}>
                {t.emoji} {t.label}
              </span>
            ))}
          </div>
        )}

        {/* Open-now badge + hours link */}
        {review.openingHours && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '14px' }}>
            <span className={courier.className} style={{
              fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '2px',
              color: isOpen ? '#2f5a1f' : '#6a5a40',
              background: isOpen ? 'rgba(90,122,58,0.15)' : 'rgba(120,110,90,0.12)',
              border: `1px solid ${isOpen ? 'rgba(90,122,58,0.3)' : 'rgba(120,110,90,0.25)'}`,
            }}>
              {isOpen ? 'פתוח עכשיו' : 'סגור'}
            </span>
            {review.mapsUrl && (
              <a href={review.mapsUrl} target="_blank" rel="noopener noreferrer" className={courier.className}
                style={{ fontSize: '10px', color: '#5a7a3a', textDecoration: 'underline' }}>
                שעות בגוגל ↗
              </a>
            )}
          </div>
        )}

        {/* Links */}
        {(review.mapsUrl || review.instagramUrl) && (
          <div style={{ display: 'flex', gap: '6px', marginBottom: '14px', flexWrap: 'wrap' }}>
            {review.mapsUrl && (
              <a href={review.mapsUrl} target="_blank" rel="noopener noreferrer" className={courier.className}
                style={{ fontSize: '10px', color: '#5a7a3a', background: 'rgba(90,122,58,0.1)', border: '1px solid rgba(90,122,58,0.25)', padding: '2px 8px', textDecoration: 'none', borderRadius: '2px' }}>
                📍 מפה
              </a>
            )}
            {review.instagramUrl && (
              <a href={review.instagramUrl} target="_blank" rel="noopener noreferrer" className={courier.className}
                style={{ fontSize: '10px', color: '#8a3060', background: 'rgba(138,48,96,0.08)', border: '1px solid rgba(138,48,96,0.2)', padding: '2px 8px', textDecoration: 'none', borderRadius: '2px' }}>
                📸 אינסטגרם
              </a>
            )}
          </div>
        )}

        {/* Receipt divider */}
        <div style={{ borderTop: '1px dashed #c4b080', marginBottom: '14px' }} />

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0', marginBottom: '16px' }}>
          {(['overview', 'tom', 'tomer'] as const).map((tab, i) => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={courier.className}
              style={{
                flex: 1, background: activeTab === tab ? '#3a2a10' : 'transparent',
                border: '1px solid #c4b080', borderLeft: i > 0 ? 'none' : '1px solid #c4b080',
                color: activeTab === tab ? '#fdf6e3' : '#8a7050',
                cursor: 'pointer', padding: '5px 0', fontSize: '11px',
                letterSpacing: '0.05em', transition: 'all 0.15s',
              }}
            >
              {tab === 'overview' ? 'סיכום' : tab === 'tom' ? 'תום' : 'תומר'}
            </button>
          ))}
        </div>

        {/* Score rings */}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '0 4px' }}>
          {rings.map(r => <ScoreRing key={r.label} score={r.score} label={r.label} disabled={r.disabled} size={62} />)}
        </div>

        {/* Reviewer averages in overview */}
        {activeTab === 'overview' && (tomAvg > 0 || tomerAvg > 0) && (
          <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '14px', borderTop: '1px dashed #c4b080', paddingTop: '10px' }}>
            {[{ name: 'תום', avg: tomAvg }, { name: 'תומר', avg: tomerAvg }].map(({ name, avg }) => (
              <div key={name} style={{ textAlign: 'center' }}>
                <div className={courier.className} style={{ fontSize: '10px', color: '#8a7050', marginBottom: '2px' }}>{name}</div>
                <div className={courier.className} style={{ fontSize: '1rem', fontWeight: 700, color: avg > 0 ? '#3a2a10' : '#b0a080' }}>
                  {avg > 0 ? avg.toFixed(1) : '—'}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Per-reviewer notes — shown only inside the matching tab */}
        {activeTab === 'tom' && !!review.tomNotes?.trim() && (
          <div style={{ marginTop: '14px', borderTop: '1px dashed #c4b080', paddingTop: '10px' }}>
            <div className={courier.className} style={{ fontSize: '9px', color: '#8a7050', marginBottom: '4px', letterSpacing: '0.05em' }}>הערות</div>
            <p className={courier.className} style={{ fontSize: '11px', color: '#3a2a10', margin: 0, whiteSpace: 'pre-wrap' }}>{review.tomNotes}</p>
          </div>
        )}
        {activeTab === 'tomer' && !!review.tomerNotes?.trim() && (
          <div style={{ marginTop: '14px', borderTop: '1px dashed #c4b080', paddingTop: '10px' }}>
            <div className={courier.className} style={{ fontSize: '9px', color: '#8a7050', marginBottom: '4px', letterSpacing: '0.05em' }}>הערות</div>
            <p className={courier.className} style={{ fontSize: '11px', color: '#3a2a10', margin: 0, whiteSpace: 'pre-wrap' }}>{review.tomerNotes}</p>
          </div>
        )}

        {/* Tried items */}
        {review.triedItems && review.triedItems.length > 0 && (
          <div style={{ marginTop: '14px', borderTop: '1px dashed #c4b080', paddingTop: '10px' }}>
            <div className={courier.className} style={{ fontSize: '9px', color: '#8a7050', marginBottom: '6px', letterSpacing: '0.05em' }}>מה טעמנו</div>
            {review.triedItems.map((item, i) => (
              <div key={`${item.name}-${i}`} className={courier.className} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '11px', color: '#5a3a10', padding: '2px 0' }}>
                <span>{item.name}</span>
                {typeof item.priceIls === 'number' && <span>₪{item.priceIls}</span>}
              </div>
            ))}
          </div>
        )}

        {/* Receipt footer */}
        <div style={{ borderTop: '2px dashed #c4b080', marginTop: '14px', paddingTop: '10px' }}>
          <div className={courier.className} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9px', color: '#a09070' }}>
            <span>תאריך: {formattedDate}</span>
            <span style={{ direction: 'ltr' }}>NO. {rank ? String(rank).padStart(3, '0') : '—'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CoffeeReviewCard;
