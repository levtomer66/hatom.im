'use client';

import React, { useState, useEffect } from 'react';

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

const CountdownTimer: React.FC = () => {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0
  });

  useEffect(() => {
    const targetDate = new Date('2026-03-24T12:00:00');

    const calculateTimeLeft = () => {
      const now = new Date();
      const difference = targetDate.getTime() - now.getTime();

      if (difference > 0) {
        setTimeLeft({
          days: Math.floor(difference / (1000 * 60 * 60 * 24)),
          hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((difference / 1000 / 60) % 60),
          seconds: Math.floor((difference / 1000) % 60)
        });
      }
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="countdown-timer text-center my-8">
      <h2 className="text-2xl font-bold mb-6 text-amber-600">עד לחתונה! </h2>
      <div className="flex justify-center gap-6">
        <div className="countdown-item bg-white rounded-lg shadow-lg p-4 min-w-[100px] transform hover:scale-105 transition-transform duration-200">
          <span className="text-4xl font-bold text-amber-600 block">{timeLeft.days}</span>
          <span className="block text-sm text-gray-600 mt-1">ימים</span>
        </div>
        <div className="countdown-item bg-white rounded-lg shadow-lg p-4 min-w-[100px] transform hover:scale-105 transition-transform duration-200">
          <span className="text-4xl font-bold text-amber-600 block">{timeLeft.hours}</span>
          <span className="block text-sm text-gray-600 mt-1">שעות</span>
        </div>
        <div className="countdown-item bg-white rounded-lg shadow-lg p-4 min-w-[100px] transform hover:scale-105 transition-transform duration-200">
          <span className="text-4xl font-bold text-amber-600 block">{timeLeft.minutes}</span>
          <span className="block text-sm text-gray-600 mt-1">דקות</span>
        </div>
        <div className="countdown-item bg-white rounded-lg shadow-lg p-4 min-w-[100px] transform hover:scale-105 transition-transform duration-200">
          <span className="text-4xl font-bold text-amber-600 block">{timeLeft.seconds}</span>
          <span className="block text-sm text-gray-600 mt-1">שניות</span>
        </div>
      </div>
      <p className="text-sm text-gray-500 mt-4">24 במרץ 2026, 12:00</p>
    </div>
  );
};

export default CountdownTimer; 