'use client';

import React from 'react';

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

export { RatingStars, ScaleBar }; 