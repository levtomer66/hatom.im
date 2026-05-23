import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '🎥 InsTomit',
};

export default function InstomitLayout({ children }: { children: React.ReactNode }) {
  return children;
}
