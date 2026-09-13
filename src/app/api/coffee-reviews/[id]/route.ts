import { NextRequest, NextResponse } from 'next/server';
import {
  getCoffeeReviewById,
  updateCoffeeReview,
  deleteCoffeeReview
} from '@/models/CoffeeReview';
import { requireFeatureCaller } from '@/lib/api-caller';
import {
  resolveDisabledCategories,
  resolveTags,
  isValidArea,
  resolveTriedItems,
  resolveOpeningHours
} from '@/types/coffee';

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
  const gate = await requireFeatureCaller(request, 'mekafkefim:write');
  if (gate instanceof NextResponse) return gate;

  try {
    const { id } = await context.params;
    const data = await request.json();
    
    // Validate Tom's rating ranges if provided
    const tomRatings = [
      data.tomCoffeeRating,
      data.tomFoodRating,
      data.tomAtmosphereRating,
      data.tomPriceRating,
      data.tomPastryRating
    ].filter(rating => rating !== undefined);

    // Validate Tomer's rating ranges if provided
    const tomerRatings = [
      data.tomerCoffeeRating,
      data.tomerFoodRating,
      data.tomerAtmosphereRating,
      data.tomerPriceRating,
      data.tomerPastryRating
    ].filter(rating => rating !== undefined);
    
    // Combine for validation
    const allRatings = [...tomRatings, ...tomerRatings];
    
    if (allRatings.some(rating =>
      typeof rating !== 'number' || Number.isNaN(rating) ||
      rating < 0 || rating > 10 || !Number.isInteger(rating * 2)
    )) {
      return NextResponse.json(
        { error: 'Ratings must be between 1 and 10 with 0.5 increments' },
        { status: 400 }
      );
    }
    
    // Only touch the field when the client actually sent it — a patch that
    // changes just photoUrl must not silently re-enable categories.
    if ('disabledCategories' in data) {
      const resolved = resolveDisabledCategories(data.disabledCategories);
      if (resolved === null) {
        return NextResponse.json(
          { error: 'Invalid disabledCategories' },
          { status: 400 }
        );
      }
      data.disabledCategories = resolved;
    }

    // --- new place-level fields ---
    if (data.tags !== undefined) {
      const tags = resolveTags(data.tags);
      if (tags === null) return NextResponse.json({ error: 'Invalid tags' }, { status: 400 });
      data.tags = tags;
    }
    if (data.area !== undefined && data.area !== null && !isValidArea(data.area)) {
      return NextResponse.json({ error: 'Invalid area' }, { status: 400 });
    }
    if (data.triedItems !== undefined) {
      const items = resolveTriedItems(data.triedItems);
      if (items === null) return NextResponse.json({ error: 'Invalid triedItems' }, { status: 400 });
      data.triedItems = items;
    }
    if (data.openingHours !== undefined && data.openingHours !== null) {
      const hours = resolveOpeningHours(data.openingHours);
      if (hours === null) return NextResponse.json({ error: 'Invalid openingHours' }, { status: 400 });
      data.openingHours = hours;
    }
    for (const [key, max] of [['coffeeDrinkLabel', 40], ['tomNotes', 500], ['tomerNotes', 500]] as const) {
      if (data[key] !== undefined && data[key] !== null && (typeof data[key] !== 'string' || data[key].length > max)) {
        return NextResponse.json({ error: `Invalid ${key}` }, { status: 400 });
      }
    }
    if (data.coffeePriceIls !== undefined && data.coffeePriceIls !== null &&
        (typeof data.coffeePriceIls !== 'number' || !(data.coffeePriceIls >= 0))) {
      return NextResponse.json({ error: 'Invalid coffeePriceIls' }, { status: 400 });
    }
    for (const key of ['lat', 'lng'] as const) {
      if (data[key] !== undefined && data[key] !== null && typeof data[key] !== 'number') {
        return NextResponse.json({ error: `Invalid ${key}` }, { status: 400 });
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
  const gate = await requireFeatureCaller(request, 'mekafkefim:write');
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