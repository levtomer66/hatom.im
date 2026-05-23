import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '🔐 הרשאות',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
