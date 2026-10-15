import type { Metadata } from 'next';
import './laundry.css';

export const metadata: Metadata = {
  title: '🧺 כביסה',
  description: 'הוראות כביסה צעד אחר צעד למכונת ה-LG',
};

export default function LaundryLayout({ children }: { children: React.ReactNode }) {
  return children;
}
