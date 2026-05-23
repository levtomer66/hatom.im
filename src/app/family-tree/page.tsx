'use client';

import React, { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Navbar from '@/components/Navbar';
import { hasPermission } from '@/lib/permissions';

const FamilyTreeNames = dynamic(() => import('@/components/FamilyTreeOrgChart'), {
  ssr: false,
});

export default function FamilyTreePage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  // Middleware already handles the gate, but a client-side fallback covers
  // soft-nav edge cases where the session is loaded but the user doesn't
  // hold the permission.
  useEffect(() => {
    if (status === 'loading') return;
    if (!session?.user) {
      router.replace('/login?from=/family-tree');
      return;
    }
    if (!hasPermission(session, 'family-tree')) {
      router.replace('/');
    }
  }, [session, status, router]);

  return (
    <div className="min-h-screen">
      <Navbar />
      <main>
        <FamilyTreeNames />
      </main>
    </div>
  );
}
