import { NextRequest, NextResponse } from 'next/server';
import { getCoffeeReviewById } from '@/models/CoffeeReview';


export async function GET(request: NextRequest, { params }: { params: Promise<{id: string}> }) {
  try {
    const { id } = await params;
    const review = await getCoffeeReviewById(id);
    
    if (!review || !review.photoData || !review.photoType) {
      return NextResponse.json(
        { error: 'Image not found' },
        { status: 404 }
      );
    }
    
    // Convert base64 data back to binary
    const binaryData = Buffer.from(review.photoData, 'base64');
    
    // Create a response with the correct content type
    const response = new NextResponse(binaryData);
    
    // Set appropriate headers
    response.headers.set('Content-Type', review.photoType);
    if (review.photoSize) {
      response.headers.set('Content-Length', review.photoSize.toString());
    }
    if (review.photoName) {
      response.headers.set('Content-Disposition', `inline; filename="${review.photoName}"`);
    }
    
    return response;
  } catch (error) {
    console.error('Error serving image:', error);
    return NextResponse.json(
      { error: 'Failed to serve image' },
      { status: 500 }
    );
  }
} 