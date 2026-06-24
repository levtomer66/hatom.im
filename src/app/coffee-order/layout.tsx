import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '☕ הזמנת קפה',
};

export default function CoffeeOrderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
