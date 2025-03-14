'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const Navbar: React.FC = () => {
  const pathname = usePathname();
  
  return (
    <nav className="navbar">
      <div className="navbar-container">
        <div className="navbar-logo">
          <Link href="/">
            🎂 התומ.ית
          </Link>
        </div>
        <div className="navbar-links">
          <Link 
            href="/" 
            className={`navbar-link ${pathname === '/' ? 'text-yellow-300' : ''}`}
          >
            Home
          </Link>
          <Link 
            href="/family-tree" 
            className={`navbar-link ${pathname === '/family-tree' ? 'text-yellow-300' : ''}`}
          >
            Family Tree
          </Link>
          <Link 
            href="/mekafkefim" 
            className={`navbar-link ${pathname === '/mekafkefim' ? 'text-yellow-300' : ''}`}
          >
            ☕ Mekafkefim
          </Link>
          {/* More links can be added here */}
        </div>
      </div>
    </nav>
  );
};

export default Navbar; 