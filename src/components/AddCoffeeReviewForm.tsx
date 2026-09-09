'use client';

import React, { useState } from 'react';
import { RatingStars, ScaleBar } from './RatingStars';
import { COFFEE_CATEGORIES, type CoffeeCategory } from '@/types/coffee';

interface AddCoffeeReviewFormProps {
  onSuccess: () => void;
}

const AddCoffeeReviewForm: React.FC<AddCoffeeReviewFormProps> = ({ onSuccess }) => {
  const [placeName, setPlaceName] = useState('');
  // Tom's ratings
  const [tomCoffeeRating, setTomCoffeeRating] = useState(0);
  const [tomFoodRating, setTomFoodRating] = useState(0);
  const [tomAtmosphereRating, setTomAtmosphereRating] = useState(0);
  const [tomPriceRating, setTomPriceRating] = useState(0);
  // Tomer's ratings
  const [tomerCoffeeRating, setTomerCoffeeRating] = useState(0);
  const [tomerFoodRating, setTomerFoodRating] = useState(0);
  const [tomerAtmosphereRating, setTomerAtmosphereRating] = useState(0);
  const [tomerPriceRating, setTomerPriceRating] = useState(0);
  const [photoUrl, setPhotoUrl] = useState('');
  const [mapsUrl, setMapsUrl] = useState('');
  const [instagramUrl, setInstagramUrl] = useState('');
  // Per-place, not per-reviewer: a café with no kitchen has no food score for
  // either of us. Toggling one off removes its slider from BOTH tabs.
  const [disabledCategories, setDisabledCategories] = useState<CoffeeCategory[]>([]);

  const toggleCategory = (id: CoffeeCategory) => {
    setDisabledCategories((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

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

      const response = await fetch('/api/coffee-reviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          placeName,
          disabledCategories,
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
        const errorData = await response.json();
        throw new Error(errorData.error || 'שגיאה בשמירת הביקורת');
      }

      // Reset form
      setPlaceName('');
      // Reset Tom's ratings
      setTomCoffeeRating(0);
      setTomFoodRating(0);
      setTomAtmosphereRating(0);
      setTomPriceRating(0);
      // Reset Tomer's ratings
      setTomerCoffeeRating(0);
      setTomerFoodRating(0);
      setTomerAtmosphereRating(0);
      setTomerPriceRating(0);
      // Reset link fields
      setPhotoUrl('');
      setMapsUrl('');
      setInstagramUrl('');
      setDisabledCategories([]);

      // Notify parent component
      onSuccess();

    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בשמירת הביקורת');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Render ratings form for a specific reviewer
  const renderRatingForm = (reviewer: 'tom' | 'tomer') => {
    const displayName = reviewer === 'tom' ? 'תום' : 'תומר';

    const ratings: Record<CoffeeCategory, number> = reviewer === 'tom'
      ? { coffee: tomCoffeeRating, food: tomFoodRating, atmosphere: tomAtmosphereRating, price: tomPriceRating }
      : { coffee: tomerCoffeeRating, food: tomerFoodRating, atmosphere: tomerAtmosphereRating, price: tomerPriceRating };

    const setters: Record<CoffeeCategory, (v: number) => void> = reviewer === 'tom'
      ? { coffee: setTomCoffeeRating, food: setTomFoodRating, atmosphere: setTomAtmosphereRating, price: setTomPriceRating }
      : { coffee: setTomerCoffeeRating, food: setTomerFoodRating, atmosphere: setTomerAtmosphereRating, price: setTomerPriceRating };

    // A disabled category's stored rating is deliberately left alone — it is
    // just not shown and not scored, so un-ticking the pill brings it back.
    const active = COFFEE_CATEGORIES.filter((c) => !disabledCategories.includes(c.id));

    return (
      <div>
        <h3 className="text-xl font-bold text-amber-800 mb-4 text-center">הדירוג של {displayName}</h3>

        <div className="space-y-4 mb-6">
          {active.map((c) => (
            <div key={c.id}>
              <ScaleBar label={c.label} rating={ratings[c.id]} onChange={setters[c.id]} />
              {ratings[c.id] > 0 && (
                <div className="mt-1 flex justify-end">
                  <RatingStars rating={ratings[c.id]} size="sm" />
                </div>
              )}
            </div>
          ))}
          {active.length === 0 && (
            <p className="text-amber-600 text-center text-sm">כל הקטגוריות מושבתות במקום הזה</p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 border-2 border-amber-100">
      <h2 className="text-2xl font-bold text-amber-900 mb-6 text-center">הוספת ביקורת קפה חדשה</h2>

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
        </div>

        {/* Place-level, deliberately above the reviewer tabs: this is a fact
            about the café, not about either reviewer's visit. */}
        <div>
          <label className="block text-amber-800 font-medium mb-2 text-right">
            מה לא נמדד במקום הזה?
          </label>
          <div className="flex flex-wrap gap-2 justify-end" dir="rtl">
            {COFFEE_CATEGORIES.map((c) => {
              const off = disabledCategories.includes(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => toggleCategory(c.id)}
                  aria-pressed={off}
                  className={`px-3 py-1 rounded-full border text-sm transition-colors duration-150 ${
                    off
                      ? 'bg-amber-700 border-amber-700 text-white'
                      : 'bg-white border-amber-300 text-amber-700 hover:bg-amber-50'
                  }`}
                >
                  {off ? `✓ ${c.label}` : c.label}
                </button>
              );
            })}
          </div>
          <p className="text-xs text-amber-600 mt-1 text-right">
            מסומן = לא נספר בדירוג הכללי
          </p>
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

        {/* Submit button */}
        <div className="flex justify-center">
          <button
            type="submit"
            disabled={isSubmitting}
            className="bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 px-8 rounded-lg transition-colors duration-200 disabled:opacity-50 flex items-center"
          >
            {isSubmitting ? (
              <>
                <svg className="animate-spin h-5 w-5 ml-2 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                שומר...
              </>
            ) : (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-2" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                שמור ביקורת
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddCoffeeReviewForm;
