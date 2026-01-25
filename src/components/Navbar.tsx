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
          👰‍♀️🤵‍♂️  התומ.ים 
          </Link>
        </div>
        <div className="navbar-links">
          
          <Link 
            href="/family-tree" 
            className={`navbar-link ${pathname === '/family-tree' ? 'text-yellow-300' : ''}`}
          >
            🐶 שמות האוליבון 
          </Link>
          <Link 
            href="/mekafkefim" 
            className={`navbar-link ${pathname === '/mekafkefim' ? 'text-yellow-300' : ''}`}
          >
            ☕ מקפקפים
          </Link>
          <Link 
            href="/instomit" 
            className={`navbar-link ${pathname === '/instomit' ? 'text-yellow-300' : ''}`}
          >
            📹 InsTomit
          </Link>
          <Link 
            href="/" 
            className={`navbar-link ${pathname === '/' ? 'text-yellow-300' : ''}`}
          >
            🏠 בית 
          </Link>
          {/* <Link 
            href="/greeting" 
            className={`navbar-link ${pathname === '/greeting' ? 'text-yellow-300' : ''}`}
          >
            🎈 ברכה
          </Link> */}
          {/* More links can be added here */}
        </div>
      </div>
    </nav>
  );
};

export default Navbar; 