'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaTimes, FaPaperPlane } from 'react-icons/fa';
import { Comment } from '@/types/video';

interface CommentsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  comments: Comment[];
  onAddComment: (name: string, text: string) => Promise<void>;
  isLoading?: boolean;
}

const CommentsPanel: React.FC<CommentsPanelProps> = ({
  isOpen,
  onClose,
  comments,
  onAddComment,
  isLoading = false,
}) => {
  const [name, setName] = useState('');
  const [text, setText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const commentsEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom when new comments are added
  useEffect(() => {
    if (isOpen && commentsEndRef.current) {
      commentsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [comments, isOpen]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen]);

  // Load saved name from localStorage
  useEffect(() => {
    const savedName = localStorage.getItem('instomit-user-name');
    if (savedName) {
      setName(savedName);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !text.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      // Save name to localStorage
      localStorage.setItem('instomit-user-name', name.trim());
      await onAddComment(name.trim(), text.trim());
      setText('');
    } catch (error) {
      console.error('Failed to add comment:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'עכשיו';
    if (diffMins < 60) return `לפני ${diffMins} דקות`;
    if (diffHours < 24) return `לפני ${diffHours} שעות`;
    if (diffDays < 7) return `לפני ${diffDays} ימים`;
    return date.toLocaleDateString('he-IL');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-40"
          />
          
          {/* Panel */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 h-[70vh] sm:h-[60vh] bg-gray-900 rounded-t-3xl z-50 flex flex-col"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <h3 className="text-white text-lg font-semibold">
                תגובות ({comments.length})
              </h3>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-white transition-colors p-2"
                aria-label="Close comments"
              >
                <FaTimes className="w-5 h-5" />
              </button>
            </div>

            {/* Comments List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {isLoading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-white"></div>
                </div>
              ) : comments.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-400">
                  <p className="text-lg">אין תגובות עדיין</p>
                  <p className="text-sm">היה הראשון להגיב!</p>
                </div>
              ) : (
                <>
                  {comments.map((comment) => (
                    <motion.div
                      key={comment.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex gap-3"
                    >
                      {/* Avatar */}
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                        {comment.name.charAt(0).toUpperCase()}
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-white font-semibold text-sm">
                            {comment.name}
                          </span>
                          <span className="text-gray-500 text-xs">
                            {formatTime(comment.createdAt)}
                          </span>
                        </div>
                        <p className="text-gray-300 text-sm mt-1 break-words">
                          {comment.text}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                  <div ref={commentsEndRef} />
                </>
              )}
            </div>

            {/* Input Form - with safe area padding for iPhone */}
            <form
              onSubmit={handleSubmit}
              className="p-3 sm:p-4 border-t border-gray-700 bg-gray-800"
            >
              {!name && (
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="השם שלך..."
                  className="w-full mb-2 px-4 py-3 sm:py-2 bg-gray-700 text-white rounded-full text-base sm:text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  maxLength={30}
                  autoComplete="name"
                />
              )}
              <div className="flex gap-2 items-center">
                {name && (
                  <div className="w-9 h-9 sm:w-8 sm:h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                    {name.charAt(0).toUpperCase()}
                  </div>
                )}
                <input
                  ref={inputRef}
                  type="text"
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="הוסף תגובה..."
                  className="flex-1 px-4 py-3 sm:py-2 bg-gray-700 text-white rounded-full text-base sm:text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  maxLength={500}
                  autoComplete="off"
                />
                <button
                  type="submit"
                  disabled={!name.trim() || !text.trim() || isSubmitting}
                  className="p-3 sm:p-2 text-purple-500 hover:text-purple-400 disabled:text-gray-600 disabled:cursor-not-allowed transition-colors active:scale-95"
                  aria-label="Send comment"
                >
                  <FaPaperPlane className="w-5 h-5 sm:w-5 sm:h-5" />
                </button>
              </div>
            </form>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default CommentsPanel;
