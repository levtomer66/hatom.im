'use client';

import React, { useState, useEffect } from 'react';

interface TimeLeft {
  months: number;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

const UNITS: { key: keyof TimeLeft; label: string }[] = [
  { key: 'months', label: 'חודשים' },
  { key: 'days', label: 'ימים' },
  { key: 'hours', label: 'שעות' },
  { key: 'minutes', label: 'דקות' },
  { key: 'seconds', label: 'שניות' },
];

const CountdownTimer: React.FC = () => {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({
    months: 0,
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  useEffect(() => {
    const targetDate = new Date('2026-07-07T19:00:00');

    const calculateTimeLeft = () => {
      const now = new Date();
      const difference = targetDate.getTime() - now.getTime();

      if (difference > 0) {
        let months = (targetDate.getFullYear() - now.getFullYear()) * 12
          + (targetDate.getMonth() - now.getMonth());
        const monthBoundary = new Date(now);
        monthBoundary.setMonth(monthBoundary.getMonth() + months);
        if (monthBoundary > targetDate) months--;

        const afterMonths = new Date(now);
        afterMonths.setMonth(afterMonths.getMonth() + months);
        const remainingMs = targetDate.getTime() - afterMonths.getTime();

        setTimeLeft({
          months,
          days: Math.floor(remainingMs / (1000 * 60 * 60 * 24)),
          hours: Math.floor((remainingMs / (1000 * 60 * 60)) % 24),
          minutes: Math.floor((remainingMs / 1000 / 60) % 60),
          seconds: Math.floor((remainingMs / 1000) % 60),
        });
      }
    };

    calculateTimeLeft();
    const timer = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div style={{ textAlign: 'center', margin: '2.5rem 0 1.5rem' }}>
      <p style={{
        fontSize: '1.1rem',
        fontWeight: 600,
        color: 'var(--gold)',
        marginBottom: '1.25rem',
        letterSpacing: '0.03em',
      }}>
        עד לחתונה
      </p>

      <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        {UNITS.map(({ key, label }) => (
          <div
            key={key}
            style={{
              background: 'var(--glass-bg)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid var(--glass-border)',
              borderRadius: '0.75rem',
              padding: '1rem 0.75rem',
              minWidth: '80px',
              transition: 'border-color 0.3s ease',
            }}
          >
            <span style={{
              display: 'block',
              fontSize: '2.25rem',
              fontWeight: 800,
              color: 'var(--gold)',
              lineHeight: 1.1,
              fontVariantNumeric: 'tabular-nums',
            }}>
              {timeLeft[key]}
            </span>
            <span style={{
              display: 'block',
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              marginTop: '0.35rem',
              fontWeight: 500,
            }}>
              {label}
            </span>
          </div>
        ))}
      </div>

      <p style={{
        fontSize: '0.8rem',
        color: 'var(--text-muted)',
        marginTop: '1rem',
      }}>
        7 ביולי 2026, 19:00
      </p>
    </div>
  );
};

export default CountdownTimer;
