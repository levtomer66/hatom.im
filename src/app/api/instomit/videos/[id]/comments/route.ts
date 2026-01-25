import { NextRequest, NextResponse } from 'next/server';
import { CreateCommentDto } from '@/types/video';
import { getVideoComments, addCommentToVideo, getVideoById } from '@/models/Video';

// GET handler to retrieve comments for a video
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    // Verify video exists
    const video = await getVideoById(id);
    if (!video) {
      return NextResponse.json(
        { error: 'Video not found' },
        { status: 404 }
      );
    }
    
    const comments = await getVideoComments(id);
    return NextResponse.json(comments);
  } catch (error) {
    console.error('Error fetching comments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch comments' },
      { status: 500 }
    );
  }
}

// POST handler to add a comment to a video
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const data: CreateCommentDto = await request.json();
    
    // Validate required fields
    if (!data.name || !data.text) {
      return NextResponse.json(
        { error: 'Name and text are required' },
        { status: 400 }
      );
    }
    
    // Verify video exists
    const video = await getVideoById(id);
    if (!video) {
      return NextResponse.json(
        { error: 'Video not found' },
        { status: 404 }
      );
    }
    
    const updatedVideo = await addCommentToVideo(id, data);
    
    if (!updatedVideo) {
      return NextResponse.json(
        { error: 'Failed to add comment' },
        { status: 500 }
      );
    }
    
    // Return the newly added comment (last one in the array)
    const newComment = updatedVideo.comments[updatedVideo.comments.length - 1];
    return NextResponse.json(newComment, { status: 201 });
  } catch (error) {
    console.error('Error adding comment:', error);
    return NextResponse.json(
      { error: 'Failed to add comment' },
      { status: 500 }
    );
  }
}
