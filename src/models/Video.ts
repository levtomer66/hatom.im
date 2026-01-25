import { ObjectId } from 'mongodb';
import { Video, CreateVideoDto, CreateCommentDto, Comment } from '@/types/video';
import clientPromise from '@/lib/mongodb';
import { v4 as uuidv4 } from 'uuid';

// Collection name
const COLLECTION_NAME = 'videos';

// MongoDB document type (internal use)
interface VideoDocument extends Omit<Video, 'id'> {
  _id?: ObjectId;
}

// Get the collection
export async function getVideosCollection() {
  const client = await clientPromise;
  const db = client.db();
  return db.collection<VideoDocument>(COLLECTION_NAME);
}

// Get all videos
export async function getAllVideos(): Promise<Video[]> {
  const collection = await getVideosCollection();
  const videos = await collection.find({}).sort({ createdAt: -1 }).toArray();
  
  return videos.map(video => ({
    ...video,
    id: video._id!.toString(),
    _id: undefined,
  })) as Video[];
}

// Get a video by ID
export async function getVideoById(id: string): Promise<Video | null> {
  const collection = await getVideosCollection();
  
  try {
    const video = await collection.findOne({ _id: new ObjectId(id) });
    
    if (!video) return null;
    
    return {
      ...video,
      id: video._id!.toString(),
      _id: undefined,
    } as Video;
  } catch (error) {
    console.error('Error fetching video by ID:', error);
    return null;
  }
}

// Create a new video
export async function createVideo(data: CreateVideoDto): Promise<Video> {
  const collection = await getVideosCollection();
  
  const now = new Date().toISOString();
  const newVideo: Omit<VideoDocument, '_id'> = {
    youtubeUrl: data.youtubeUrl,
    title: data.title || '',
    likes: 0,
    comments: [],
    createdAt: now,
    updatedAt: now,
  };
  
  const result = await collection.insertOne(newVideo);
  
  return {
    ...newVideo,
    id: result.insertedId.toString(),
  } as Video;
}

// Increment likes for a video
export async function incrementVideoLikes(id: string): Promise<Video | null> {
  const collection = await getVideosCollection();
  
  try {
    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { 
        $inc: { likes: 1 },
        $set: { updatedAt: new Date().toISOString() }
      },
      { returnDocument: 'after' }
    );
    
    if (!result) return null;
    
    return {
      ...result,
      id: result._id!.toString(),
      _id: undefined,
    } as Video;
  } catch (error) {
    console.error('Error incrementing video likes:', error);
    return null;
  }
}

// Decrement likes for a video
export async function decrementVideoLikes(id: string): Promise<Video | null> {
  const collection = await getVideosCollection();
  
  try {
    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { 
        $inc: { likes: -1 },
        $set: { updatedAt: new Date().toISOString() }
      },
      { returnDocument: 'after' }
    );
    
    if (!result) return null;
    
    return {
      ...result,
      id: result._id!.toString(),
      _id: undefined,
    } as Video;
  } catch (error) {
    console.error('Error decrementing video likes:', error);
    return null;
  }
}

// Add a comment to a video
export async function addCommentToVideo(videoId: string, data: CreateCommentDto): Promise<Video | null> {
  const collection = await getVideosCollection();
  
  const newComment: Comment = {
    id: uuidv4(),
    name: data.name,
    text: data.text,
    createdAt: new Date().toISOString(),
  };
  
  try {
    const result = await collection.findOneAndUpdate(
      { _id: new ObjectId(videoId) },
      { 
        $push: { comments: newComment },
        $set: { updatedAt: new Date().toISOString() }
      },
      { returnDocument: 'after' }
    );
    
    if (!result) return null;
    
    return {
      ...result,
      id: result._id!.toString(),
      _id: undefined,
    } as Video;
  } catch (error) {
    console.error('Error adding comment to video:', error);
    return null;
  }
}

// Get comments for a video
export async function getVideoComments(videoId: string): Promise<Comment[]> {
  const video = await getVideoById(videoId);
  return video?.comments || [];
}

// Delete a video
export async function deleteVideo(id: string): Promise<boolean> {
  const collection = await getVideosCollection();
  
  try {
    const result = await collection.deleteOne({ _id: new ObjectId(id) });
    return result.deletedCount > 0;
  } catch (error) {
    console.error('Error deleting video:', error);
    return false;
  }
}
