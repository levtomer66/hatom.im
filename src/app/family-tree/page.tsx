'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import Navbar from '@/components/Navbar';

const FamilyTreeNames = dynamic(() => import('@/components/FamilyTreeOrgChart'), {
  ssr: false,
});

export default function FamilyTreePage() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main>
        <FamilyTreeNames />
      </main>
    </div>
  );
}
