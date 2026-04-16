'use client';

import React, { useState, useEffect } from 'react';
import { Cormorant_Garamond, DM_Mono } from 'next/font/google';
import Navbar from '@/components/Navbar';
import CoffeeReviewCard from '@/components/CoffeeReviewCard';
import AddCoffeeReviewForm from '@/components/AddCoffeeReviewForm';
import { CoffeeReview } from '@/types/coffee';

const cormorant = Cormorant_Garamond({ subsets: ['latin'], weight: ['300', '400', '600', '700'], style: ['normal', 'italic'] });
const dmMono = DM_Mono({ subsets: ['latin'], weight: ['300', '400', '500'] });

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
    <div style={{ minHeight: '100vh', background: '#0d0a05', color: '#ede5d5' }}>
      <Navbar />

      <style>{`
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .card-row { animation: fadeUp 0.5s ease forwards; opacity: 0; }
      `}</style>

      <div style={{ maxWidth: '860px', margin: '0 auto', padding: '60px 24px 120px' }}>

        {/* Header */}
        <header style={{ marginBottom: '72px', direction: 'rtl' }}>
          <div style={{ borderBottom: '1px solid #1e1a15', paddingBottom: '40px' }}>
            <p className={dmMono.className} style={{
              fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase',
              color: '#bf7030', marginBottom: '16px', margin: '0 0 16px 0'
            }}>
              coffee guide · tel aviv · tom & tomer
            </p>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <div>
                <h1 className={cormorant.className} style={{
                  fontSize: 'clamp(3.5rem, 10vw, 7.5rem)', fontWeight: 700,
                  lineHeight: 0.88, color: '#ede5d5', margin: 0, letterSpacing: '-0.02em'
                }}>
                  מקפקפים
                </h1>
                <p className={cormorant.className} style={{
                  fontSize: '1.15rem', color: '#6a5e50', fontStyle: 'italic',
                  marginTop: '14px', margin: '14px 0 0 0'
                }}>
                  המדריך השלם לבתי הקפה הטובים ביותר
                </p>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '10px' }}>
                <span style={{ fontSize: '5rem', opacity: 0.06, lineHeight: 1 }}>☕</span>
                <button
                  onClick={() => setShowAddForm(!showAddForm)}
                  className={dmMono.className}
                  style={{
                    background: showAddForm ? '#bf7030' : 'none',
                    border: '1px solid #bf7030',
                    color: showAddForm ? '#0d0a05' : '#bf7030',
                    cursor: 'pointer', padding: '8px 16px',
                    fontSize: '10px', letterSpacing: '0.15em', textTransform: 'uppercase',
                    transition: 'all 0.2s',
                  }}
                >
                  {showAddForm ? '× סגור' : '+ הוסף ביקורת'}
                </button>
              </div>
            </div>
          </div>

          {/* Stats row */}
          {!isLoading && reviews.length > 0 && (
            <div style={{ display: 'flex', gap: '40px', paddingTop: '20px' }}>
              {[
                { label: 'CAFES REVIEWED', value: String(reviews.length) },
                { label: 'HIGHEST RATED', value: sortedReviews[0]?.placeName || '—' },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className={dmMono.className} style={{ fontSize: '9px', letterSpacing: '0.2em', color: '#3a3228', margin: '0 0 4px 0' }}>{label}</p>
                  <p className={cormorant.className} style={{ fontSize: '1.1rem', color: '#7a6e5a', margin: 0 }}>{value}</p>
                </div>
              ))}
            </div>
          )}
        </header>

        {/* Add form */}
        {showAddForm && (
          <div style={{ marginBottom: '48px', borderBottom: '1px solid #1e1a15', paddingBottom: '48px' }}>
            <AddCoffeeReviewForm onSuccess={() => { setShowAddForm(false); fetchReviews(); }} />
          </div>
        )}

        {/* Content */}
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '80px 0', color: '#3a3228' }}>
            <p className={dmMono.className} style={{ fontSize: '11px', letterSpacing: '0.2em' }}>LOADING...</p>
          </div>
        ) : error ? (
          <p style={{ color: '#8a3020', textAlign: 'center' }}>{error}</p>
        ) : sortedReviews.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <p className={cormorant.className} style={{ fontSize: '1.5rem', color: '#3a3228', fontStyle: 'italic' }}>אין ביקורות עדיין</p>
          </div>
        ) : (
          <div>
            {/* Column headers */}
            <div className={dmMono.className} style={{
              display: 'flex', gap: '0', paddingBottom: '12px',
              borderBottom: '1px solid #1e1a15', direction: 'rtl',
              fontSize: '9px', letterSpacing: '0.2em', color: '#3a3228', textTransform: 'uppercase'
            }}>
              <div style={{ width: '80px' }}>#</div>
              <div style={{ width: '140px', marginLeft: '24px' }}>תמונה</div>
              <div style={{ flex: 1, paddingRight: '28px' }}>בית קפה</div>
            </div>

            {sortedReviews.map((review, index) => (
              <div
                key={review.id}
                className="card-row"
                style={{ animationDelay: `${index * 60}ms` }}
              >
                <CoffeeReviewCard
                  review={review}
                  onDelete={handleDeleteReview}
                  onUpdate={fetchReviews}
                  rank={index + 1}
                />
              </div>
            ))}

            <div style={{ borderTop: '1px solid #1e1a15', paddingTop: '32px', marginTop: '8px', direction: 'rtl' }}>
              <p className={dmMono.className} style={{ fontSize: '9px', letterSpacing: '0.2em', color: '#2a2318' }}>
                {reviews.length} CAFES · SORTED BY COMBINED RATING · ZERO = NOT RATED
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
