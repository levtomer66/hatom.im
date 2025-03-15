export interface CoffeeReview {
  id: string;
  placeName: string;
  coffeeRating: number;
  foodRating: number;
  atmosphereRating: number;
  priceRating: number;
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
  coffeeRating: number;
  foodRating: number;
  atmosphereRating: number;
  priceRating: number;
  photoUrl?: string;
  photoData?: string; // Base64 encoded image data
  photoType?: string; // Image MIME type
  photoName?: string; // Original filename
  photoSize?: number; // Size in bytes
} 