export interface CoffeeReview {
  id: string;
  placeName: string;
  // Tom's ratings
  tomCoffeeRating: number;
  tomFoodRating: number;
  tomAtmosphereRating: number;
  tomPriceRating: number;
  // Tomer's ratings
  tomerCoffeeRating: number;
  tomerFoodRating: number;
  tomerAtmosphereRating: number;
  tomerPriceRating: number;
  // Common fields
  photoUrl?: string;
  photoData?: string; // Base64 encoded image data
  photoType?: string; // Image MIME type
  photoName?: string; // Original filename
  photoSize?: number; // Size in bytes
  createdAt: string;
  updatedAt: string;
}

export interface CreateCoffeeReviewDto {
  placeName: string;
  // Tom's ratings
  tomCoffeeRating: number;
  tomFoodRating: number;
  tomAtmosphereRating: number;
  tomPriceRating: number;
  // Tomer's ratings
  tomerCoffeeRating: number;
  tomerFoodRating: number;
  tomerAtmosphereRating: number;
  tomerPriceRating: number;
  // Common fields
  photoUrl?: string;
  photoData?: string; // Base64 encoded image data
  photoType?: string; // Image MIME type
  photoName?: string; // Original filename
  photoSize?: number; // Size in bytes
}

// Helper type for calculating review statistics
export interface ReviewerScores {
  coffeeRating: number;
  foodRating: number;
  atmosphereRating: number;
  priceRating: number;
  averageRating: number;
}

export interface CombinedReviewScores {
  tom: ReviewerScores;
  tomer: ReviewerScores;
  average: {
    coffeeRating: number;
    foodRating: number;
    atmosphereRating: number;
    priceRating: number;
    totalAverage: number;
  };
} 