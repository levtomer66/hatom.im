'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { CoffeeReview, CombinedReviewScores, ReviewerScores } from '@/types/coffee';
import { RatingStars } from './RatingStars';
import EditCoffeeReviewForm from './EditCoffeeReviewForm';

interface CoffeeReviewCardProps {
  review: CoffeeReview;
  onDelete: (id: string) => Promise<void>;
  onUpdate: () => void;
  rank?: number;
}

const CoffeeReviewCard: React.FC<CoffeeReviewCardProps> = ({ review, onDelete, onUpdate, rank }) => {
  const [imageError, setImageError] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'tom' | 'tomer'>('overview');
  
  // Calculate review scores
  const getReviewerScores = (prefix: 'tom' | 'tomer'): ReviewerScores => {
    // Ensure ratings exist or provide fallbacks
    const coffeeRating = review[`${prefix}CoffeeRating`] ?? 0;
    const foodRating = review[`${prefix}FoodRating`] ?? 0;
    const atmosphereRating = review[`${prefix}AtmosphereRating`] ?? 0;
    const priceRating = review[`${prefix}PriceRating`] ?? 0;
    
    const averageRating = (coffeeRating + foodRating + atmosphereRating + priceRating) / 4;
    
    return {
      coffeeRating,
      foodRating,
      atmosphereRating,
      priceRating,
      averageRating
    };
  };
  
  // Get scores for Tom and Tomer
  const tomScores = getReviewerScores('tom');
  const tomerScores = getReviewerScores('tomer');
  
  // Calculate combined/average scores
  const combinedScores: CombinedReviewScores = {
    tom: tomScores,
    tomer: tomerScores,
    average: {
      coffeeRating: (tomScores.coffeeRating + tomerScores.coffeeRating) / 2,
      foodRating: (tomScores.foodRating + tomerScores.foodRating) / 2,
      atmosphereRating: (tomScores.atmosphereRating + tomerScores.atmosphereRating) / 2,
      priceRating: (tomScores.priceRating + tomerScores.priceRating) / 2,
      totalAverage: (tomScores.averageRating + tomerScores.averageRating) / 2
    }
  };
  
  // Format date
  const formattedDate = new Date(review.createdAt).toLocaleDateString('he-IL', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Get medal emoji based on rank
  const getMedal = (rank?: number) => {
    if (!rank) return null;
    switch (rank) {
      case 1: return '🥇';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return null;
    }
  };

  const handleDelete = async () => {
    if (window.confirm('האם אתה בטוח שברצונך למחוק ביקורת זו?')) {
      try {
        setIsDeleting(true);
        setDeleteError(null);
        await onDelete(review.id);
      } catch (deletedError) {
        setDeleteError('שגיאה במחיקת הביקורת');
        setIsDeleting(false);
        console.error('Error deleting coffee review:', deletedError);
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
  
  // Render ratings for a reviewer
  const renderReviewerRatings = (reviewer: 'tom' | 'tomer', scores: ReviewerScores) => {
    const displayName = reviewer === 'tom' ? 'תום' : 'תומר';
    
    return (
      <div className="space-y-2 mb-4">
        <div className="flex justify-between items-center">
          <span className="text-amber-700">קפה:</span>
          <div className="flex items-center">
            <span className="text-sm text-amber-600 mr-2">{scores.coffeeRating.toFixed(1)}</span>
            <RatingStars rating={scores.coffeeRating} size="sm" />
          </div>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-amber-700">אוכל:</span>
          <div className="flex items-center">
            <span className="text-sm text-amber-600 mr-2">{scores.foodRating.toFixed(1)}</span>
            <RatingStars rating={scores.foodRating} size="sm" />
          </div>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-amber-700">אווירה:</span>
          <div className="flex items-center">
            <span className="text-sm text-amber-600 mr-2">{scores.atmosphereRating.toFixed(1)}</span>
            <RatingStars rating={scores.atmosphereRating} size="sm" />
          </div>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-amber-700">מחיר:</span>
          <div className="flex items-center">
            <span className="text-sm text-amber-600 mr-2">{scores.priceRating.toFixed(1)}</span>
            <RatingStars rating={scores.priceRating} size="sm" />
          </div>
        </div>
        
        <div className="flex justify-between items-center mt-3 pt-2 border-t border-amber-100">
          <span className="text-amber-800 font-medium">ממוצע {displayName}:</span>
          <div className="flex items-center">
            <span className="text-sm font-bold text-amber-700 mr-2">{scores.averageRating.toFixed(1)}</span>
            <RatingStars rating={scores.averageRating} size="sm" />
          </div>
        </div>
      </div>
    );
  };
  
  // Render overview/combined ratings
  const renderOverviewRatings = () => {
    return (
      <div className="space-y-2 mb-4">
        <div className="flex justify-between items-center">
          <span className="text-amber-700">קפה:</span>
          <div className="flex items-center">
            <span className="text-sm text-amber-600 mr-2">{combinedScores.average.coffeeRating.toFixed(1)}</span>
            <RatingStars rating={combinedScores.average.coffeeRating} size="sm" />
          </div>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-amber-700">אוכל:</span>
          <div className="flex items-center">
            <span className="text-sm text-amber-600 mr-2">{combinedScores.average.foodRating.toFixed(1)}</span>
            <RatingStars rating={combinedScores.average.foodRating} size="sm" />
          </div>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-amber-700">אווירה:</span>
          <div className="flex items-center">
            <span className="text-sm text-amber-600 mr-2">{combinedScores.average.atmosphereRating.toFixed(1)}</span>
            <RatingStars rating={combinedScores.average.atmosphereRating} size="sm" />
          </div>
        </div>
        
        <div className="flex justify-between items-center">
          <span className="text-amber-700">מחיר:</span>
          <div className="flex items-center">
            <span className="text-sm text-amber-600 mr-2">{combinedScores.average.priceRating.toFixed(1)}</span>
            <RatingStars rating={combinedScores.average.priceRating} size="sm" />
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-4 mt-4 pt-3 border-t border-amber-100">
          <div className="flex flex-col items-center">
            <span className="text-amber-800 font-medium mb-1">תום</span>
            <div className="flex items-center">
              <span className="text-sm font-bold text-amber-700 mr-1">{tomScores.averageRating.toFixed(1)}</span>
              <RatingStars rating={tomScores.averageRating} size="xs" />
            </div>
          </div>
          
          <div className="flex flex-col items-center">
            <span className="text-amber-800 font-medium mb-1">תומר</span>
            <div className="flex items-center">
              <span className="text-sm font-bold text-amber-700 mr-1">{tomerScores.averageRating.toFixed(1)}</span>
              <RatingStars rating={tomerScores.averageRating} size="xs" />
            </div>
          </div>
        </div>
      </div>
    );
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
      {/* Medal */}
      {rank && rank <= 3 && (
        <div className="absolute top-2 right-2 z-10 text-4xl">
          {getMedal(rank)}
        </div>
      )}
      
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
        {(review.photoData || review.photoUrl) && !imageError ? (
          <Image
            src={review.photoData ? `/api/coffee-reviews/${review.id}/image` : (review.photoUrl || '')}
            alt={review.placeName}
            fill
            className="object-cover"
            onError={() => setImageError(true)}
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
      </div>
      
      <div className="p-6">
        <h3 className="text-2xl font-bold text-amber-900 mb-2">{review.placeName}</h3>
        
        <div className="flex items-center mb-4">
          <span className="text-lg font-semibold text-amber-800 mr-2">
            {combinedScores.average.totalAverage.toFixed(1)}
          </span>
          <RatingStars rating={combinedScores.average.totalAverage} size="sm" />
        </div>
        
        {/* Review Tabs */}
        <div className="flex border-b border-amber-200 mb-4">
          <button 
            className={`py-2 px-4 font-medium ${activeTab === 'overview' ? 'text-amber-700 border-b-2 border-amber-500' : 'text-amber-500 hover:text-amber-600'}`}
            onClick={() => setActiveTab('overview')}
          >
            סיכום
          </button>
          <button 
            className={`py-2 px-4 font-medium ${activeTab === 'tom' ? 'text-amber-700 border-b-2 border-amber-500' : 'text-amber-500 hover:text-amber-600'}`}
            onClick={() => setActiveTab('tom')}
          >
            תום
          </button>
          <button 
            className={`py-2 px-4 font-medium ${activeTab === 'tomer' ? 'text-amber-700 border-b-2 border-amber-500' : 'text-amber-500 hover:text-amber-600'}`}
            onClick={() => setActiveTab('tomer')}
          >
            תומר
          </button>
        </div>
        
        {/* Display ratings based on active tab */}
        {activeTab === 'overview' && renderOverviewRatings()}
        {activeTab === 'tom' && renderReviewerRatings('tom', tomScores)}
        {activeTab === 'tomer' && renderReviewerRatings('tomer', tomerScores)}
        
        <div className="text-right text-sm text-gray-500 mt-4">
          נוסף בתאריך: {formattedDate}
        </div>
      </div>
    </div>
  );
};

export default CoffeeReviewCard; 