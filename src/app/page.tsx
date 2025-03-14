'use client';

import React from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import Navbar from '@/components/Navbar';

// Use dynamic import for the confetti component to avoid SSR issues
const PeriodicConfetti = dynamic(() => import('@/components/PeriodicConfetti'), {
  ssr: false,
});

export default function Home() {
  return (
    <>
      <Navbar />
      <PeriodicConfetti interval={20000} duration={6000} />
      
      <div className="birthday-container">
        <div className="birthday-hero">
          <h1 className="birthday-title">Happy Birthday Tomitilo! 🎉</h1>
          <p className="birthday-subtitle">Celebrating your special day with joy and fun!</p>
          <div className="flex flex-wrap justify-center gap-4 mt-6">
            <Link href="/family-tree">
              <button className="birthday-button">Explore Family Tree 🐕</button>
            </Link>
            <Link href="/mekafkefim">
              <button className="birthday-button">Coffee Reviews ☕</button>
            </Link>
          </div>
        </div>
        
        <div className="birthday-features">
          <div className="feature-card">
            <div className="feature-icon">🐕</div>
            <h2 className="feature-title">Family Tree</h2>
            <p>Explore Tomitilo&apos;s dog family tree and see all the furry relatives!</p>
            <Link href="/family-tree" className="mt-4 inline-block text-amber-600 hover:text-amber-800">
              View Family Tree →
            </Link>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon">☕</div>
            <h2 className="feature-title">Mekafkefim</h2>
            <p>Discover and review the best coffee places with ratings for coffee, food, atmosphere, and price!</p>
            <Link href="/mekafkefim" className="mt-4 inline-block text-amber-600 hover:text-amber-800">
              Explore Coffee Reviews →
            </Link>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon">📸</div>
            <h2 className="feature-title">Photo Gallery</h2>
            <p>Coming soon! A collection of Tomitilo&apos;s best moments and memories.</p>
          </div>
        </div>
        
        <div className="mt-12 text-center">
          <h2 className="text-2xl font-bold mb-4">More Features Coming Soon!</h2>
          <p>We&apos;re working on adding more fun sections to celebrate Tomitilo&apos;s birthday.</p>
        </div>
      </div>
    </>
  );
} 