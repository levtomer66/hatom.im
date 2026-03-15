'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FaComment, FaVolumeMute, FaVolumeUp } from 'react-icons/fa';
import { Video, Comment } from '@/types/video';
import LikeButton from './LikeButton';
import CommentsPanel from './CommentsPanel';

interface VideoCardProps {
  video: Video;
  isActive: boolean;
  isMuted: boolean;
  onToggleMute: () => void;
}

const VideoCard: React.FC<VideoCardProps> = ({ video, isActive, isMuted, onToggleMute }) => {
  const [likes, setLikes] = useState(video.likes);
  const [isLiked, setIsLiked] = useState(false);
  const [isLikeLoading, setIsLikeLoading] = useState(false);
  const [comments, setComments] = useState<Comment[]>(video.comments);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [isCommentsLoading, setIsCommentsLoading] = useState(false);

  useEffect(() => {
    const likedVideos = JSON.parse(localStorage.getItem('instomit-liked-videos') || '[]');
    setIsLiked(likedVideos.includes(video.id));
  }, [video.id]);

  useEffect(() => {
    setLikes(video.likes);
    setComments(video.comments);
  }, [video]);

  const handleToggleLike = useCallback(async () => {
    if (isLikeLoading) return;
    setIsLikeLoading(true);
    const wasLiked = isLiked;
    setIsLiked(!wasLiked);
    setLikes(prev => wasLiked ? prev - 1 : prev + 1);
    try {
      const response = await fetch(`/api/instomit/videos/${video.id}/like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: wasLiked ? 'unlike' : 'like' }),
      });
      if (!response.ok) throw new Error('Failed to toggle like');
      const data = await response.json();
      setLikes(data.likes);
      const likedVideos = JSON.parse(localStorage.getItem('instomit-liked-videos') || '[]');
      if (wasLiked) {
        localStorage.setItem('instomit-liked-videos', JSON.stringify(likedVideos.filter((id: string) => id !== video.id)));
      } else {
        localStorage.setItem('instomit-liked-videos', JSON.stringify([...likedVideos, video.id]));
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      setIsLiked(wasLiked);
      setLikes(prev => wasLiked ? prev + 1 : prev - 1);
    } finally {
      setIsLikeLoading(false);
    }
  }, [video.id, isLiked, isLikeLoading]);

  const handleOpenComments = useCallback(async () => {
    setIsCommentsOpen(true);
    setIsCommentsLoading(true);
    try {
      const response = await fetch(`/api/instomit/videos/${video.id}/comments`);
      if (response.ok) {
        const data = await response.json();
        setComments(data);
      }
    } catch (error) {
      console.error('Error fetching comments:', error);
    } finally {
      setIsCommentsLoading(false);
    }
  }, [video.id]);

  const handleAddComment = useCallback(async (name: string, text: string) => {
    const response = await fetch(`/api/instomit/videos/${video.id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, text }),
    });
    if (!response.ok) throw new Error('Failed to add comment');
    const newComment = await response.json();
    setComments(prev => [...prev, newComment]);
  }, [video.id]);

  return (
    <div className="video-card relative w-full h-full bg-black flex items-center justify-center snap-start snap-always overflow-hidden">
      {/* Slot where VideoFeed inserts the persistent player */}
      <div className="video-slot absolute inset-0" />

      {!isActive && (
        <div className="absolute inset-0 bg-black z-[1]" />
      )}

      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none z-[2]" />

      <div className="absolute left-3 sm:left-4 bottom-24 sm:bottom-32 flex flex-col items-center gap-5 sm:gap-6 z-10 pb-safe">
        <button
          onClick={onToggleMute}
          className="flex flex-col items-center gap-1 transition-transform active:scale-90"
          aria-label={isMuted ? 'Enable sound' : 'Mute'}
        >
          <motion.div
            whileTap={{ scale: 1.2 }}
            className={`p-2 rounded-full ${isMuted ? 'bg-white/20' : 'bg-purple-500'}`}
          >
            {isMuted ? (
              <FaVolumeMute className="w-6 h-6 sm:w-7 sm:h-7 text-white drop-shadow-lg" />
            ) : (
              <FaVolumeUp className="w-6 h-6 sm:w-7 sm:h-7 text-white drop-shadow-lg" />
            )}
          </motion.div>
        </button>

        <LikeButton
          likes={likes}
          isLiked={isLiked}
          onToggleLike={handleToggleLike}
          isLoading={isLikeLoading}
        />

        <button
          onClick={handleOpenComments}
          className="flex flex-col items-center gap-1 transition-transform active:scale-90"
          aria-label="Open comments"
        >
          <motion.div whileTap={{ scale: 1.2 }}>
            <FaComment className="w-7 h-7 sm:w-8 sm:h-8 text-white drop-shadow-lg" />
          </motion.div>
          <span className="text-white text-sm font-semibold drop-shadow-lg">
            {comments.length}
          </span>
        </button>
      </div>

      {video.username && (
        <div className="absolute bottom-4 sm:bottom-6 right-3 sm:right-4 left-16 sm:left-20 z-10 pb-safe">
          <p className="text-white text-sm sm:text-base font-bold drop-shadow-lg" dir="ltr">
            {video.username}
          </p>
        </div>
      )}

      <CommentsPanel
        isOpen={isCommentsOpen}
        onClose={() => setIsCommentsOpen(false)}
        comments={comments}
        onAddComment={handleAddComment}
        isLoading={isCommentsLoading}
      />
    </div>
  );
};

export default VideoCard;
