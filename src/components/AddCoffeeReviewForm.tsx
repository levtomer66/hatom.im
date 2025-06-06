'use client';

import React, { useState, useRef } from 'react';
import { RatingStars, ScaleBar } from './RatingStars';
import Image from 'next/image';

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
  // Image fields
  const [photoData, setPhotoData] = useState<string | undefined>(undefined);
  const [photoType, setPhotoType] = useState<string | undefined>(undefined);
  const [photoName, setPhotoName] = useState<string | undefined>(undefined);
  const [photoSize, setPhotoSize] = useState<number | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  // Active tab for the form
  const [activeTab, setActiveTab] = useState<'tom' | 'tomer'>('tom');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    // Validate form
    if (!placeName) {
      setError('יש להזין שם מקום');
      return;
    }
    
    // Validate Tom's ratings
    if (tomCoffeeRating === 0 || tomFoodRating === 0 || tomAtmosphereRating === 0 || tomPriceRating === 0) {
      setError('יש לדרג את כל הקטגוריות עבור תום');
      setActiveTab('tom');
      return;
    }
    
    // Validate Tomer's ratings
    if (tomerCoffeeRating === 0 || tomerFoodRating === 0 || tomerAtmosphereRating === 0 || tomerPriceRating === 0) {
      setError('יש לדרג את כל הקטגוריות עבור תומר');
      setActiveTab('tomer');
      return;
    }
    
    try {
      setIsSubmitting(true);
      
      const response = await fetch('/api/coffee-reviews', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          placeName,
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
          // Image data
          photoData,
          photoType,
          photoName,
          photoSize,
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
      // Reset image fields
      setPhotoData(undefined);
      setPhotoType(undefined);
      setPhotoName(undefined);
      setPhotoSize(undefined);
      setPreviewUrl(null);
      
      // Notify parent component
      onSuccess();
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'שגיאה בשמירת הביקורת');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFileProcess = async (file: File) => {
    try {
      setUploadError(null);
      setIsUploading(true);
      
      // Create a preview URL for the selected image
      const objectUrl = URL.createObjectURL(file);
      setPreviewUrl(objectUrl);
      
      // Convert file to base64
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          // Get the base64 string (remove the data URL prefix)
          const base64String = e.target.result.toString();
          const base64Data = base64String.split(',')[1]; // Remove the "data:image/jpeg;base64," part
          
          // Store the image data
          setPhotoData(base64Data);
          setPhotoType(file.type);
          setPhotoName(file.name);
          setPhotoSize(file.size);
        }
      };
      reader.onerror = () => {
        setUploadError('שגיאה בקריאת הקובץ');
        setPreviewUrl(null);
      };
      reader.readAsDataURL(file);
      
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'שגיאה בעיבוד התמונה');
      setPreviewUrl(null);
    } finally {
      setIsUploading(false);
    }
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileProcess(file);
    }
  };
  
  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };
  
  const triggerCameraInput = () => {
    cameraInputRef.current?.click();
  };
  
  const removeImage = () => {
    setPreviewUrl(null);
    setPhotoData(undefined);
    setPhotoType(undefined);
    setPhotoName(undefined);
    setPhotoSize(undefined);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  // Render ratings form for a specific reviewer
  const renderRatingForm = (reviewer: 'tom' | 'tomer') => {
    const displayName = reviewer === 'tom' ? 'תום' : 'תומר';
    
    // Select the appropriate state setters based on the reviewer
    const setCoffeeRating = reviewer === 'tom' ? setTomCoffeeRating : setTomerCoffeeRating;
    const setFoodRating = reviewer === 'tom' ? setTomFoodRating : setTomerFoodRating;
    const setAtmosphereRating = reviewer === 'tom' ? setTomAtmosphereRating : setTomerAtmosphereRating;
    const setPriceRating = reviewer === 'tom' ? setTomPriceRating : setTomerPriceRating;
    
    // Select the appropriate state values based on the reviewer
    const coffeeRating = reviewer === 'tom' ? tomCoffeeRating : tomerCoffeeRating;
    const foodRating = reviewer === 'tom' ? tomFoodRating : tomerFoodRating;
    const atmosphereRating = reviewer === 'tom' ? tomAtmosphereRating : tomerAtmosphereRating;
    const priceRating = reviewer === 'tom' ? tomPriceRating : tomerPriceRating;
    
    return (
      <div>
        <h3 className="text-xl font-bold text-amber-800 mb-4 text-center">הדירוג של {displayName}</h3>
        
        <div className="space-y-4 mb-6">
          <div>
            <ScaleBar
              label="קפה"
              rating={coffeeRating}
              onChange={setCoffeeRating}
            />
            {coffeeRating > 0 && (
              <div className="mt-1 flex justify-end">
                <RatingStars rating={coffeeRating} size="sm" />
              </div>
            )}
          </div>
          
          <div>
            <ScaleBar
              label="אוכל"
              rating={foodRating}
              onChange={setFoodRating}
            />
            {foodRating > 0 && (
              <div className="mt-1 flex justify-end">
                <RatingStars rating={foodRating} size="sm" />
              </div>
            )}
          </div>
          
          <div>
            <ScaleBar
              label="אווירה"
              rating={atmosphereRating}
              onChange={setAtmosphereRating}
            />
            {atmosphereRating > 0 && (
              <div className="mt-1 flex justify-end">
                <RatingStars rating={atmosphereRating} size="sm" />
              </div>
            )}
          </div>
          
          <div>
            <ScaleBar
              label="מחיר"
              rating={priceRating}
              onChange={setPriceRating}
            />
            {priceRating > 0 && (
              <div className="mt-1 flex justify-end">
                <RatingStars rating={priceRating} size="sm" />
              </div>
            )}
          </div>
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
          <label className="block text-amber-800 font-medium mb-2 text-right">
            תמונה (אופציונלי)
          </label>
          
          {/* Hidden file inputs */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            className="hidden"
          />
          
          <input
            type="file"
            ref={cameraInputRef}
            onChange={handleFileChange}
            accept="image/*"
            capture="environment"
            className="hidden"
          />
          
          {/* Image preview */}
          {previewUrl && (
            <div className="mb-4 relative h-48 w-full">
              <Image
                src={previewUrl}
                alt="Preview"
                fill
                className="object-cover rounded-md"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              />
              <button
                type="button"
                onClick={removeImage}
                className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
                aria-label="Remove image"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          )}
          
          {uploadError && (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4 text-right">
              {uploadError}
            </div>
          )}
          
          <div className="flex space-x-4 justify-end">
            <button
              type="button"
              onClick={triggerFileInput}
              disabled={isUploading}
              className="bg-amber-500 hover:bg-amber-600 text-white font-medium py-2 px-4 rounded-md transition-colors duration-200 disabled:opacity-50 flex items-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 5a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-1.586a1 1 0 01-.707-.293l-1.121-1.121A2 2 0 0011.172 3H8.828a2 2 0 00-1.414.586L6.293 4.707A1 1 0 015.586 5H4zm6 9a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
              </svg>
              {isUploading ? 'מעלה...' : 'העלאת תמונה'}
            </button>
            
            <button
              type="button"
              onClick={triggerCameraInput}
              disabled={isUploading}
              className="bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-md transition-colors duration-200 disabled:opacity-50 flex items-center"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 ml-2" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 5a2 2 0 00-2 2v8a2 2 0 002 2h12a2 2 0 002-2V7a2 2 0 00-2-2h-1.586a1 1 0 01-.707-.293l-1.121-1.121A2 2 0 0011.172 3H8.828a2 2 0 00-1.414.586L6.293 4.707A1 1 0 015.586 5H4zm6 9a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
              </svg>
              {isUploading ? 'מעלה...' : 'צילום תמונה'}
            </button>
          </div>
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