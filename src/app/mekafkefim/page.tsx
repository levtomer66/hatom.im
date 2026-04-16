'use client';

import React, { useState, useEffect } from 'react';
import { Share_Tech_Mono, Rajdhani } from 'next/font/google';
import Navbar from '@/components/Navbar';
import CoffeeReviewCard from '@/components/CoffeeReviewCard';
import AddCoffeeReviewForm from '@/components/AddCoffeeReviewForm';
import { CoffeeReview } from '@/types/coffee';

const shareTech = Share_Tech_Mono({ subsets: ['latin'], weight: ['400'] });
const rajdhani = Rajdhani({ subsets: ['latin'], weight: ['400', '500', '600', '700'] });

export default function MekafkefimPage() {
  const [reviews, setReviews] = useState<CoffeeReview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  const fetchReviews = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/coffee-reviews');
      if (!response.ok) throw new Error('Failed to fetch');
      setReviews(await response.json());
    } catch (err) {
      console.error(err);
      setError('שגיאה בטעינת הביקורות');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { fetchReviews(); }, []);

  const handleDeleteReview = async (id: string) => {
    const response = await fetch(`/api/coffee-reviews/${id}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Failed to delete');
    fetchReviews();
  };

  const nonZeroAvg = (vals: number[]) => {
    const rated = vals.filter(v => v > 0);
    return rated.length ? rated.reduce((a, b) => a + b, 0) / rated.length : 0;
  };

  const sortedReviews = [...reviews].sort((a, b) => {
    const getAvg = (r: CoffeeReview) => {
      const t = nonZeroAvg([r.tomCoffeeRating ?? 0, r.tomFoodRating ?? 0, r.tomAtmosphereRating ?? 0, r.tomPriceRating ?? 0]);
      const tr = nonZeroAvg([r.tomerCoffeeRating ?? 0, r.tomerFoodRating ?? 0, r.tomerAtmosphereRating ?? 0, r.tomerPriceRating ?? 0]);
      return nonZeroAvg([t, tr].filter(v => v > 0));
    };
    return getAvg(b) - getAvg(a);
  });

  return (
    <div style={{
      minHeight: '100vh',
      background: '#050710',
      backgroundImage: `
        radial-gradient(ellipse at 15% 25%, rgba(0,229,255,0.05) 0%, transparent 50%),
        radial-gradient(ellipse at 85% 75%, rgba(255,45,120,0.04) 0%, transparent 50%),
        radial-gradient(ellipse at 50% 50%, rgba(255,107,43,0.03) 0%, transparent 70%)
      `,
    }}>
      <Navbar />

      <style>{`
        @keyframes slideIn {
          from { opacity: 0; transform: translateX(-16px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes pulse-glow {
          0%, 100% { text-shadow: 0 0 20px rgba(0,229,255,0.8), 0 0 40px rgba(0,229,255,0.4); }
          50% { text-shadow: 0 0 30px rgba(0,229,255,1), 0 0 60px rgba(0,229,255,0.6), 0 0 80px rgba(0,229,255,0.2); }
        }
        @keyframes blink {
          0%, 90%, 100% { opacity: 1; }
          95% { opacity: 0; }
        }
        .card-in { animation: slideIn 0.4s ease forwards; opacity: 0; }
        .neon-title { animation: pulse-glow 3s ease-in-out infinite; }
        .cursor { animation: blink 1.2s step-end infinite; }
      `}</style>

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '48px 24px 100px' }}>

        {/* Header */}
        <header style={{ marginBottom: '64px', borderBottom: '1px solid rgba(0,229,255,0.1)', paddingBottom: '40px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', direction: 'rtl' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <p className={shareTech.className} style={{
                fontSize: '11px', letterSpacing: '0.3em',
                color: 'rgba(0,229,255,0.5)', margin: 0,
              }}>
                {'>'} INITIALIZING COFFEE_GUIDE.SYS
                <span className="cursor" style={{ marginRight: '4px' }}>|</span>
              </p>
            </div>

            <h1 className={rajdhani.className} style={{
              fontSize: 'clamp(3rem, 9vw, 7rem)', fontWeight: 700,
              margin: '8px 0',
              color: '#00e5ff',
              letterSpacing: '-0.02em',
              lineHeight: 0.9,
            }}
              suppressHydrationWarning
            >
              <span className="neon-title" style={{ display: 'inline-block' }}>מקפקפים</span>
            </h1>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
              <p className={shareTech.className} style={{
                fontSize: '12px', letterSpacing: '0.15em',
                color: 'rgba(255,255,255,0.3)', margin: 0,
              }}>
                TEL AVIV COFFEE INTELLIGENCE · TOM &amp; TOMER RATINGS SYSTEM v2.0
              </p>

              <button
                onClick={() => setShowAddForm(!showAddForm)}
                className={shareTech.className}
                style={{
                  background: showAddForm ? 'rgba(0,229,255,0.15)' : 'none',
                  border: '1px solid rgba(0,229,255,0.5)',
                  color: '#00e5ff',
                  cursor: 'pointer', padding: '8px 18px',
                  fontSize: '10px', letterSpacing: '0.2em',
                  boxShadow: showAddForm ? '0 0 20px rgba(0,229,255,0.2)' : 'none',
                  transition: 'all 0.2s',
                }}
              >
                {showAddForm ? '[ × CLOSE ]' : '[ + NEW ENTRY ]'}
              </button>
            </div>

            {/* Stats */}
            {!isLoading && reviews.length > 0 && (
              <div style={{ display: 'flex', gap: '32px', marginTop: '8px', flexWrap: 'wrap' }}>
                {[
                  { label: 'LOCATIONS LOGGED', value: String(reviews.length) },
                  { label: 'TOP RATED', value: sortedReviews[0]?.placeName || '—' },
                ].map(({ label, value }) => (
                  <div key={label}>
                    <span className={shareTech.className} style={{ fontSize: '9px', color: 'rgba(255,255,255,0.25)', letterSpacing: '0.2em', display: 'block', marginBottom: '2px' }}>{label}</span>
                    <span className={rajdhani.className} style={{ fontSize: '1rem', color: '#ff6b2b', fontWeight: 600 }}>{value}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </header>

        {/* Add form */}
        {showAddForm && (
          <div style={{
            marginBottom: '48px',
            background: 'rgba(0,10,20,0.8)',
            border: '1px solid rgba(0,229,255,0.2)',
            padding: '24px',
            boxShadow: '0 0 30px rgba(0,229,255,0.08)',
          }}>
            <AddCoffeeReviewForm onSuccess={() => { setShowAddForm(false); fetchReviews(); }} />
          </div>
        )}

        {/* Content */}
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', marginBottom: '16px' }}>
              {[0, 1, 2].map(i => (
                <div key={i} style={{
                  width: '8px', height: '8px', background: '#00e5ff',
                  borderRadius: '50%',
                  animation: `blink 1.2s ${i * 0.2}s step-end infinite`,
                  boxShadow: '0 0 10px rgba(0,229,255,0.8)',
                }} />
              ))}
            </div>
            <p className={shareTech.className} style={{ fontSize: '11px', letterSpacing: '0.3em', color: 'rgba(0,229,255,0.4)' }}>
              LOADING DATA...
            </p>
          </div>
        ) : error ? (
          <p className={shareTech.className} style={{ color: '#ff2d78', textAlign: 'center', letterSpacing: '0.1em' }}>{error}</p>
        ) : sortedReviews.length === 0 ? (
          <p className={rajdhani.className} style={{ color: 'rgba(255,255,255,0.3)', textAlign: 'center', fontSize: '1.2rem' }}>NO DATA FOUND</p>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '16px',
          }}>
            {sortedReviews.map((review, index) => (
              <div key={review.id} className="card-in" style={{ animationDelay: `${index * 45}ms` }}>
                <CoffeeReviewCard
                  review={review}
                  onDelete={handleDeleteReview}
                  onUpdate={fetchReviews}
                  rank={index + 1}
                />
              </div>
            ))}
          </div>
        )}

        {/* Footer */}
        {!isLoading && reviews.length > 0 && (
          <div style={{ marginTop: '48px', borderTop: '1px solid rgba(0,229,255,0.06)', paddingTop: '16px' }}>
            <p className={shareTech.className} style={{ fontSize: '9px', letterSpacing: '0.2em', color: 'rgba(255,255,255,0.15)', textAlign: 'center' }}>
              {reviews.length} ENTRIES · SORTED BY AGGREGATE SCORE · 0.0 = NOT RATED
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
