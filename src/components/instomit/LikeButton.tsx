'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FaHeart, FaRegHeart } from 'react-icons/fa';

interface LikeButtonProps {
  likes: number;
  isLiked: boolean;
  onToggleLike: () => void;
  isLoading?: boolean;
}

function formatCount(n: number): string {
  if (n >= 1_000_000) {
    const val = n / 1_000_000;
    return val % 1 === 0 ? `${val}M` : `${val.toFixed(1)}M`;
  }
  if (n >= 1_000) {
    const val = n / 1_000;
    return val % 1 === 0 ? `${val}K` : `${val.toFixed(1)}K`;
  }
  return String(n);
}

const LikeButton: React.FC<LikeButtonProps> = ({ 
  likes, 
  isLiked, 
  onToggleLike,
  isLoading = false 
}) => {
  return (
    <button
      onClick={onToggleLike}
      disabled={isLoading}
      className="flex flex-col items-center gap-1 transition-transform active:scale-90"
      aria-label={isLiked ? 'Unlike' : 'Like'}
    >
      <AnimatePresence mode="wait">
        <motion.div
          key={isLiked ? 'liked' : 'not-liked'}
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          exit={{ scale: 0.8 }}
          whileTap={{ scale: 1.2 }}
          className="relative"
        >
          {isLiked ? (
            <FaHeart className="w-8 h-8 text-red-500 drop-shadow-lg" />
          ) : (
            <FaRegHeart className="w-8 h-8 text-white drop-shadow-lg" />
          )}
          
          {isLiked && (
            <motion.div
              initial={{ scale: 0, opacity: 1 }}
              animate={{ scale: 2, opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="absolute inset-0 flex items-center justify-center"
            >
              <FaHeart className="w-8 h-8 text-red-400" />
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>
      
      <motion.span
        key={likes}
        initial={{ y: -10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="text-white text-sm font-semibold drop-shadow-lg"
      >
        {formatCount(likes)}
      </motion.span>
    </button>
  );
};

export default LikeButton;
