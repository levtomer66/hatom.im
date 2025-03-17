'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import Navbar from '@/components/Navbar';

// Use dynamic import to avoid SSR issues with the tree component
const FamilyTreeNames = dynamic(() => import('@/components/FamilyTreeOrgChart'), {
  ssr: false,
});

export default function FamilyTreePage() {
  return (
    <div className="min-h-screen bg-amber-50">
      <Navbar />
      
      <main>
        <FamilyTreeNames />
      </main>
      
      <footer className="bg-amber-800 text-white p-4 text-center">
        <p>© {new Date().getFullYear()} Oliver שמות האוליבון - Created with ❤️ and 🐾</p>
      </footer>
    </div>
  );
} 