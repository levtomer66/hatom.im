import { NextRequest, NextResponse } from 'next/server';
import {
  getCoffeeReviewById,
  updateCoffeeReview,
  deleteCoffeeReview
} from '@/models/CoffeeReview';
import { requirePagePermission } from '@/lib/auth-helpers';
import { forwardGeocode } from '@/lib/forwardGeocode';

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

// PATCH handler to update a coffee review. Gated on `mekafkefim:write`
// so non-owner allowlisted users (Tom) can edit via /admin/allowlist.
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const gate = await requirePagePermission('mekafkefim:write');
  if (gate instanceof NextResponse) return gate;

  try {
    const { id } = await context.params;
    const data = await request.json();
    
    // Validate Tom's rating ranges if provided
    const tomRatings = [
      data.tomCoffeeRating, 
      data.tomFoodRating, 
      data.tomAtmosphereRating, 
      data.tomPriceRating
    ].filter(rating => rating !== undefined);

    // Validate Tomer's rating ranges if provided
    const tomerRatings = [
      data.tomerCoffeeRating, 
      data.tomerFoodRating, 
      data.tomerAtmosphereRating, 
      data.tomerPriceRating
    ].filter(rating => rating !== undefined);
    
    // Combine for validation
    const allRatings = [...tomRatings, ...tomerRatings];
    
    if (allRatings.some(rating => rating < 0 || rating > 10 || !Number.isInteger(rating * 2))) {
      return NextResponse.json(
        { error: 'Ratings must be between 1 and 10 with 0.5 increments' },
        { status: 400 }
      );
    }

    // If placeName is being changed and the caller didn't pass explicit
    // coordinates, re-geocode so the pin tracks the new name. Failure is
    // non-fatal — leaves existing coords untouched in that case (vs
    // wiping them, which would be lossy).
    if (
      data.placeName &&
      (typeof data.latitude !== 'number' || typeof data.longitude !== 'number')
    ) {
      const existing = await getCoffeeReviewById(id);
      const nameChanged = existing && existing.placeName !== data.placeName;
      if (nameChanged) {
        const geo = await forwardGeocode(data.placeName);
        if (geo) {
          data.latitude = geo.latitude;
          data.longitude = geo.longitude;
          if (!data.locationLabel) data.locationLabel = geo.label;
        }
      }
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

// DELETE handler to delete a coffee review. Same gate as PATCH.
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const gate = await requirePagePermission('mekafkefim:write');
  if (gate instanceof NextResponse) return gate;

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