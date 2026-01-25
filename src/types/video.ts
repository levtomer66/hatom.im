// Comment interface for video comments
export interface Comment {
  id: string;
  name: string;
  text: string;
  createdAt: string;
}

// Video interface for InsTomit videos
export interface Video {
  id: string;
  youtubeUrl: string;      // YouTube Shorts URL or regular YouTube URL
  title?: string;          // Optional title/caption
  likes: number;
  comments: Comment[];
  createdAt: string;
  updatedAt: string;
}

// DTO for creating a new video
export interface CreateVideoDto {
  youtubeUrl: string;
  title?: string;
}

// DTO for adding a comment
export interface CreateCommentDto {
  name: string;
  text: string;
}
