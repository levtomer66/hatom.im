import './globals.css';
import { Rubik } from 'next/font/google';
import { SessionProvider } from 'next-auth/react';
import type { Metadata, Viewport } from 'next';
import { auth } from '@/auth';

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

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth();
  return (
    <html lang="he" dir="rtl">
      <body className={rubik.className}>
        <SessionProvider session={session}>
          {children}
        </SessionProvider>
      </body>
    </html>
  )
}
