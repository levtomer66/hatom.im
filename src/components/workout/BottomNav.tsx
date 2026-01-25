'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navItems = [
  { href: '/workout', label: 'Workouts', icon: '💪' },
  { href: '/workout/exercises', label: 'Exercises', icon: '📋' },
  { href: '/workout/history', label: 'History', icon: '📊' },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="workout-bottom-nav">
      {navItems.map(item => {
        const isActive = pathname === item.href || 
          (item.href !== '/workout' && pathname?.startsWith(item.href));
        
        return (
          <Link 
            key={item.href}
            href={item.href}
            className={`workout-nav-item ${isActive ? 'active' : ''}`}
          >
            <span className="workout-nav-icon">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
