import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '☕ מקפקפים',
};

export default function MekafkefimLayout({ children }: { children: React.ReactNode }) {
  return children;
}
