import './globals.css';
import { Rubik } from 'next/font/google';
import type { Metadata, Viewport } from 'next';

const rubik = Rubik({ 
  subsets: ['latin', 'hebrew'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'התומ.ים',
  description: 'התומ.ים — תומר ותומית',
}

// Viewport configuration for mobile compatibility
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="he" dir="rtl">
      <body className={rubik.className}>
        {children}
      </body>
    </html>
  )
}
