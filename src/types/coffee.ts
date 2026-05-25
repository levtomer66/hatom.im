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
  // Optional cafe coordinates + human-readable label, resolved from the
  // place name via the Nominatim forward geocoder when the review is
  // created or edited. Used to drop a pin on the /mekafkefim map.
  latitude?: number;
  longitude?: number;
  locationLabel?: string;
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
  latitude?: number;
  longitude?: number;
  locationLabel?: string;
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