'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FaDog, FaCoffee, FaVideo, FaDumbbell, FaHome, FaRing, FaPlane } from 'react-icons/fa';

const navItems = [
  { href: '/family-tree', label: 'שמות האוליבון', icon: FaDog },
  { href: '/mekafkefim', label: 'מקפקפים', icon: FaCoffee },
  { href: '/instomit', label: 'InsTomit', icon: FaVideo },
  { href: '/workout', label: 'המפלצתומים', icon: FaDumbbell },
  { href: '/vegas-wedding-guide.html', label: 'מדריך חתונה', icon: FaRing },
  { href: '/trip.html', label: 'מסלול הטיול', icon: FaPlane },
  { href: '/', label: 'בית', icon: FaHome, exact: true },
];

const Navbar: React.FC = () => {
  const pathname = usePathname();

  const isActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname === href || pathname?.startsWith(href + '/');
  };

  return (
    <nav className="navbar">
      <div className="navbar-container">
        <div className="navbar-logo">
          <Link href="/">התומ.ים</Link>
        </div>
        <div className="navbar-links">
          {navItems.map(({ href, label, icon: Icon, exact }) => (
            <Link
              key={href}
              href={href}
              className={`navbar-link ${isActive(href, exact) ? 'active' : ''}`}
            >
              <Icon style={{ display: 'inline', verticalAlign: '-2px', marginLeft: '4px' }} />
              {label}
            </Link>
          ))}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
