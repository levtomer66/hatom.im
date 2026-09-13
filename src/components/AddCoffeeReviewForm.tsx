'use client';

import React, { useState } from 'react';
import CoffeeReviewFormFields from './CoffeeReviewFormFields';
import { useCoffeeReviewForm } from '@/lib/useCoffeeReviewForm';

interface AddCoffeeReviewFormProps {
  onSuccess: () => void;
}

const AddCoffeeReviewForm: React.FC<AddCoffeeReviewFormProps> = ({ onSuccess }) => {
  const form = useCoffeeReviewForm();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate form
    if (!form.placeName) {
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
        body: JSON.stringify(form.buildBody()),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'שגיאה בשמירת הביקורת');
      }

      // Reset form
      form.reset();

      // Notify parent component
      onSuccess();

    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בשמירת הביקורת');
    } finally {
      setIsSubmitting(false);
    }
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
        <CoffeeReviewFormFields form={form} />

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
