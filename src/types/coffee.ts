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
  mapsUrl?: string;
  instagramUrl?: string;
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
  mapsUrl?: string;
  instagramUrl?: string;
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