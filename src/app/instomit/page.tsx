'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { FaHome } from 'react-icons/fa';
import { Video } from '@/types/video';
import VideoFeed from '@/components/instomit/VideoFeed';
import { hasPermission } from '@/lib/permissions';

export default function InsTomitPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const [videos, setVideos] = useState<Video[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Permission gate (middleware handles SSR; this catches soft-nav cases).
  useEffect(() => {
    if (status === 'loading') return;
    if (!session?.user) {
      router.replace('/login?from=/instomit');
      return;
    }
    if (!hasPermission(session, 'instomit')) {
      router.replace('/');
    }
  }, [session, status, router]);

  const fetchVideos = async () => {
    try {
      const response = await fetch('/api/instomit/videos');
      if (!response.ok) throw new Error('Failed to fetch videos');
      const data = await response.json();
      setVideos(data);
    } catch (err) {
      console.error('Error fetching videos:', err);
      setError('Failed to load videos');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchVideos();
  }, []);

  if (isLoading) {
    return (
      <div className="h-[100dvh] w-full flex items-center justify-center bg-black">
        <div className="animate-spin rounded-full h-16 w-16 border-t-2 border-b-2 border-white"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-[100dvh] w-full flex flex-col items-center justify-center bg-black text-white px-4">
        <p className="text-xl mb-4 text-center">{error}</p>
        <button
          onClick={() => {
            setError(null);
            setIsLoading(true);
            fetchVideos();
          }}
          className="px-6 py-3 bg-purple-600 rounded-full hover:bg-purple-700 transition-colors text-lg"
        >
          נסה שוב
        </button>
      </div>
    );
  }

  return (
    <div className="relative h-[100dvh] w-full bg-black overflow-hidden">
      <div className="fixed top-0 left-0 z-50 p-3 sm:p-4 pt-safe">
        <Link
          href="/"
          className="p-2 text-white hover:text-gray-300 transition-colors active:scale-95"
          aria-label="Go home"
        >
          <FaHome className="w-6 h-6 sm:w-7 sm:h-7" />
        </Link>
      </div>

      <VideoFeed initialVideos={videos} />
    </div>
  );
}
