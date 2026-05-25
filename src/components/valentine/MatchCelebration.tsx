'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

const Confetti = dynamic(() => import('react-confetti'), { ssr: false });

function playMatchSound() {
  if (typeof window === 'undefined') return;
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const playTone = (freq: number, start: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.15, start);
      gain.gain.exponentialRampToValueAtTime(0.01, start + duration);
      osc.start(start);
      osc.stop(start + duration);
    };
    playTone(523.25, 0, 0.15);
    playTone(659.25, 0.15, 0.15);
    playTone(783.99, 0.3, 0.25);
  } catch {
    // ignore
  }
}

interface MatchCelebrationProps {
  /** When true, run confetti once and play sound. */
  trigger: boolean;
}

export default function MatchCelebration({ trigger }: MatchCelebrationProps) {
  const [show, setShow] = useState(false);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setSize({ width: window.innerWidth, height: window.innerHeight });
    const onResize = () => setSize({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    if (!trigger) return;
    setShow(true);
    playMatchSound();
    const t = setTimeout(() => setShow(false), 5000);
    return () => clearTimeout(t);
  }, [trigger]);

  if (!show) return null;
  return (
    <Confetti
      width={size.width}
      height={size.height}
      recycle={false}
      numberOfPieces={250}
      gravity={0.25}
      colors={['#f8bbd9', '#e91e63', '#c2185b', '#ffeb3b', '#4ecdc4', '#fff']}
    />
  );
}
