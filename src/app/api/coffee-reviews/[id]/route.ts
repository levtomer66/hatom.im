import { NextRequest, NextResponse } from 'next/server';
import { 
  getCoffeeReviewById, 
  updateCoffeeReview, 
  deleteCoffeeReview 
} from '@/models/CoffeeReview';

// GET handler to retrieve a single coffee review by ID
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const review = await getCoffeeReviewById(id);
    
    if (!review) {
      return NextResponse.json(
        { error: 'Coffee review not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(review);
  } catch (error) {
    console.error('Error fetching coffee review:', error);
    return NextResponse.json(
      { error: 'Failed to fetch coffee review' },
      { status: 500 }
    );
  }
}

// PATCH handler to update a coffee review
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const data = await request.json();
    
    // Validate rating ranges if provided
    const ratings = [
      data.coffeeRating, 
      data.foodRating, 
      data.atmosphereRating, 
      data.priceRating
    ].filter(rating => rating !== undefined);
    
    if (ratings.some(rating => rating < 1 || rating > 10 || !Number.isInteger(rating * 2))) {
      return NextResponse.json(
        { error: 'Ratings must be between 1 and 10 with 0.5 increments' },
        { status: 400 }
      );
    }
    
    const updatedReview = await updateCoffeeReview(id, data);
    
    if (!updatedReview) {
      return NextResponse.json(
        { error: 'Coffee review not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(updatedReview);
  } catch (error) {
    console.error('Error updating coffee review:', error);
    return NextResponse.json(
      { error: 'Failed to update coffee review' },
      { status: 500 }
    );
  }
}

// DELETE handler to delete a coffee review
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const success = await deleteCoffeeReview(id);
    
    if (!success) {
      return NextResponse.json(
        { error: 'Coffee review not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { message: 'Coffee review deleted successfully' },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error deleting coffee review:', error);
    return NextResponse.json(
      { error: 'Failed to delete coffee review' },
      { status: 500 }
    );
  }
} 