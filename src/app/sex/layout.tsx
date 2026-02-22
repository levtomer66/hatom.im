import { Metadata } from 'next';
import './sex.css';

export const metadata: Metadata = {
  title: 'Valentine',
  description: 'Secret page',
  robots: 'noindex, nofollow',
};

export default function SexLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="sex-app" style={{ direction: 'ltr' }}>
      {children}
    </div>
  );
}
