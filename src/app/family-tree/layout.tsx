import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '🐶 שמות האוליבון',
};

export default function FamilyTreeLayout({ children }: { children: React.ReactNode }) {
  return children;
}
