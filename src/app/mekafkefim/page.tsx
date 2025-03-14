'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import CoffeeReviewCard from '@/components/CoffeeReviewCard';
import AddCoffeeReviewForm from '@/components/AddCoffeeReviewForm';
import { CoffeeReview } from '@/types/coffee';

export default function MekafkefimPage() {
  const [reviews, setReviews] = useState<CoffeeReview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);

  // Fetch coffee reviews
  const fetchReviews = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/coffee-reviews');
      
      if (!response.ok) {
        throw new Error('Failed to fetch coffee reviews');
      }
      
      const data = await response.json();
      setReviews(data);
    } catch (err) {
      console.error('Error fetching reviews:', err);
      setError('Failed to load coffee reviews. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  // Load reviews on component mount
  useEffect(() => {
    fetchReviews();
  }, []);

  // Handle successful review submission
  const handleReviewAdded = () => {
    setShowAddForm(false);
    fetchReviews();
  };

  // Handle review deletion
  const handleDeleteReview = async (id: string) => {
    try {
      const response = await fetch(`/api/coffee-reviews/${id}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete review');
      }
      
      // Refresh the reviews list
      fetchReviews();
    } catch (err) {
      console.error('Error deleting review:', err);
      throw err;
    }
  };

  // Handle review update
  const handleUpdateReview = () => {
    fetchReviews();
  };

  return (
    <>
      <Navbar />
      
      <div className="coffee-theme-bg min-h-screen py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-amber-900 mb-4">מקפקפים ☕</h1>
            <p className="text-xl text-amber-800 max-w-3xl mx-auto">
              המדריך השלם לבתי הקפה הטובים ביותר - דירוגים, ביקורות והמלצות
            </p>
            
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="mt-6 bg-amber-600 hover:bg-amber-700 text-white font-bold py-3 px-6 rounded-lg transition-colors duration-200 flex items-center mx-auto"
            >
              {showAddForm ? 'סגור טופס' : '➕ הוסף ביקורת חדשה'}
            </button>
          </div>
          
          {/* Add Review Form */}
          {showAddForm && (
            <div className="max-w-2xl mx-auto mb-12">
              <AddCoffeeReviewForm onSuccess={handleReviewAdded} />
            </div>
          )}
          
          {/* Reviews Grid */}
          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-amber-600"></div>
            </div>
          ) : error ? (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded text-center max-w-2xl mx-auto">
              {error}
            </div>
          ) : reviews.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">☕</div>
              <h3 className="text-2xl font-bold text-amber-800 mb-2">אין ביקורות עדיין</h3>
              <p className="text-amber-700">היה הראשון להוסיף ביקורת על בית קפה!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {reviews.map((review) => (
                <CoffeeReviewCard 
                  key={review.id} 
                  review={review} 
                  onDelete={handleDeleteReview}
                  onUpdate={handleUpdateReview}
                />
              ))}
            </div>
          )}
        </div>
      </div>
      
      {/* Coffee-themed decorative elements */}
      <div className="coffee-beans">
        {[...Array(15)].map((_, i) => (
          <div 
            key={i} 
            className="coffee-bean"
            style={{
              top: `${Math.random() * 100}%`,
              left: `${Math.random() * 100}%`,
              transform: `rotate(${Math.random() * 360}deg)`,
              opacity: 0.1 + Math.random() * 0.1
            }}
          >
            ☕
          </div>
        ))}
      </div>
      
      <style jsx>{`
        .coffee-theme-bg {
          background-color: #f5f0e8;
          background-image: radial-gradient(#d4b996 0.5px, transparent 0.5px), radial-gradient(#d4b996 0.5px, #f5f0e8 0.5px);
          background-size: 20px 20px;
          background-position: 0 0, 10px 10px;
        }
        
        .coffee-beans {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          z-index: -1;
          pointer-events: none;
        }
        
        .coffee-bean {
          position: absolute;
          font-size: 2rem;
          color: #6f4e37;
          z-index: -1;
        }
      `}</style>
    </>
  );
} 