'use client';

import React, { useState, useEffect, useCallback } from 'react';

interface Particle {
  id: number;
  x: number;
  size: number;
  duration: number;
  delay: number;
  opacity: number;
  color: string;
}

const GOLD_PALETTE = [
  '#c9a84c',
  '#e8d5a3',
  '#d4b85a',
  '#f0e6c8',
  'rgba(255, 255, 255, 0.6)',
];

const GoldSparkles: React.FC = () => {
  const [particles, setParticles] = useState<Particle[]>([]);
  const [visible, setVisible] = useState(true);

  const generateParticles = useCallback(() => {
    return Array.from({ length: 35 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      size: Math.random() * 4 + 2,
      duration: Math.random() * 3 + 2.5,
      delay: Math.random() * 1.5,
      opacity: Math.random() * 0.7 + 0.3,
      color: GOLD_PALETTE[Math.floor(Math.random() * GOLD_PALETTE.length)],
    }));
  }, []);

  useEffect(() => {
    setParticles(generateParticles());
    const fadeTimer = setTimeout(() => setVisible(false), 4500);
    return () => clearTimeout(fadeTimer);
  }, [generateParticles]);

  if (!visible) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 40,
        overflow: 'hidden',
        transition: 'opacity 1s ease-out',
        opacity: visible ? 1 : 0,
      }}
    >
      {particles.map((p) => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            bottom: '-10px',
            left: `${p.x}%`,
            width: `${p.size}px`,
            height: `${p.size}px`,
            borderRadius: '50%',
            background: p.color,
            opacity: p.opacity,
            boxShadow: `0 0 ${p.size * 2}px ${p.color}`,
            animation: `sparkle-float ${p.duration}s ${p.delay}s ease-out forwards`,
          }}
        />
      ))}
    </div>
  );
};

export default GoldSparkles;
