import type { Metadata } from 'next';
import './todo.css';

export const metadata: Metadata = {
  title: '📝 Things To Do',
  description: 'Shared to-do lists',
};

export default function TodoLayout({ children }: { children: React.ReactNode }) {
  return children;
}
