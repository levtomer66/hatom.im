import { NextRequest, NextResponse } from 'next/server';
import { CreateCoffeeReviewDto } from '@/types/coffee';
import { 
  getAllCoffeeReviews, 
  createCoffeeReview
} from '@/models/CoffeeReview';

// GET handler to retrieve all coffee reviews
export async function GET() {
  try {
    // Get all reviews
    const reviews = await getAllCoffeeReviews();
    
    // Sort by average combined rating
    const sortedReviews = reviews.sort((a, b) => {
      // Calculate Tom's average for each review
      const tomAvgA = (a.tomCoffeeRating + a.tomFoodRating + a.tomAtmosphereRating + a.tomPriceRating) / 4;
      const tomAvgB = (b.tomCoffeeRating + b.tomFoodRating + b.tomAtmosphereRating + b.tomPriceRating) / 4;
      
      // Calculate Tomer's average for each review
      const tomerAvgA = (a.tomerCoffeeRating + a.tomerFoodRating + a.tomerAtmosphereRating + a.tomerPriceRating) / 4;
      const tomerAvgB = (b.tomerCoffeeRating + b.tomerFoodRating + b.tomerAtmosphereRating + b.tomerPriceRating) / 4;
      
      // Calculate combined average for each review
      const combinedAvgA = (tomAvgA + tomerAvgA) / 2;
      const combinedAvgB = (tomAvgB + tomerAvgB) / 2;
      
      return combinedAvgB - combinedAvgA; // Descending order
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
    
    // Validate required fields for Tom
    if (!data.placeName || 
        typeof data.tomCoffeeRating !== 'number' || 
        typeof data.tomFoodRating !== 'number' || 
        typeof data.tomAtmosphereRating !== 'number' || 
        typeof data.tomPriceRating !== 'number') {
      return NextResponse.json(
        { error: 'Missing required Tom rating fields' },
        { status: 400 }
      );
    }
    
    // Validate required fields for Tomer
    if (typeof data.tomerCoffeeRating !== 'number' || 
        typeof data.tomerFoodRating !== 'number' || 
        typeof data.tomerAtmosphereRating !== 'number' || 
        typeof data.tomerPriceRating !== 'number') {
      return NextResponse.json(
        { error: 'Missing required Tomer rating fields' },
        { status: 400 }
      );
    }
    
    // Validate rating ranges (1-10 with 0.5 increments) for Tom
    const tomRatings = [
      data.tomCoffeeRating, 
      data.tomFoodRating, 
      data.tomAtmosphereRating, 
      data.tomPriceRating
    ];
    
    // Validate rating ranges (1-10 with 0.5 increments) for Tomer
    const tomerRatings = [
      data.tomerCoffeeRating, 
      data.tomerFoodRating, 
      data.tomerAtmosphereRating, 
      data.tomerPriceRating
    ];
    
    // Combine ratings for validation
    const allRatings = [...tomRatings, ...tomerRatings];
    
    if (allRatings.some(rating => 
      rating < 1 || rating > 10 || !Number.isInteger(rating * 2)
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