import { NextRequest, NextResponse } from 'next/server';
import { CreateCoffeeReviewDto } from '@/types/coffee';
import { 
  getAllCoffeeReviews, 
  createCoffeeReview 
} from '@/models/CoffeeReview';

// GET handler to retrieve all coffee reviews
export async function GET() {
  try {
    const reviews = await getAllCoffeeReviews();
    
    // Sort by average rating (coffee, food, atmosphere, price)
    const sortedReviews = reviews.sort((a, b) => {
      const avgA = (a.coffeeRating + a.foodRating + a.atmosphereRating + a.priceRating) / 4;
      const avgB = (b.coffeeRating + b.foodRating + b.atmosphereRating + b.priceRating) / 4;
      return avgB - avgA; // Descending order
    });
    
    return NextResponse.json(sortedReviews);
  } catch (error) {
    console.error('Error fetching coffee reviews:', error);
    return NextResponse.json(
      { error: 'Failed to fetch coffee reviews' },
      { status: 500 }
    );
  }
}

// POST handler to create a new coffee review
export async function POST(request: NextRequest) {
  try {
    const data: CreateCoffeeReviewDto = await request.json();
    
    // Validate required fields
    if (!data.placeName || 
        typeof data.coffeeRating !== 'number' || 
        typeof data.foodRating !== 'number' || 
        typeof data.atmosphereRating !== 'number' || 
        typeof data.priceRating !== 'number') {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Validate rating ranges (1-10 with 0.5 increments)
    if ([data.coffeeRating, data.foodRating, data.atmosphereRating, data.priceRating].some(
      rating => rating < 1 || rating > 10 || !Number.isInteger(rating * 2)
    )) {
      return NextResponse.json(
        { error: 'Ratings must be between 1 and 10 with 0.5 increments' },
        { status: 400 }
      );
    }
    
    // Create new review in MongoDB
    const newReview = await createCoffeeReview(data);
    
    return NextResponse.json(newReview, { status: 201 });
  } catch (error) {
    console.error('Error creating coffee review:', error);
    return NextResponse.json(
      { error: 'Failed to create coffee review' },
      { status: 500 }
    );
  }
} 