'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useT, TranslationKey } from '@/lib/workout-i18n';

const navItems: { href: string; labelKey: TranslationKey; icon: string }[] = [
  { href: '/workout',            labelKey: 'nav.workouts',  icon: '💪' },
  { href: '/workout/exercises',  labelKey: 'nav.exercises', icon: '📋' },
  { href: '/workout/history',    labelKey: 'nav.history',   icon: '📊' },
];

export default function BottomNav() {
  const pathname = usePathname();
  const t = useT();

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
            <span>{t(item.labelKey)}</span>
          </Link>
        );
      })}
    </nav>
  );
}
