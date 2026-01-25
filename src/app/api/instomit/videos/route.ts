import { NextRequest, NextResponse } from 'next/server';
import { CreateVideoDto } from '@/types/video';
import { getAllVideos, createVideo } from '@/models/Video';

// GET handler to retrieve all videos
export async function GET() {
  try {
    const videos = await getAllVideos();
    return NextResponse.json(videos);
  } catch (error) {
    console.error('Error fetching videos:', error);
    return NextResponse.json(
      { error: 'Failed to fetch videos' },
      { status: 500 }
    );
  }
}

// POST handler to create a new video
export async function POST(request: NextRequest) {
  try {
    const data: CreateVideoDto = await request.json();
    
    // Validate required fields
    if (!data.youtubeUrl) {
      return NextResponse.json(
        { error: 'YouTube URL is required' },
        { status: 400 }
      );
    }
    
    // Validate YouTube URL format
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com\/(watch\?v=|shorts\/)|youtu\.be\/)/;
    if (!youtubeRegex.test(data.youtubeUrl)) {
      return NextResponse.json(
        { error: 'Invalid YouTube URL format' },
        { status: 400 }
      );
    }
    
    const newVideo = await createVideo(data);
    return NextResponse.json(newVideo, { status: 201 });
  } catch (error) {
    console.error('Error creating video:', error);
    return NextResponse.json(
      { error: 'Failed to create video' },
      { status: 500 }
    );
  }
}
