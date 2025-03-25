'use client';

import React from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import Navbar from '@/components/Navbar';
import CountdownTimer from '@/components/CountdownTimer';

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
          <h1 className="birthday-title">תומים המתחתנים ! 👰‍♀️🤵‍♂️</h1>
          <CountdownTimer />
          <div className="flex flex-wrap justify-center gap-4 mt-6">
            <Link href="/family-tree">
              <button className="birthday-button">שמות האוליבון 🐕</button>
            </Link>
            <Link href="/mekafkefim">
              <button className="birthday-button">מקפקפים ☕</button>
            </Link>
          </div>
        </div>
        
        <div className="birthday-features">
          <div className="feature-card">
            <div className="feature-icon">🐕</div>
            <h2 className="feature-title">שמות האוליבון</h2>
            <p>כל שמות האוליבון לעולם ועד</p>
            <Link href="/family-tree" className="mt-4 inline-block text-amber-600 hover:text-amber-800">
              ← צפה בשמות האוליבון
            </Link>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon">☕</div>
            <h2 className="feature-title">מקפקפים</h2>
            <p>ביקורות על קפה מאת תומית ותומרינדי</p>
            <Link href="/mekafkefim" className="mt-4 inline-block text-amber-600 hover:text-amber-800">
              ← צפה במקפקפים
            </Link>
          </div>
          
          <div className="feature-card">
            <div className="feature-icon">📸</div>
            <h2 className="feature-title">Wedding</h2>
            <p>Coming soon! Wedding Features</p>
          </div>
        </div>
        
        <div className="mt-12 text-center">
          <h2 className="text-2xl font-bold mb-4">עוד בהמשך!</h2>
          <p> עובדים על מספר פיצ׳רים נוספים כדי לחגג את יום הולדת שמח של תומיתילו.</p>
        </div>
      </div>
    </>
  );
} 