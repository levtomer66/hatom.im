'use client';

import React, { useState } from 'react';
import { RatingStars, ScaleBar } from './RatingStars';
import Image from 'next/image';
import { CoffeeReview } from '@/types/coffee';

interface EditCoffeeReviewFormProps {
  review: CoffeeReview;
  onSuccess: () => void;
  onCancel: () => void;
}

const EditCoffeeReviewForm: React.FC<EditCoffeeReviewFormProps> = ({
  review,
  onSuccess,
  onCancel
}) => {
  const [placeName, setPlaceName] = useState(review.placeName);
  // Tom's ratings
  const [tomCoffeeRating, setTomCoffeeRating] = useState(review.tomCoffeeRating);
  const [tomFoodRating, setTomFoodRating] = useState(review.tomFoodRating);
  const [tomAtmosphereRating, setTomAtmosphereRating] = useState(review.tomAtmosphereRating);
  const [tomPriceRating, setTomPriceRating] = useState(review.tomPriceRating);
  // Tomer's ratings
  const [tomerCoffeeRating, setTomerCoffeeRating] = useState(review.tomerCoffeeRating);
  const [tomerFoodRating, setTomerFoodRating] = useState(review.tomerFoodRating);
  const [tomerAtmosphereRating, setTomerAtmosphereRating] = useState(review.tomerAtmosphereRating);
  const [tomerPriceRating, setTomerPriceRating] = useState(review.tomerPriceRating);
  const [photoUrl, setPhotoUrl] = useState(review.photoUrl || '');
  const [mapsUrl, setMapsUrl] = useState(review.mapsUrl || '');
  const [instagramUrl, setInstagramUrl] = useState(review.instagramUrl || '');

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Active tab for the form
  const [activeTab, setActiveTab] = useState<'tom' | 'tomer'>('tom');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate form
    if (!placeName) {
      setError('יש להזין שם מקום');
      return;
    }

    // 0 is a valid rating (means "not rated")

    try {
      setIsSubmitting(true);

      const response = await fetch(`/api/coffee-reviews/${review.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          placeName,
          // Tom's ratings
          tomCoffeeRating,
          tomFoodRating,
          tomAtmosphereRating,
          tomPriceRating,
          // Tomer's ratings
          tomerCoffeeRating,
          tomerFoodRating,
          tomerAtmosphereRating,
          tomerPriceRating,
          // Links
          photoUrl: photoUrl || undefined,
          mapsUrl: mapsUrl || undefined,
          instagramUrl: instagramUrl || undefined,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'שגיאה בעדכון הביקורת' }));
        throw new Error(errorData.error || 'שגיאה בעדכון הביקורת');
      }

      // Notify parent component
      onSuccess();

    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בעדכון הביקורת');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render ratings form for a specific reviewer
  const renderRatingForm = (reviewer: 'tom' | 'tomer') => {
    const displayName = reviewer === 'tom' ? 'תום' : 'תומר';

    // Select the appropriate state setters based on the reviewer
    const setCoffeeRating = reviewer === 'tom' ? setTomCoffeeRating : setTomerCoffeeRating;
    const setFoodRating = reviewer === 'tom' ? setTomFoodRating : setTomerFoodRating;
    const setAtmosphereRating = reviewer === 'tom' ? setTomAtmosphereRating : setTomerAtmosphereRating;
    const setPriceRating = reviewer === 'tom' ? setTomPriceRating : setTomerPriceRating;

    // Select the appropriate state values based on the reviewer
    const coffeeRating = reviewer === 'tom' ? tomCoffeeRating : tomerCoffeeRating;
    const foodRating = reviewer === 'tom' ? tomFoodRating : tomerFoodRating;
    const atmosphereRating = reviewer === 'tom' ? tomAtmosphereRating : tomerAtmosphereRating;
    const priceRating = reviewer === 'tom' ? tomPriceRating : tomerPriceRating;

    return (
      <div>
        <h3 className="text-xl font-bold text-amber-800 mb-4 text-center">הדירוג של {displayName}</h3>

        <div className="space-y-4 mb-6">
          <div>
            <ScaleBar
              label="קפה"
              rating={coffeeRating}
              onChange={setCoffeeRating}
            />
            {coffeeRating > 0 && (
              <div className="mt-1 flex justify-end">
                <RatingStars rating={coffeeRating} size="sm" />
              </div>
            )}
          </div>

          <div>
            <ScaleBar
              label="אוכל"
              rating={foodRating}
              onChange={setFoodRating}
            />
            {foodRating > 0 && (
              <div className="mt-1 flex justify-end">
                <RatingStars rating={foodRating} size="sm" />
              </div>
            )}
          </div>

          <div>
            <ScaleBar
              label="אווירה"
              rating={atmosphereRating}
              onChange={setAtmosphereRating}
            />
            {atmosphereRating > 0 && (
              <div className="mt-1 flex justify-end">
                <RatingStars rating={atmosphereRating} size="sm" />
              </div>
            )}
          </div>

          <div>
            <ScaleBar
              label="מחיר"
              rating={priceRating}
              onChange={setPriceRating}
            />
            {priceRating > 0 && (
              <div className="mt-1 flex justify-end">
                <RatingStars rating={priceRating} size="sm" />
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 border-2 border-amber-100">
      <h2 className="text-2xl font-bold text-amber-900 mb-6 text-center">עריכת ביקורת</h2>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 text-right">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="placeName" className="block text-amber-800 font-medium mb-2 text-right">
            שם בית הקפה
          </label>
          <input
            type="text"
            id="placeName"
            value={placeName}
            onChange={(e) => setPlaceName(e.target.value)}
            className="w-full px-4 py-2 border border-amber-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 text-right"
            placeholder="הזן את שם בית הקפה"
            dir="rtl"
          />
        </div>

        <div>
          <label htmlFor="mapsUrl" className="block text-amber-800 font-medium mb-2 text-right">
            קישור למפה (אופציונלי)
          </label>
          <input
            type="url"
            id="mapsUrl"
            value={mapsUrl}
            onChange={(e) => setMapsUrl(e.target.value)}
            className="w-full px-4 py-2 border border-amber-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 text-left"
            placeholder="https://maps.google.com/..."
            dir="ltr"
          />
        </div>

        <div>
          <label htmlFor="instagramUrl" className="block text-amber-800 font-medium mb-2 text-right">
            קישור לאינסטגרם (אופציונלי)
          </label>
          <input
            type="url"
            id="instagramUrl"
            value={instagramUrl}
            onChange={(e) => setInstagramUrl(e.target.value)}
            className="w-full px-4 py-2 border border-amber-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 text-left"
            placeholder="https://www.instagram.com/..."
            dir="ltr"
          />
        </div>

        <div>
          <label htmlFor="photoUrl" className="block text-amber-800 font-medium mb-2 text-right">
            קישור לתמונה (אופציונלי)
          </label>
          <input
            type="url"
            id="photoUrl"
            value={photoUrl}
            onChange={(e) => setPhotoUrl(e.target.value)}
            className="w-full px-4 py-2 border border-amber-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 text-left"
            placeholder="https://..."
            dir="ltr"
          />
          {photoUrl && (
            <div className="mt-3 relative h-48 w-full">
              <Image
                src={photoUrl}
                alt="Preview"
                fill
                className="object-cover rounded-md"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                unoptimized
              />
            </div>
          )}
        </div>

        {/* Rating tabs */}
        <div className="flex border-b border-amber-200 mb-4">
          <button
            type="button"
            className={`py-2 px-4 font-medium ${activeTab === 'tom' ? 'text-amber-700 border-b-2 border-amber-500' : 'text-amber-500 hover:text-amber-600'}`}
            onClick={() => setActiveTab('tom')}
          >
            תום
          </button>
          <button
            type="button"
            className={`py-2 px-4 font-medium ${activeTab === 'tomer' ? 'text-amber-700 border-b-2 border-amber-500' : 'text-amber-500 hover:text-amber-600'}`}
            onClick={() => setActiveTab('tomer')}
          >
            תומר
          </button>
        </div>

        {/* Display ratings form based on active tab */}
        {activeTab === 'tom' && renderRatingForm('tom')}
        {activeTab === 'tomer' && renderRatingForm('tomer')}

        <div className="flex justify-between mt-6">
          <button
            type="button"
            onClick={onCancel}
            className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-medium py-2 px-6 rounded-md transition-colors duration-200"
          >
            ביטול
          </button>

          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 px-6 rounded-md transition-colors duration-200 disabled:opacity-50 flex items-center"
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin h-5 w-5 ml-2 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                מעדכן...
              </>
            ) : (
              'שמור שינויים'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EditCoffeeReviewForm;
