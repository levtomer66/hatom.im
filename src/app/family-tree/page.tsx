'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';

// Use dynamic import to avoid SSR issues with the tree component
const FamilyTreeNames = dynamic(() => import('@/components/FamilyTreeOrgChart'), {
  ssr: false,
});

export default function FamilyTreePage() {
  return (
    <div className="min-h-screen bg-amber-50">
      <nav className="bg-amber-800 text-white p-4 shadow-md">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold">Dog Family Tree</h1>
          <div className="flex space-x-4">
            <Link href="/" className="hover:underline">
              Home
            </Link>
            <Link href="/family-tree/org-chart" className="hover:underline">
              Org Chart View
            </Link>
            <Link href="/family-tree/prime" className="hover:underline">
              PrimeReact View
            </Link>
          </div>
        </div>
      </nav>
      
      <main>
        <FamilyTreeNames />
      </main>
      
      <footer className="bg-amber-800 text-white p-4 text-center">
        <p>© {new Date().getFullYear()} Oliver Dog Family Tree - Created with ❤️ and 🐾</p>
      </footer>
    </div>
  );
} 