import type { Metadata } from 'next';
import './shopping.css';

export const metadata: Metadata = {
  title: '🛒 השוואת מחירים',
  description: 'רשימת קניות ואיפה הכי זול לקנות אותה',
};

export default function ShoppingLayout({ children }: { children: React.ReactNode }) {
  return children;
}
