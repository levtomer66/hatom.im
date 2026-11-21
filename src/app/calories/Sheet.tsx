'use client';

// A bottom sheet like /shopping's: drag it down, tap outside or press Escape to close. No ✕.

import React, { useEffect, useRef, type ReactNode } from 'react';
import { useSwipeToClose } from '../shopping/ui';

export default function Sheet({ title, onClose, className = '', children }: {
  title: string; onClose: () => void; className?: string; children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useSwipeToClose(ref, onClose);
  useEffect(() => ref.current?.focus(), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="sh-sheet-backdrop" onClick={onClose}>
      <div ref={ref} tabIndex={-1} className={`sh-sheet cal-sheet ${className}`} role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <span className="sh-sheet-grip" aria-hidden />
        <h2 className="cal-sheet-title">{title}</h2>
        {children}
      </div>
    </div>
  );
}
