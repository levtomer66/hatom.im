'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { CoffeeReview } from '@/types/coffee';
import RatingStars from './RatingStars';
import EditCoffeeReviewForm from './EditCoffeeReviewForm';

interface CoffeeReviewCardProps {
  review: CoffeeReview;
  onDelete: (id: string) => Promise<void>;
  onUpdate: () => void;
}

const CoffeeReviewCard: React.FC<CoffeeReviewCardProps> = ({ review, onDelete, onUpdate }) => {
  const [imageError, setImageError] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  
  // Calculate average rating
  const averageRating = (
    review.coffeeRating + 
    review.foodRating + 
    review.atmosphereRating + 
    review.priceRating
  ) / 4;
  
  // Format date
  const formattedDate = new Date(review.createdAt).toLocaleDateString('he-IL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const handleDelete = async () => {
    if (window.confirm('האם אתה בטוח שברצונך למחוק ביקורת זו?')) {
      try {
        setIsDeleting(true);
        setDeleteError(null);
        await onDelete(review.id);
      } catch (error) {
        setDeleteError('שגיאה במחיקת הביקורת');
        setIsDeleting(false);
      }
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const handleUpdateSuccess = () => {
    setIsEditing(false);
    onUpdate();
  };
  
  if (isEditing) {
    return <EditCoffeeReviewForm 
      review={review} 
      onSuccess={handleUpdateSuccess} 
      onCancel={handleCancelEdit} 
    />;
  }
  
  return (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden transition-transform duration-300 hover:transform hover:scale-102 border-2 border-amber-100 relative">
      {/* Action buttons */}
      <div className="absolute top-2 left-2 flex space-x-2 z-10">
        <button
          onClick={handleEdit}
          className="bg-amber-500 hover:bg-amber-600 text-white rounded-full p-2 transition-colors duration-200 shadow-md"
          aria-label="Edit review"
          title="ערוך ביקורת"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
          </svg>
        </button>
        <button
          onClick={handleDelete}
          disabled={isDeleting}
          className="bg-red-500 hover:bg-red-600 text-white rounded-full p-2 transition-colors duration-200 shadow-md disabled:opacity-50"
          aria-label="Delete review"
          title="מחק ביקורת"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        </button>
      </div>
      
      {deleteError && (
        <div className="absolute top-2 right-2 bg-red-100 border border-red-400 text-red-700 px-2 py-1 rounded text-sm z-10">
          {deleteError}
        </div>
      )}
      
      <div className="relative h-48 w-full bg-amber-50">
        {review.photoUrl && !imageError ? (
          <Image
            src={review.photoUrl}
            alt={review.placeName}
            fill
            className="object-cover"
            onError={() => setImageError(true)}
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <span className="text-6xl">☕</span>
          </div>
        )}
      </div>
      
      <div className="p-6">
        <h3 className="text-2xl font-bold text-amber-900 mb-2">{review.placeName}</h3>
        
        <div className="flex items-center mb-4">
          <span className="text-lg font-semibold text-amber-800 mr-2">
            {averageRating.toFixed(1)}
          </span>
          <RatingStars rating={Math.round(averageRating)} size="sm" />
        </div>
        
        <div className="space-y-2 mb-4">
          <div className="flex justify-between items-center">
            <span className="text-amber-700">קפה:</span>
            <RatingStars rating={review.coffeeRating} size="sm" />
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-amber-700">אוכל:</span>
            <RatingStars rating={review.foodRating} size="sm" />
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-amber-700">אווירה:</span>
            <RatingStars rating={review.atmosphereRating} size="sm" />
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-amber-700">מחיר:</span>
            <RatingStars rating={review.priceRating} size="sm" />
          </div>
        </div>
        
        <div className="text-right text-sm text-gray-500 mt-4">
          נוסף בתאריך: {formattedDate}
        </div>
      </div>
    </div>
  );
};

export default CoffeeReviewCard; 