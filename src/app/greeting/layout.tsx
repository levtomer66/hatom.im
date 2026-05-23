import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '💝 ברכה',
};

export default function GreetingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
