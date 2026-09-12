import { NextRequest, NextResponse } from 'next/server';
import { CreateCoffeeReviewDto, resolveDisabledCategories, scoreReview } from '@/types/coffee';
import {
  getAllCoffeeReviews,
  createCoffeeReview
} from '@/models/CoffeeReview';
import { requireFeatureCaller } from '@/lib/api-caller';

// GET handler to retrieve all coffee reviews
export async function GET() {
  try {
    // Get all reviews
    const reviews = await getAllCoffeeReviews();
    
    // Same ordering the page uses. The previous version divided by 4 and
    // counted unrated zeros, so it disagreed with the client on every review
    // that wasn't fully rated.
    const sortedReviews = reviews.sort(
      (a, b) => scoreReview(b).combined - scoreReview(a).combined
    );
    
    return NextResponse.json(sortedReviews);
  } catch (error) {
    console.error('Error fetching coffee reviews:', error);
    return NextResponse.json(
      { error: 'Failed to fetch coffee reviews' },
      { status: 500 }
    );
  }
}

// POST handler to create a new coffee review. Gated on the explicit
// `mekafkefim:write` permission so non-owner allowlisted users (Tom)
// can be granted edit access via /admin/allowlist.
export async function POST(request: NextRequest) {
  const gate = await requireFeatureCaller(request, 'mekafkefim:write');
  if (gate instanceof NextResponse) return gate;

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
      rating < 0 || rating > 10 || !Number.isInteger(rating * 2)
    )) {
      return NextResponse.json(
        { error: 'Ratings must be between 0 and 10 with 0.5 increments' },
        { status: 400 }
      );
    }
    
    const disabledCategories = resolveDisabledCategories(data.disabledCategories);
    if (disabledCategories === null) {
      return NextResponse.json(
        { error: 'Invalid disabledCategories' },
        { status: 400 }
      );
    }

    // Create new review in MongoDB
    const newReview = await createCoffeeReview({ ...data, disabledCategories });
    
    return NextResponse.json(newReview, { status: 201 });
  } catch (error) {
    console.error('Error creating coffee review:', error);
    return NextResponse.json(
      { error: 'Failed to create coffee review' },
      { status: 500 }
    );
  }
} 