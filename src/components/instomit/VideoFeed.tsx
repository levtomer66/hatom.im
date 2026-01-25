'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Video } from '@/types/video';
import VideoCard from './VideoCard';

interface VideoFeedProps {
  initialVideos: Video[];
}

const VideoFeed: React.FC<VideoFeedProps> = ({ initialVideos }) => {
  const [videos, setVideos] = useState<Video[]>(initialVideos);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isMuted, setIsMuted] = useState(true); // Start muted for autoplay
  const containerRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Toggle mute state for all videos
  const handleToggleMute = useCallback(() => {
    setIsMuted(prev => !prev);
  }, []);

  // Update videos when initialVideos change
  useEffect(() => {
    setVideos(initialVideos);
  }, [initialVideos]);

  // Setup Intersection Observer to track which video is in view
  const setupObserver = useCallback(() => {
    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            const index = parseInt(entry.target.getAttribute('data-index') || '0', 10);
            setActiveIndex(index);
          }
        });
      },
      {
        root: containerRef.current,
        threshold: [0.5, 0.75, 1.0], // Multiple thresholds for better detection
      }
    );

    // Observe all video card wrappers (they have data-index attribute)
    const wrappers = containerRef.current?.querySelectorAll('.video-card-wrapper');
    wrappers?.forEach((wrapper) => {
      observerRef.current?.observe(wrapper);
    });
  }, []);

  // Setup observer on mount and when videos change
  useEffect(() => {
    setupObserver();

    return () => {
      observerRef.current?.disconnect();
    };
  }, [videos, setupObserver]);

  // Handle keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'j') {
        e.preventDefault();
        const nextIndex = Math.min(activeIndex + 1, videos.length - 1);
        scrollToVideo(nextIndex);
      } else if (e.key === 'ArrowUp' || e.key === 'k') {
        e.preventDefault();
        const prevIndex = Math.max(activeIndex - 1, 0);
        scrollToVideo(prevIndex);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeIndex, videos.length]);

  const scrollToVideo = (index: number) => {
    const cards = containerRef.current?.querySelectorAll('.video-card');
    if (cards && cards[index]) {
      cards[index].scrollIntoView({ behavior: 'smooth' });
    }
  };

  if (videos.length === 0) {
    return (
      <div className="h-[100dvh] w-full flex flex-col items-center justify-center bg-black text-white">
        <div className="text-6xl mb-4">📹</div>
        <h2 className="text-2xl font-bold mb-2">אין סרטונים עדיין</h2>
        <p className="text-gray-400">הסרטונים יופיעו כאן בקרוב!</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="video-feed-container h-[100dvh] w-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide bg-black overscroll-none"
      style={{
        scrollSnapType: 'y mandatory',
        WebkitOverflowScrolling: 'touch',
      }}
    >
      {videos.map((video, index) => (
        <div
          key={video.id}
          data-index={index}
          className="video-card-wrapper h-[100dvh] w-full"
          style={{
            scrollSnapAlign: 'start',
            scrollSnapStop: 'always',
          }}
        >
          <VideoCard 
            video={video} 
            isActive={index === activeIndex}
            isMuted={isMuted}
            onToggleMute={handleToggleMute}
          />
        </div>
      ))}
      
      {/* Video progress indicator - adjusted for mobile */}
      <div className="fixed top-16 sm:top-4 right-2 sm:right-4 z-50 flex flex-col gap-1 pt-safe">
        {videos.map((_, index) => (
          <button
            key={index}
            onClick={() => scrollToVideo(index)}
            className={`w-1.5 sm:w-1 h-5 sm:h-6 rounded-full transition-all duration-300 ${
              index === activeIndex
                ? 'bg-white'
                : 'bg-white/30 hover:bg-white/50'
            }`}
            aria-label={`Go to video ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
};

export default VideoFeed;
