'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { FaComment, FaVolumeMute, FaVolumeUp } from 'react-icons/fa';
import { Video, Comment } from '@/types/video';
import LikeButton from './LikeButton';
import CommentsPanel from './CommentsPanel';

// Extend Window interface for YouTube IFrame API
declare global {
  interface Window {
    YT: typeof YT;
    onYouTubeIframeAPIReady: () => void;
  }
}

interface VideoCardProps {
  video: Video;
  isActive: boolean;
  isMuted: boolean;
  onToggleMute: () => void;
}

// Extract YouTube video ID from various URL formats
const extractYouTubeId = (url: string): string | null => {
  const patterns = [
    /(?:youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    /(?:youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
};

// Load YouTube IFrame API script once
let apiLoaded = false;
let apiReady = false;
const apiReadyCallbacks: (() => void)[] = [];

const loadYouTubeAPI = (): Promise<void> => {
  return new Promise((resolve) => {
    if (apiReady) {
      resolve();
      return;
    }

    apiReadyCallbacks.push(resolve);

    if (!apiLoaded) {
      apiLoaded = true;
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

      window.onYouTubeIframeAPIReady = () => {
        apiReady = true;
        apiReadyCallbacks.forEach((cb) => cb());
      };
    }
  });
};

const VideoCard: React.FC<VideoCardProps> = ({ video, isActive, isMuted, onToggleMute }) => {
  const [likes, setLikes] = useState(video.likes);
  const [isLiked, setIsLiked] = useState(false);
  const [isLikeLoading, setIsLikeLoading] = useState(false);
  const [comments, setComments] = useState<Comment[]>(video.comments);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [isCommentsLoading, setIsCommentsLoading] = useState(false);
  const [playerReady, setPlayerReady] = useState(false);
  
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YT.Player | null>(null);
  const videoId = extractYouTubeId(video.youtubeUrl);

  // Store isActive in a ref so we can access it in onReady callback
  const isActiveRef = useRef(isActive);
  const isMutedRef = useRef(isMuted);
  
  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);
  
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  // Initialize YouTube player
  useEffect(() => {
    if (!videoId) return;

    let isMounted = true;

    const initPlayer = async () => {
      await loadYouTubeAPI();
      
      if (!isMounted || !playerContainerRef.current) return;

      // Create a unique ID for the player container
      const playerId = `youtube-player-${video.id}`;
      playerContainerRef.current.id = playerId;

      playerRef.current = new window.YT.Player(playerId, {
        videoId: videoId,
        playerVars: {
          autoplay: 0,   // Don't autoplay - we control this manually
          mute: 1,       // Start muted (required for autoplay to work)
          loop: 1,
          playlist: videoId,
          controls: 0,
          modestbranding: 1,
          rel: 0,
          showinfo: 0,
          playsinline: 1,
          enablejsapi: 1,
          origin: window.location.origin,
        },
        events: {
          onReady: () => {
            if (isMounted) {
              setPlayerReady(true);
              
              // Apply initial mute state
              if (!isMutedRef.current && playerRef.current) {
                playerRef.current.unMute();
              }
              
              // If this video is active, start playing
              if (isActiveRef.current && playerRef.current) {
                playerRef.current.playVideo();
              }
            }
          },
          onStateChange: (event) => {
            // When video ends and this is the active video, restart it (loop)
            if (event.data === window.YT.PlayerState.ENDED && isActiveRef.current) {
              playerRef.current?.seekTo(0, true);
              playerRef.current?.playVideo();
            }
          },
        },
      });
    };

    initPlayer();

    return () => {
      isMounted = false;
      if (playerRef.current) {
        playerRef.current.destroy();
        playerRef.current = null;
      }
    };
  }, [videoId, video.id]);

  // Control playback based on isActive
  useEffect(() => {
    if (!playerReady || !playerRef.current) return;

    if (isActive) {
      // Play this video
      playerRef.current.playVideo();
    } else {
      // Pause and reset to beginning when scrolling away
      playerRef.current.pauseVideo();
      playerRef.current.seekTo(0, true);
    }
  }, [isActive, playerReady]);

  // Control mute state
  useEffect(() => {
    if (!playerReady || !playerRef.current) return;

    if (isMuted) {
      playerRef.current.mute();
    } else {
      playerRef.current.unMute();
    }
  }, [isMuted, playerReady]);

  // Check if user has already liked this video (from localStorage)
  useEffect(() => {
    const likedVideos = JSON.parse(localStorage.getItem('instomit-liked-videos') || '[]');
    setIsLiked(likedVideos.includes(video.id));
  }, [video.id]);

  // Update local state when video prop changes
  useEffect(() => {
    setLikes(video.likes);
    setComments(video.comments);
  }, [video]);

  const handleToggleLike = useCallback(async () => {
    if (isLikeLoading) return;

    setIsLikeLoading(true);
    const wasLiked = isLiked;

    // Optimistic update
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

      // Update localStorage
      const likedVideos = JSON.parse(localStorage.getItem('instomit-liked-videos') || '[]');
      if (wasLiked) {
        localStorage.setItem(
          'instomit-liked-videos',
          JSON.stringify(likedVideos.filter((id: string) => id !== video.id))
        );
      } else {
        localStorage.setItem(
          'instomit-liked-videos',
          JSON.stringify([...likedVideos, video.id])
        );
      }
    } catch (error) {
      // Revert optimistic update on error
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
      {/* YouTube Player Container */}
      {videoId ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <div 
            ref={playerContainerRef}
            className="video-iframe"
          />
        </div>
      ) : (
        <div className="text-white text-center p-4">
          <p>Invalid video URL</p>
          <p className="text-sm text-gray-400">{video.youtubeUrl}</p>
        </div>
      )}

      {/* Overlay gradient for better text visibility */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none z-[2]" />

      {/* Right side actions - positioned for mobile with safe area */}
      <div className="absolute left-3 sm:left-4 bottom-24 sm:bottom-32 flex flex-col items-center gap-5 sm:gap-6 z-10 pb-safe">
        {/* Sound toggle button */}
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

      {/* Bottom caption/title - with safe area padding for iPhone */}
      {video.title && (
        <div className="absolute bottom-4 sm:bottom-6 right-3 sm:right-4 left-16 sm:left-20 z-10 pb-safe">
          <p className="text-white text-sm sm:text-base font-medium drop-shadow-lg line-clamp-2">
            {video.title}
          </p>
        </div>
      )}

      {/* Comments Panel */}
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
