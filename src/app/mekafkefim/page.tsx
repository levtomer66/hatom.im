'use client';

import React, { useState, useEffect } from 'react';
import { Playfair_Display, Courier_Prime } from 'next/font/google';
import Navbar from '@/components/Navbar';
import CoffeeReviewCard from '@/components/CoffeeReviewCard';
import AddCoffeeReviewForm from '@/components/AddCoffeeReviewForm';
import { CoffeeReview } from '@/types/coffee';

const playfair = Playfair_Display({ subsets: ['latin'], weight: ['400', '600', '700', '900'], style: ['normal', 'italic'] });
const courier = Courier_Prime({ subsets: ['latin'], weight: ['400', '700'] });

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
    <>
      <link rel="preconnect" href="https://medias.timeout.co.il" crossOrigin="anonymous" />
      <link rel="preconnect" href="https://cityrattelaviv.wordpress.com" crossOrigin="anonymous" />
      <link rel="preconnect" href="https://img02.restaurantguru.com" crossOrigin="anonymous" />
      <link rel="preconnect" href="https://eatintlv.com" crossOrigin="anonymous" />
      <link rel="preconnect" href="https://img.haarets.co.il" crossOrigin="anonymous" />
    <div style={{
      minHeight: '100vh',
      background: '#f2e8d5',
      backgroundImage: `
        radial-gradient(ellipse at 20% 10%, rgba(200,160,80,0.12) 0%, transparent 60%),
        radial-gradient(ellipse at 80% 90%, rgba(160,100,40,0.1) 0%, transparent 60%)
      `,
    }}>
      <Navbar />

      <style>{`
        @keyframes popIn {
          from { opacity: 0; transform: scale(0.96) translateY(12px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .card-pop { animation: popIn 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards; opacity: 0; }
      `}</style>

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '48px 24px 100px' }}>

        {/* Header — like the top of a paper notepad */}
        <header style={{ textAlign: 'center', marginBottom: '56px', position: 'relative' }}>
          <div style={{
            display: 'inline-block',
            background: 'linear-gradient(160deg, #fdf6e3, #f5e8c8)',
            border: '1px solid #c4a870',
            boxShadow: '0 4px 20px rgba(100,60,10,0.12), 0 1px 4px rgba(100,60,10,0.08)',
            padding: '36px 60px 32px',
            position: 'relative',
            maxWidth: '560px',
          }}>
            {/* Binding holes */}
            {[-1, 0, 1].map(i => (
              <div key={i} style={{
                position: 'absolute', top: '50%', left: i === -1 ? '-14px' : i === 0 ? '-14px' : '-14px',
                marginTop: `${i * 28}px`,
                width: '12px', height: '12px', borderRadius: '50%',
                background: '#d4c4a0', border: '2px solid #b8a878',
                boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.2)',
              }} />
            ))}
            {/* Ruled lines */}
            {[0, 1, 2, 3].map(i => (
              <div key={i} style={{
                position: 'absolute', left: '24px', right: '24px',
                top: `${72 + i * 28}px`, height: '1px',
                background: 'rgba(180,140,60,0.15)',
                pointerEvents: 'none',
              }} />
            ))}

            <p className={courier.className} style={{
              fontSize: '10px', letterSpacing: '0.25em', textTransform: 'uppercase',
              color: '#a08040', margin: '0 0 10px 0',
            }}>
              coffee journal · tel aviv
            </p>
            <h1 className={playfair.className} style={{
              fontSize: 'clamp(2.8rem, 7vw, 4.5rem)', fontWeight: 900,
              color: '#2a1a06', margin: '0 0 10px 0', lineHeight: 1,
              letterSpacing: '-0.02em',
            }}>
              מקפקפים
            </h1>
            <p className={playfair.className} style={{
              fontSize: '1rem', color: '#7a6040', fontStyle: 'italic', margin: '0 0 20px 0',
            }}>
              המדריך השלם לבתי הקפה הטובים ביותר
            </p>

            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className={courier.className}
              style={{
                background: showAddForm ? '#3a2a10' : 'transparent',
                border: '2px solid #3a2a10',
                color: showAddForm ? '#fdf6e3' : '#3a2a10',
                cursor: 'pointer', padding: '8px 20px',
                fontSize: '11px', letterSpacing: '0.12em', textTransform: 'uppercase',
                transition: 'all 0.2s',
              }}
            >
              {showAddForm ? '× סגור' : '+ הוסף ביקורת'}
            </button>
          </div>

          {/* Decorative coffee ring stains */}
          <div style={{ position: 'absolute', top: '20px', right: '10%', width: '60px', height: '60px', borderRadius: '50%', border: '3px solid rgba(140,90,30,0.12)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', top: '35px', right: 'calc(10% + 20px)', width: '60px', height: '60px', borderRadius: '50%', border: '3px solid rgba(140,90,30,0.08)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: '10px', left: '12%', width: '44px', height: '44px', borderRadius: '50%', border: '2px solid rgba(140,90,30,0.1)', pointerEvents: 'none' }} />
        </header>

        {/* Add form */}
        {showAddForm && (
          <div style={{ maxWidth: '640px', margin: '0 auto 48px', background: 'linear-gradient(160deg, #fdf6e3, #f5e8c8)', border: '1px solid #c4a870', padding: '24px', boxShadow: '0 4px 16px rgba(100,60,10,0.1)' }}>
            <AddCoffeeReviewForm onSuccess={() => { setShowAddForm(false); fetchReviews(); }} />
          </div>
        )}

        {/* Content */}
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <p className={courier.className} style={{ color: '#a08040', letterSpacing: '0.2em' }}>BREWING...</p>
          </div>
        ) : error ? (
          <p style={{ color: '#8a3020', textAlign: 'center' }}>{error}</p>
        ) : sortedReviews.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '80px 0' }}>
            <p className={playfair.className} style={{ fontSize: '1.5rem', color: '#8a7040', fontStyle: 'italic' }}>אין ביקורות עדיין</p>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
            gap: '28px',
          }}>
            {sortedReviews.map((review, index) => (
              <div
                key={review.id}
                className="card-pop"
                style={{ animationDelay: `${index * 55}ms` }}
              >
                <CoffeeReviewCard
                  review={review}
                  onDelete={handleDeleteReview}
                  onUpdate={fetchReviews}
                  rank={index + 1}
                  isPriority={index === 0}
                />
              </div>
            ))}
          </div>
        )}

        {/* Footer note */}
        {!isLoading && reviews.length > 0 && (
          <div style={{ textAlign: 'center', marginTop: '48px' }}>
            <p className={courier.className} style={{ fontSize: '10px', color: '#a09060', letterSpacing: '0.15em' }}>
              {reviews.length} בתי קפה · מיוין לפי דירוג ממוצע · 0 = לא דורג
            </p>
          </div>
        )}
      </div>
    </div>
    </>
  );
}
