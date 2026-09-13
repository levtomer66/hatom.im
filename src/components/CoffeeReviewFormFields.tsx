'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { RatingStars, ScaleBar } from './RatingStars';
import { COFFEE_CATEGORIES, type CoffeeCategory } from '@/types/coffee';
import type { CoffeeReviewFormState } from '@/lib/useCoffeeReviewForm';

interface CoffeeReviewFormFieldsProps {
  form: CoffeeReviewFormState;
  // EditCoffeeReviewForm shows a live photo preview under the URL field;
  // AddCoffeeReviewForm never did. Preserved as-is by this refactor — not a
  // new behavior, just made explicit since the field is now shared.
  showPhotoPreview?: boolean;
}

const CoffeeReviewFormFields: React.FC<CoffeeReviewFormFieldsProps> = ({
  form,
  showPhotoPreview = false,
}) => {
  const {
    placeName, setPlaceName,
    tomCoffeeRating, setTomCoffeeRating,
    tomFoodRating, setTomFoodRating,
    tomPastryRating, setTomPastryRating,
    tomAtmosphereRating, setTomAtmosphereRating,
    tomPriceRating, setTomPriceRating,
    tomerCoffeeRating, setTomerCoffeeRating,
    tomerFoodRating, setTomerFoodRating,
    tomerPastryRating, setTomerPastryRating,
    tomerAtmosphereRating, setTomerAtmosphereRating,
    tomerPriceRating, setTomerPriceRating,
    photoUrl, setPhotoUrl,
    mapsUrl, setMapsUrl,
    instagramUrl, setInstagramUrl,
    disabledCategories, toggleCategory,
  } = form;

  // Active tab for the form
  const [activeTab, setActiveTab] = useState<'tom' | 'tomer'>('tom');

  // Render ratings form for a specific reviewer
  const renderRatingForm = (reviewer: 'tom' | 'tomer') => {
    const displayName = reviewer === 'tom' ? 'תום' : 'תומר';

    const ratings: Record<CoffeeCategory, number> = reviewer === 'tom'
      ? { coffee: tomCoffeeRating, food: tomFoodRating, pastry: tomPastryRating, atmosphere: tomAtmosphereRating, price: tomPriceRating }
      : { coffee: tomerCoffeeRating, food: tomerFoodRating, pastry: tomerPastryRating, atmosphere: tomerAtmosphereRating, price: tomerPriceRating };

    const setters: Record<CoffeeCategory, (v: number) => void> = reviewer === 'tom'
      ? { coffee: setTomCoffeeRating, food: setTomFoodRating, pastry: setTomPastryRating, atmosphere: setTomAtmosphereRating, price: setTomPriceRating }
      : { coffee: setTomerCoffeeRating, food: setTomerFoodRating, pastry: setTomerPastryRating, atmosphere: setTomerAtmosphereRating, price: setTomerPriceRating };

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
    <>
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
        {showPhotoPreview && photoUrl && (
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
    </>
  );
};

export default CoffeeReviewFormFields;
