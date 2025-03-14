export interface CoffeeReview {
  id: string;
  placeName: string;
  coffeeRating: number;
  foodRating: number;
  atmosphereRating: number;
  priceRating: number;
  photoUrl?: string;
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
} 