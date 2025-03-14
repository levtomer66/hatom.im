'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';

// Dynamically import Confetti to avoid SSR issues
const Confetti = dynamic(() => import('react-confetti'), { ssr: false });

interface PeriodicConfettiProps {
  interval?: number; // Time in ms between confetti bursts
  duration?: number; // Duration of each confetti burst in ms
}

const PeriodicConfetti: React.FC<PeriodicConfettiProps> = ({
  interval = 15000, // Default to 15 seconds between bursts
  duration = 5000,  // Default to 5 seconds per burst
}) => {
  const [showConfetti, setShowConfetti] = useState<boolean>(false);
  const [windowSize, setWindowSize] = useState<{ width: number; height: number }>({
    width: 0,
    height: 0,
  });

  // Set window size on client side
  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    // Initial size
    handleResize();

    // Add event listener
    window.addEventListener('resize', handleResize);

    // Clean up
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Periodic confetti effect
  useEffect(() => {
    // Show confetti immediately on first load
    setShowConfetti(true);
    
    const timer = setTimeout(() => {
      setShowConfetti(false);
    }, duration);

    // Set up interval for periodic confetti
    const intervalId = setInterval(() => {
      setShowConfetti(true);
      
      setTimeout(() => {
        setShowConfetti(false);
      }, duration);
    }, interval);

    // Clean up
    return () => {
      clearTimeout(timer);
      clearInterval(intervalId);
    };
  }, [duration, interval]);

  return showConfetti ? (
    <Confetti
      width={windowSize.width}
      height={windowSize.height}
      recycle={false}
      numberOfPieces={200}
      gravity={0.2}
      colors={['#ff6b6b', '#ffbe0b', '#4ecdc4', '#7bdff2', '#f7b801', '#f18701']}
    />
  ) : null;
};

export default PeriodicConfetti; 