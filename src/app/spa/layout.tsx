import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '🌹 ספא',
};

export default function SpaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
