'use client';

import React from 'react';

interface RatingStarsProps {
  rating: number;
  maxRating?: number;
  size?: 'sm' | 'md' | 'lg';
  color?: string;
  editable?: boolean;
  onChange?: (rating: number) => void;
}

const RatingStars: React.FC<RatingStarsProps> = ({
  rating,
  maxRating = 5,
  size = 'md',
  color = '#ffbe0b',
  editable = false,
  onChange
}) => {
  // Determine star size based on the size prop
  const starSizes = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-3xl'
  };
  
  const starSize = starSizes[size];
  
  // Handle star click for editable ratings
  const handleStarClick = (selectedRating: number) => {
    if (editable && onChange) {
      onChange(selectedRating);
    }
  };
  
  return (
    <div className="flex items-center">
      {[...Array(maxRating)].map((_, index) => {
        const starValue = index + 1;
        const isFilled = starValue <= rating;
        
        return (
          <span
            key={index}
            className={`${starSize} ${editable ? 'cursor-pointer' : ''} transition-colors duration-200`}
            style={{ color: isFilled ? color : '#d1d5db' }}
            onClick={() => handleStarClick(starValue)}
            onMouseEnter={editable ? () => {} : undefined}
          >
            ★
          </span>
        );
      })}
    </div>
  );
};

export default RatingStars; 