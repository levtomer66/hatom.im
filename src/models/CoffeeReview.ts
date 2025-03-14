import { ObjectId } from 'mongodb';
import { CoffeeReview, CreateCoffeeReviewDto } from '@/types/coffee';
import clientPromise from '@/lib/mongodb';

// Collection name
const COLLECTION_NAME = 'coffeeReviews';

// MongoDB document type (internal use)
interface CoffeeReviewDocument extends Omit<CoffeeReview, 'id'> {
  _id?: ObjectId;
}

// Get the collection
export async function getCoffeeReviewsCollection() {
  const client = await clientPromise;
  const db = client.db();
  return db.collection<CoffeeReviewDocument>(COLLECTION_NAME);
}

// Get all reviews
export async function getAllCoffeeReviews(): Promise<CoffeeReview[]> {
  const collection = await getCoffeeReviewsCollection();
  const reviews = await collection.find({}).toArray();
  
  // Convert MongoDB _id to id string for consistency with the existing API
  return reviews.map(review => ({
    ...review,
    id: review._id!.toString(),
    _id: undefined
  })) as CoffeeReview[];
}

// Create a new review
export async function createCoffeeReview(data: CreateCoffeeReviewDto): Promise<CoffeeReview> {
  const collection = await getCoffeeReviewsCollection();
  
  const now = new Date().toISOString();
  const newReview: Omit<CoffeeReviewDocument, '_id'> = {
    ...data,
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
    
    return {
      ...review,
      id: review._id!.toString(),
      _id: undefined
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
    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { 
        $set: {
          ...data,
          updatedAt: new Date().toISOString()
        } 
      },
      { returnDocument: 'after' }
    );
    
    if (!result) return null;
    
    return {
      ...result,
      id: result._id!.toString(),
      _id: undefined
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