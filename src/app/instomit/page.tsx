'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { FaHome, FaPlus } from 'react-icons/fa';
import { Video } from '@/types/video';
import VideoFeed from '@/components/instomit/VideoFeed';

export default function InsTomitPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newVideoUrl, setNewVideoUrl] = useState('');
  const [newVideoTitle, setNewVideoTitle] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch videos
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

  // Handle adding a new video
  const handleAddVideo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newVideoUrl.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/instomit/videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          youtubeUrl: newVideoUrl.trim(),
          title: newVideoTitle.trim() || undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to add video');
      }

      setNewVideoUrl('');
      setNewVideoTitle('');
      setShowAddForm(false);
      fetchVideos();
    } catch (err) {
      console.error('Error adding video:', err);
      alert(err instanceof Error ? err.message : 'Failed to add video');
    } finally {
      setIsSubmitting(false);
    }
  };

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
      {/* Header with navigation - adjusted for iPhone notch */}
      <div className="fixed top-0 left-0 right-0 z-50 p-3 sm:p-4 flex justify-between items-center bg-gradient-to-b from-black/80 to-transparent pt-safe">
        <Link
          href="/"
          className="p-2 text-white hover:text-gray-300 transition-colors active:scale-95"
          aria-label="Go home"
        >
          <FaHome className="w-6 h-6 sm:w-7 sm:h-7" />
        </Link>
        
        <h1 className="text-white text-lg sm:text-xl font-bold">InsTomit</h1>
        
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="p-2 text-white hover:text-gray-300 transition-colors active:scale-95"
          aria-label="Add video"
        >
          <FaPlus className="w-6 h-6 sm:w-7 sm:h-7" />
        </button>
      </div>

      {/* Add Video Form Modal */}
      {showAddForm && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-white text-xl font-bold mb-4 text-center">
              הוסף סרטון חדש
            </h2>
            <form onSubmit={handleAddVideo} className="space-y-4">
              <div>
                <label className="block text-gray-300 text-sm mb-2">
                  קישור YouTube
                </label>
                <input
                  type="url"
                  value={newVideoUrl}
                  onChange={(e) => setNewVideoUrl(e.target.value)}
                  placeholder="https://youtube.com/shorts/..."
                  className="w-full px-4 py-3 bg-gray-800 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  required
                  dir="ltr"
                />
              </div>
              <div>
                <label className="block text-gray-300 text-sm mb-2">
                  כותרת (אופציונלי)
                </label>
                <input
                  type="text"
                  value={newVideoTitle}
                  onChange={(e) => setNewVideoTitle(e.target.value)}
                  placeholder="תיאור קצר של הסרטון"
                  className="w-full px-4 py-3 bg-gray-800 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  maxLength={100}
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="flex-1 px-4 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
                >
                  ביטול
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !newVideoUrl.trim()}
                  className="flex-1 px-4 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'מוסיף...' : 'הוסף סרטון'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Video Feed */}
      <VideoFeed initialVideos={videos} />
    </div>
  );
}
