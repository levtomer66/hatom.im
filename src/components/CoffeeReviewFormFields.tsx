'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { RatingStars, ScaleBar } from './RatingStars';
import { COFFEE_CATEGORIES, COFFEE_TAGS, COFFEE_AREAS, type CoffeeCategory } from '@/types/coffee';
import type { CoffeeReviewFormState } from '@/lib/useCoffeeReviewForm';

// א = Sunday (index 0) … ש = Saturday (index 6), matching OpeningHours.
const DAY_LABELS = ['א', 'ב', 'ג', 'ד', 'ה', 'ו', 'ש'];

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
    coffeePriceIls, setCoffeePriceIls,
    coffeeDrinkLabel, setCoffeeDrinkLabel,
    triedItems, addTriedItem, removeTriedItem, updateTriedItem,
    tags, toggleTag,
    area, setArea,
    openingHours, setOpeningHoursDay,
    tomNotes, setTomNotes,
    tomerNotes, setTomerNotes,
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

    const notes = reviewer === 'tom' ? tomNotes : tomerNotes;
    const setNotes = reviewer === 'tom' ? setTomNotes : setTomerNotes;

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

        <div>
          <label
            htmlFor={`${reviewer}Notes`}
            className="block text-amber-800 font-medium mb-2 text-right"
          >
            הערות של {displayName}
          </label>
          <textarea
            id={`${reviewer}Notes`}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            maxLength={500}
            rows={4}
            className="w-full px-4 py-2 border border-amber-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 text-right"
            placeholder="איך היה הביקור?"
            dir="rtl"
          />
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

      {/* Place-level fields (Task 12), deliberately above the reviewer tabs:
          these are facts about the café, not about either reviewer's visit. */}
      <div className="flex gap-4" dir="rtl">
        <div className="flex-1">
          <label htmlFor="coffeePriceIls" className="block text-amber-800 font-medium mb-2 text-right">
            מחיר קפה (₪)
          </label>
          <input
            type="number"
            id="coffeePriceIls"
            min={0}
            value={coffeePriceIls}
            onChange={(e) => setCoffeePriceIls(e.target.value === '' ? '' : Number(e.target.value))}
            className="w-full px-4 py-2 border border-amber-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 text-right"
            placeholder="16"
          />
        </div>
        <div className="flex-1">
          <label htmlFor="coffeeDrinkLabel" className="block text-amber-800 font-medium mb-2 text-right">
            סוג המשקה
          </label>
          <input
            type="text"
            id="coffeeDrinkLabel"
            value={coffeeDrinkLabel}
            onChange={(e) => setCoffeeDrinkLabel(e.target.value)}
            maxLength={40}
            className="w-full px-4 py-2 border border-amber-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 text-right"
            placeholder="הפוך גדול"
            dir="rtl"
          />
        </div>
      </div>

      <div>
        <label className="block text-amber-800 font-medium mb-2 text-right">
          תגיות
        </label>
        <div className="flex flex-wrap gap-2 justify-end" dir="rtl">
          {COFFEE_TAGS.map((t) => {
            const on = tags.includes(t.id);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => toggleTag(t.id)}
                aria-pressed={on}
                className={`px-3 py-1 rounded-full border text-sm transition-colors duration-150 ${
                  on
                    ? 'bg-amber-700 border-amber-700 text-white'
                    : 'bg-white border-amber-300 text-amber-700 hover:bg-amber-50'
                }`}
              >
                {t.emoji} {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <label htmlFor="area" className="block text-amber-800 font-medium mb-2 text-right">
          אזור
        </label>
        <select
          id="area"
          value={area}
          onChange={(e) => setArea(e.target.value)}
          className="w-full px-4 py-2 border border-amber-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 text-right"
          dir="rtl"
        >
          <option value="">בחר אזור</option>
          {COFFEE_AREAS.map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-amber-800 font-medium mb-2 text-right">
          מה טעמתם?
        </label>
        <div className="space-y-2">
          {triedItems.map((item, i) => (
            <div key={i} className="flex gap-2 items-center" dir="rtl">
              <input
                type="text"
                value={item.name}
                onChange={(e) => updateTriedItem(i, { name: e.target.value })}
                className="flex-1 px-3 py-1.5 border border-amber-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 text-right"
                placeholder="שם הפריט"
                dir="rtl"
              />
              <input
                type="number"
                min={0}
                value={item.priceIls ?? ''}
                onChange={(e) =>
                  updateTriedItem(i, {
                    priceIls: e.target.value === '' ? undefined : Number(e.target.value),
                  })
                }
                className="w-20 px-3 py-1.5 border border-amber-300 rounded-md focus:outline-none focus:ring-2 focus:ring-amber-500 text-right"
                placeholder="₪"
              />
              <button
                type="button"
                onClick={() => removeTriedItem(i)}
                aria-label="הסר פריט"
                className="text-amber-500 hover:text-red-600 px-2"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addTriedItem}
          className="mt-2 text-amber-700 hover:text-amber-900 text-sm font-medium"
        >
          ＋ הוסף פריט
        </button>
      </div>

      <details className="border border-amber-200 rounded-md p-3">
        <summary className="text-amber-800 font-medium cursor-pointer text-right">
          שעות פתיחה
        </summary>
        <div className="mt-3 space-y-2">
          {DAY_LABELS.map((label, i) => {
            const dayHours = openingHours[i];
            const closed = dayHours === null;
            return (
              <div key={i} className="flex items-center gap-2" dir="rtl">
                <span className="w-4 text-amber-800 font-medium text-center">{label}</span>
                <label className="flex items-center gap-1 text-sm text-amber-700">
                  <input
                    type="checkbox"
                    checked={closed}
                    onChange={(e) =>
                      setOpeningHoursDay(i, e.target.checked ? null : { open: '09:00', close: '18:00' })
                    }
                  />
                  סגור
                </label>
                <input
                  type="time"
                  value={dayHours?.open ?? ''}
                  disabled={closed}
                  onChange={(e) => setOpeningHoursDay(i, { open: e.target.value, close: dayHours?.close ?? '' })}
                  className="px-2 py-1 border border-amber-300 rounded-md disabled:bg-amber-50 disabled:text-amber-300"
                />
                <span className="text-amber-600">–</span>
                <input
                  type="time"
                  value={dayHours?.close ?? ''}
                  disabled={closed}
                  onChange={(e) => setOpeningHoursDay(i, { open: dayHours?.open ?? '', close: e.target.value })}
                  className="px-2 py-1 border border-amber-300 rounded-md disabled:bg-amber-50 disabled:text-amber-300"
                />
              </div>
            );
          })}
        </div>
      </details>

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
