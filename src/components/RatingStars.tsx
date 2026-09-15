'use client';

import React from 'react';
import { PRICE_LEVELS, priceLevelLabel, type PriceLevel } from '@/types/coffee';

interface RatingStarsProps {
  rating: number;
  maxRating?: number;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  color?: string;
}

const RatingStars: React.FC<RatingStarsProps> = ({
  rating,
  maxRating = 10,
  size = 'md',
  color = '#ffbe0b'
}) => {
  // Determine star size based on the size prop
  const starSizes = {
    xs: 'text-base',
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-3xl'
  };
  
  const starSize = starSizes[size];
  
  return (
    <div className="flex items-center">
      {[...Array(maxRating)].map((_, index) => {
        const starValue = index + 1;
        const isFilled = starValue <= rating;
        const isHalfFilled = starValue - 0.5 <= rating && starValue > rating;
        
        return (
          <span
            key={index}
            className={`${starSize} transition-colors duration-200 relative`}
            style={{ color: isFilled || isHalfFilled ? color : '#d1d5db' }}
          >
            {isHalfFilled ? '☆' : '★'}
          </span>
        );
      })}
    </div>
  );
};

interface ScaleBarProps {
  rating: number;
  onChange: (rating: number) => void;
  label?: string;
}

const ScaleBar: React.FC<ScaleBarProps> = ({ rating, onChange, label }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    // Round to nearest 0.5
    const roundedValue = Math.round(value * 2) / 2;
    onChange(roundedValue);
  };

  return (
    <div className="flex items-center gap-4">
      {label && <span className="text-amber-700 min-w-[60px]">{label}:</span>}
      <input
        type="range"
        min="1"
        max="10"
        step="0.5"
        value={rating}
        onChange={handleChange}
        className="w-full h-2 bg-amber-200 rounded-lg appearance-none cursor-pointer"
      />
      <span className="text-amber-600 min-w-[40px] text-right">{rating.toFixed(1)}</span>
    </div>
  );
};

interface PriceLevelSliderProps {
  value: PriceLevel | undefined;
  onChange: (value: PriceLevel | undefined) => void;
  label?: string;
}

// Non-numeric price-level slider: position 0 = "not specified", 1..5 = the
// PRICE_LEVELS in order (most expensive → cheapest). The readout is the source
// of truth for the current choice, so RTL slider direction doesn't matter.
const PriceLevelSlider: React.FC<PriceLevelSliderProps> = ({ value, onChange, label }) => {
  const pos = value ? PRICE_LEVELS.findIndex((l) => l.id === value) + 1 : 0;
  const current = priceLevelLabel(value) ?? 'לא צוין';

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const p = parseInt(e.target.value, 10);
    onChange(p === 0 ? undefined : PRICE_LEVELS[p - 1].id);
  };

  return (
    <div className="flex items-center gap-4">
      {label && <span className="text-amber-700 min-w-[60px]">{label}:</span>}
      <input
        type="range"
        min="0"
        max="5"
        step="1"
        value={pos}
        onChange={handleChange}
        aria-label={label}
        className="w-full h-2 bg-amber-200 rounded-lg appearance-none cursor-pointer"
      />
      <span
        className={`min-w-[72px] text-right ${value ? 'text-amber-700 font-medium' : 'text-amber-400'}`}
      >
        {current}
      </span>
    </div>
  );
};

export { RatingStars, ScaleBar, PriceLevelSlider };