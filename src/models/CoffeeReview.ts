import { ObjectId } from 'mongodb';
import { CoffeeReview, CreateCoffeeReviewDto } from '@/types/coffee';
import clientPromise from '@/lib/mongodb';

// Collection name
const COLLECTION_NAME = 'coffeeReviews';

// MongoDB document type (internal use)
interface CoffeeReviewDocument extends Omit<CoffeeReview, 'id'> {
  _id?: ObjectId;
  // Legacy fields that might exist in the database
  coffeeRating?: number;
  foodRating?: number;
  atmosphereRating?: number;
  priceRating?: number;
}

// Get the collection
export async function getCoffeeReviewsCollection() {
  const client = await clientPromise;
  const db = client.db();
  return db.collection<CoffeeReviewDocument>(COLLECTION_NAME);
}

// Helper function to convert legacy format to new format (in-memory only)
function ensureRatingFormat(review: CoffeeReviewDocument): CoffeeReviewDocument {
  // If the review already has the new fields, return it as is
  if (review.tomCoffeeRating !== undefined) {
    return review;
  }
  
  // Otherwise, create new fields based on legacy fields. (Price is no longer a
  // scored category — legacy priceRating is intentionally not carried over.)
  return {
    ...review,
    // Tom's ratings
    tomCoffeeRating: review.coffeeRating || 0,
    tomFoodRating: review.foodRating || 0,
    tomAtmosphereRating: review.atmosphereRating || 0,
    // Tomer's ratings
    tomerCoffeeRating: review.coffeeRating || 0,
    tomerFoodRating: review.foodRating || 0,
    tomerAtmosphereRating: review.atmosphereRating || 0,
  };
}

// Get all reviews
export async function getAllCoffeeReviews(): Promise<CoffeeReview[]> {
  const collection = await getCoffeeReviewsCollection();
  const reviews = await collection.find({}).toArray();
  
  // Process each review, ensuring correct format
  const processedReviews = reviews.map(review => {
    const formattedReview = ensureRatingFormat(review);
    return {
      ...formattedReview,
      id: formattedReview._id!.toString(),
      _id: undefined,
      // Remove legacy fields from the response
      coffeeRating: undefined,
      foodRating: undefined,
      atmosphereRating: undefined,
      priceRating: undefined
    };
  }) as CoffeeReview[];
  
  return processedReviews;
}

// Create a new review
export async function createCoffeeReview(data: CreateCoffeeReviewDto): Promise<CoffeeReview> {
  const collection = await getCoffeeReviewsCollection();
  
  const now = new Date().toISOString();
  // priceLevel arrives as PriceLevel | null | undefined (null = "not set" from
  // the shared form body). Only persist a real level; drop null/undefined.
  const { priceLevel, ...rest } = data;
  const newReview: Omit<CoffeeReviewDocument, '_id'> = {
    ...rest,
    ...(priceLevel ? { priceLevel } : {}),
    createdAt: now,
    updatedAt: now
  };
  
  const result = await collection.insertOne(newReview);
  
  return {
    ...newReview,
    id: result.insertedId.toString(),
  } as CoffeeReview;
}

// Get a review by ID
export async function getCoffeeReviewById(id: string): Promise<CoffeeReview | null> {
  const collection = await getCoffeeReviewsCollection();
  
  try {
    const review = await collection.findOne({ _id: new ObjectId(id) });
    
    if (!review) return null;
    
    const formattedReview = ensureRatingFormat(review);
    
    return {
      ...formattedReview,
      id: formattedReview._id!.toString(),
      _id: undefined,
      // Remove legacy fields from the response
      coffeeRating: undefined,
      foodRating: undefined,
      atmosphereRating: undefined,
      priceRating: undefined
    } as CoffeeReview;
  } catch (error) {
    console.error('Error fetching coffee review by ID:', error);
    return null;
  }
}

// Update a review
export async function updateCoffeeReview(id: string, data: Partial<CreateCoffeeReviewDto>): Promise<CoffeeReview | null> {
  const collection = await getCoffeeReviewsCollection();
  
  try {
    // Split the patch so a field the caller explicitly set to `undefined`
    // (e.g. clearing priceLevel) is $unset rather than ignored. JSON parsing
    // never yields undefined, so these only come from the route's validators.
    const set: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    const unset: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(data)) {
      if (v === undefined) unset[k] = '';
      else set[k] = v;
    }
    const update: Record<string, unknown> = { $set: set };
    if (Object.keys(unset).length) update.$unset = unset;

    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      update,
      { returnDocument: 'after' }
    );
    
    if (!result) return null;
    
    const formattedResult = ensureRatingFormat(result);
    
    return {
      ...formattedResult,
      id: formattedResult._id!.toString(),
      _id: undefined,
      // Remove legacy fields from the response
      coffeeRating: undefined,
      foodRating: undefined,
      atmosphereRating: undefined,
      priceRating: undefined
    } as CoffeeReview;
  } catch (error) {
    console.error('Error updating coffee review:', error);
    return null;
  }
}

// Delete a review
export async function deleteCoffeeReview(id: string): Promise<boolean> {
  const collection = await getCoffeeReviewsCollection();
  
  try {
    const result = await collection.deleteOne({ _id: new ObjectId(id) });
    return result.deletedCount > 0;
  } catch (error) {
    console.error('Error deleting coffee review:', error);
    return false;
  }
} 