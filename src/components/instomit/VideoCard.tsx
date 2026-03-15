'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { FaComment, FaVolumeMute, FaVolumeUp } from 'react-icons/fa';
import { Video, Comment } from '@/types/video';
import LikeButton from './LikeButton';
import CommentsPanel from './CommentsPanel';

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

// YouTube IFrame API loader (singleton)
let ytApiReady = false;
const ytApiPromise = new Promise<void>((resolve) => {
  if (typeof window === 'undefined') return;
  
  const check = () => {
    if (window.YT && window.YT.Player) {
      ytApiReady = true;
      resolve();
      return;
    }
    // Load script if not loaded yet
    if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      document.head.appendChild(tag);
    }
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      ytApiReady = true;
      resolve();
    };
  };
  
  if (document.readyState === 'complete') {
    check();
  } else {
    window.addEventListener('load', check, { once: true });
  }
});

const VideoCard: React.FC<VideoCardProps> = ({ video, isActive, isMuted, onToggleMute }) => {
  const [likes, setLikes] = useState(video.likes);
  const [isLiked, setIsLiked] = useState(false);
  const [isLikeLoading, setIsLikeLoading] = useState(false);
  const [comments, setComments] = useState<Comment[]>(video.comments);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [isCommentsLoading, setIsCommentsLoading] = useState(false);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YT.Player | null>(null);
  const playerReadyRef = useRef(false);
  const videoId = extractYouTubeId(video.youtubeUrl);

  const propsRef = useRef({ isActive, isMuted });
  propsRef.current = { isActive, isMuted };

  const destroyPlayer = useCallback(() => {
    if (playerRef.current) {
      try { playerRef.current.destroy(); } catch { /* ok */ }
      playerRef.current = null;
      playerReadyRef.current = false;
    }
    if (wrapperRef.current) {
      wrapperRef.current.innerHTML = '';
    }
  }, []);

  // Only ONE player exists at a time across the entire feed.
  // Create when active, destroy when not.
  useEffect(() => {
    if (!videoId || !isActive || !wrapperRef.current) {
      destroyPlayer();
      return;
    }

    // Already have a ready player for this video - just ensure it's playing
    if (playerRef.current && playerReadyRef.current) {
      try { playerRef.current.playVideo(); } catch { /* ok */ }
      return;
    }

    // If a player is still initializing, bail out
    if (playerRef.current) return;

    let destroyed = false;

    ytApiPromise.then(() => {
      if (destroyed || !wrapperRef.current) return;

      const container = wrapperRef.current;
      container.innerHTML = '';
      const el = document.createElement('div');
      container.appendChild(el);

      const player = new window.YT.Player(el, {
        videoId,
        playerVars: {
          autoplay: 1,
          mute: propsRef.current.isMuted ? 1 : 0,
          loop: 1,
          playlist: videoId,
          controls: 0,
          modestbranding: 1,
          rel: 0,
          showinfo: 0,
          playsinline: 1,
          enablejsapi: 1,
          iv_load_policy: 3,
          origin: window.location.origin,
        },
        events: {
          onReady: () => {
            if (destroyed) return;
            playerReadyRef.current = true;
            try { player.playVideo(); } catch { /* ok */ }
          },
          onStateChange: (event) => {
            if (destroyed) return;
            if (event.data === window.YT.PlayerState.ENDED) {
              try {
                player.seekTo(0, true);
                player.playVideo();
              } catch { /* ok */ }
            }
            // Safety net: resume if YouTube auto-pauses
            if (event.data === window.YT.PlayerState.PAUSED && propsRef.current.isActive) {
              setTimeout(() => {
                if (propsRef.current.isActive && playerReadyRef.current && !destroyed) {
                  try { player.playVideo(); } catch { /* ok */ }
                }
              }, 300);
            }
          },
        },
      });

      playerRef.current = player;
    });

    return () => {
      destroyed = true;
      destroyPlayer();
    };
  }, [videoId, isActive, destroyPlayer]);

  // Mute/unmute
  useEffect(() => {
    if (!playerRef.current || !playerReadyRef.current) return;
    try {
      if (isMuted) {
        playerRef.current.mute();
      } else {
        playerRef.current.unMute();
      }
    } catch { /* ok */ }
  }, [isMuted]);

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
      {videoId ? (
        <div className="absolute inset-0">
          <div ref={wrapperRef} className="video-iframe" />
          {!isActive && (
            <div className="absolute inset-0 bg-black/80 flex items-center justify-center">
              <div className="w-12 h-12 rounded-full bg-white/10" />
            </div>
          )}
        </div>
      ) : (
        <div className="text-white text-center p-4">
          <p>Invalid video URL</p>
          <p className="text-sm text-gray-400">{video.youtubeUrl}</p>
        </div>
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
