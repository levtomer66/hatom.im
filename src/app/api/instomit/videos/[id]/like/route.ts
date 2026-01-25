import { NextRequest, NextResponse } from 'next/server';
import { incrementVideoLikes, decrementVideoLikes, getVideoById } from '@/models/Video';

// POST handler to toggle like on a video
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { action } = body; // 'like' or 'unlike'
    
    // Verify video exists
    const video = await getVideoById(id);
    if (!video) {
      return NextResponse.json(
        { error: 'Video not found' },
        { status: 404 }
      );
    }
    
    let updatedVideo;
    if (action === 'unlike') {
      updatedVideo = await decrementVideoLikes(id);
    } else {
      updatedVideo = await incrementVideoLikes(id);
    }
    
    if (!updatedVideo) {
      return NextResponse.json(
        { error: 'Failed to update likes' },
        { status: 500 }
      );
    }
    
    return NextResponse.json({ likes: updatedVideo.likes });
  } catch (error) {
    console.error('Error toggling like:', error);
    return NextResponse.json(
      { error: 'Failed to toggle like' },
      { status: 500 }
    );
  }
}
